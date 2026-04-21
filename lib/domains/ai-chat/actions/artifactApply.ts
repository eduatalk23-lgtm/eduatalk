"use server";

/**
 * Phase C-3 Sprint 2: Artifact writeback — LLM 자율 tool 호출을 받아
 * HITL 승인 후 원본 `student_internal_scores` 에 실제 쓰기.
 *
 * 호출 경로:
 *  Chat Shell 의 `applyArtifactEdit` tool (HITL, execute 없음)
 *   → LLM 호출 → state='input-available' → InlineConfirm
 *   → 사용자 승인 → 이 서버 액션 → addToolResult 로 resume.
 *
 * 서버 액션으로 직접 호출도 가능(ArtifactPanel 등) — 다만 UI 경로는 Sprint 2 에선
 * Chat Shell HITL 만 공식 지원.
 *
 * Sprint 3 (2026-04-21): Zod 입력·props 런타임 검증 + type dispatch 골격 도입.
 *  · 향후 plan/analysis/blueprint type 추가 시 ARTIFACT_HANDLERS 에 등록.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateInternalScore as updateInternalScoreData } from "@/lib/data/studentScores";
import { recordAuditLog, type AuditActorRole } from "@/lib/audit";
import { recalculateRiskIndex } from "@/lib/domains/analysis/actions/riskIndex";
import {
  computeScoreAnalysis,
  determineSubjectCategory,
  determineGradeSystem,
} from "@/lib/domains/score/computation";
import { getAchievementScale } from "@/lib/domains/score/validation";
import type { ScoreRow } from "@/lib/mcp/tools/getScores";
import type { PlanRow } from "@/lib/mcp/tools/designStudentPlan";

export type ApplyArtifactEditOutput =
  | {
      ok: true;
      appliedCount: number;
      skippedCount: number;
      artifactId: string;
      versionNo: number;
    }
  | {
      ok: false;
      reason: string;
    };

// ─── Zod schemas (Sprint 3) ─────────────────────────────────────────────────

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const applyArtifactEditInputSchema = z.object({
  artifactId: z.string().regex(UUID_RE, "artifactId 가 UUID 형식이 아닙니다."),
  versionNo: z.number().int().positive().optional(),
});

export type ApplyArtifactEditInput = z.infer<typeof applyArtifactEditInputSchema>;

/**
 * scores artifact 의 props.rows 런타임 shape 검증.
 * `id` 는 optional (C-2 이전 스냅샷 호환).
 */
const scoreRowSchema: z.ZodType<ScoreRow> = z.object({
  id: z.string().optional(),
  subjectGroup: z.string(),
  subject: z.string(),
  grade: z.number().int().min(1).max(3),
  semester: z.number().int().min(1).max(2),
  rawScore: z.number().min(0).max(100).nullable(),
  rankGrade: z.number().int().min(1).max(9).nullable(),
  creditHours: z.number().min(0),
});

const scoresPropsSchema = z.object({
  ok: z.literal(true).optional(),
  rows: z.array(scoreRowSchema).min(1),
});

type ArtifactVersionProps = {
  ok?: boolean;
  rows?: ScoreRow[];
};

/**
 * Sprint P1~P2 (2026-04-21): plan artifact props shape.
 * designStudentPlan output.rows 와 동일 shape. applyArtifactEdit 은 id 로
 * student_course_plans 를 찾아 plan_status 만 writeback (현 스프린트 범위).
 */
const planRowSchema: z.ZodType<PlanRow> = z.object({
  id: z.string().regex(UUID_RE, "row id 가 UUID 형식이 아닙니다."),
  subjectId: z.string(),
  subjectName: z.string(),
  grade: z.number().int().min(1).max(3),
  semester: z.number().int().min(1).max(2),
  planStatus: z.enum(["recommended", "confirmed", "rejected", "completed"]),
  source: z.enum(["auto", "consultant", "student", "import"]),
  priority: z.number(),
  notes: z.string().nullable(),
});

const planPropsSchema = z.object({
  rows: z.array(planRowSchema).min(1),
});

// ─── Type dispatch (Sprint 3) ───────────────────────────────────────────────
//
// scores / plan 구현. analysis/blueprint 은 후속 스프린트.

const SUPPORTED_TYPES = new Set<string>(["scores", "plan"]);
const FUTURE_TYPES = new Set<string>(["analysis", "blueprint"]);

/**
 * Chat Shell HITL 승인 콜백에서 호출. 실패는 ok:false reason 반환 (throw 안 함).
 */
export async function applyArtifactEdit(
  input: ApplyArtifactEditInput,
): Promise<ApplyArtifactEditOutput> {
  // 0) Sprint 3: 입력 런타임 검증.
  const parsedInput = applyArtifactEditInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      reason: `입력 형식 오류: ${parsedInput.error.issues[0]?.message ?? "유효하지 않습니다."}`,
    };
  }
  const validatedInput = parsedInput.data;

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }

  const tenantId = user.tenantId;
  if (!tenantId) {
    return { ok: false, reason: "기관 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 1) artifact 로드 (RLS — 접근 불가면 not found).
  const artifactRes = await supabase
    .from("ai_artifacts")
    .select("id, type, tenant_id, owner_user_id, latest_version")
    .eq("id", validatedInput.artifactId)
    .maybeSingle();
  if (artifactRes.error || !artifactRes.data) {
    return { ok: false, reason: "아티팩트를 찾을 수 없거나 접근 권한이 없습니다." };
  }
  // Sprint 3: type dispatch — 현재 'scores' 만 지원. 향후 type 은 명확한 안내.
  const artifactType = artifactRes.data.type;
  if (!SUPPORTED_TYPES.has(artifactType)) {
    if (FUTURE_TYPES.has(artifactType)) {
      return {
        ok: false,
        reason: `'${artifactType}' 아티팩트 적용은 곧 지원됩니다 (Sprint 3 후속). 현재는 성적만 가능합니다.`,
      };
    }
    return { ok: false, reason: "성적 아티팩트만 원본 DB 에 적용할 수 있습니다." };
  }

  const versionNo = validatedInput.versionNo ?? artifactRes.data.latest_version;

  // 2) 해당 버전 props 로드. (공통)
  const versionRes = await supabase
    .from("ai_artifact_versions")
    .select("props, version_no")
    .eq("artifact_id", validatedInput.artifactId)
    .eq("version_no", versionNo)
    .maybeSingle();
  if (versionRes.error || !versionRes.data) {
    return { ok: false, reason: `v${versionNo} 을 찾을 수 없습니다.` };
  }

  // Sprint P2: plan type 은 별도 handler 로 분기 (props shape 다름).
  if (artifactType === "plan") {
    return handlePlanApply({
      supabase,
      user,
      tenantId,
      artifactId: validatedInput.artifactId,
      versionNo,
      rawProps: versionRes.data.props,
    });
  }

  // Sprint 3: props.rows 런타임 shape 검증.
  const rawProps = versionRes.data.props as ArtifactVersionProps | null;
  const propsParse = scoresPropsSchema.safeParse(rawProps);
  if (!propsParse.success) {
    const issue = propsParse.error.issues[0];
    if (issue?.path.includes("rows") && issue.code === "too_small") {
      return { ok: false, reason: "적용할 성적 행이 없습니다." };
    }
    return {
      ok: false,
      reason: `아티팩트 데이터 형식 오류: ${issue?.message ?? "rows 가 유효하지 않습니다."}`,
    };
  }
  const rows = propsParse.data.rows;

  // 3) 각 row 에 DB id 존재 여부 확인 — 없으면 C-2 이전 artifact 로 간주.
  const rowsWithId = rows.filter((r): r is ScoreRow & { id: string } =>
    typeof r.id === "string" && r.id.length > 0,
  );
  if (rowsWithId.length === 0) {
    return {
      ok: false,
      reason: "구 버전 스냅샷이라 원본 DB 에 적용할 수 없습니다. 성적을 다시 조회한 뒤 편집해주세요.",
    };
  }

  // 4) DB 원본 조회 — 권한 체크 위해 student_id · tenant_id 포함.
  const ids = rowsWithId.map((r) => r.id);
  const existingRes = await supabase
    .from("student_internal_scores")
    .select(
      "id, student_id, tenant_id, raw_score, avg_score, std_dev, rank_grade, achievement_level, achievement_ratio_a, achievement_ratio_b, achievement_ratio_c, achievement_ratio_d, achievement_ratio_e, total_students, class_rank, subject_type_id, curriculum_revision_id, subject_id, subject_group_id",
    )
    .in("id", ids);
  if (existingRes.error) {
    return {
      ok: false,
      reason: `성적 조회 실패: ${existingRes.error.message}`,
    };
  }
  const existingById = new Map(
    (existingRes.data ?? []).map((e) => [e.id, e] as const),
  );

  // 5) 권한 필터 + diff 계산.
  const isAdminLike =
    user.role === "admin" ||
    user.role === "consultant" ||
    user.role === "superadmin";

  const meta = await fetchComputationMetaForRows(
    supabase,
    Array.from(existingById.values()),
  );

  let appliedCount = 0;
  let skippedCount = 0;
  const affectedStudents = new Set<string>();

  for (const row of rowsWithId) {
    const existing = existingById.get(row.id);
    if (!existing) {
      skippedCount += 1;
      continue;
    }

    // 권한: 학생은 본인, admin-like 는 동일 tenant.
    if (isAdminLike) {
      if (existing.tenant_id !== tenantId) {
        skippedCount += 1;
        continue;
      }
    } else {
      if (existing.student_id !== user.userId) {
        skippedCount += 1;
        continue;
      }
    }

    // diff 확인 — raw_score / rank_grade 만 편집 대상 (Sprint 1 기준).
    const nextRaw = row.rawScore;
    const nextRank = row.rankGrade;
    const rawChanged = nextRaw !== existing.raw_score;
    const rankChanged = nextRank !== existing.rank_grade;
    if (!rawChanged && !rankChanged) {
      skippedCount += 1;
      continue;
    }

    // 산출값 재계산.
    const merged = {
      ...existing,
      raw_score: nextRaw,
      rank_grade: nextRank,
    };
    const computed = computeFieldsForScore(merged, meta);

    const updates: Parameters<typeof updateInternalScoreData>[3] = {
      raw_score: nextRaw,
      rank_grade: nextRank,
      ...computed,
    };

    const updateRes = await updateInternalScoreData(
      existing.id,
      existing.student_id,
      existing.tenant_id ?? tenantId,
      updates,
    );
    if (!updateRes.success) {
      // 부분 실패는 skipped 로 흡수 — 최종 reason 에는 첫 실패만 노출하지 않고 count 로 안내.
      skippedCount += 1;
      continue;
    }

    appliedCount += 1;
    affectedStudents.add(existing.student_id);

    // audit — admin-like 경로에서만 기록 (audit_logs actorRole 스키마가
    // admin/consultant/superadmin 만 허용). 학생 본인 수정은 별도 자취 없음
    // (기존 updateInternalScore 와 동일 정책).
    if (isAdminLike) {
      void recordAuditLog({
        tenantId: existing.tenant_id ?? tenantId,
        actorId: user.userId,
        actorRole: toAuditActorRole(user.role),
        actorEmail: user.email ?? null,
        action: "update",
        resourceType: "score",
        resourceId: existing.id,
        oldData: {
          raw_score: existing.raw_score,
          rank_grade: existing.rank_grade,
        },
        newData: {
          raw_score: nextRaw,
          rank_grade: nextRank,
        },
        metadata: {
          via: "ai-chat-hitl",
          artifactId: validatedInput.artifactId,
          versionNo,
        },
      });
    }
  }

  if (appliedCount === 0) {
    return {
      ok: false,
      reason:
        skippedCount > 0
          ? `변경점이 없거나 권한이 없어 적용되지 않았습니다. (${skippedCount}건 스킵)`
          : "적용 가능한 행이 없습니다.",
    };
  }

  // 6) risk index 비동기 재계산 (학생별 1회).
  for (const studentId of affectedStudents) {
    recalculateRiskIndex({ studentId, tenantId }).catch(() => {
      // 비동기 실패는 메인 결과에 영향 없음.
    });
  }

  revalidatePath("/scores");
  revalidatePath("/dashboard");

  return {
    ok: true,
    appliedCount,
    skippedCount,
    artifactId: validatedInput.artifactId,
    versionNo,
  };
}

// --- 내부 helpers ---

type ComputationMeta = {
  curriculumYear: number | null;
  subjectTypeMap: Map<
    string,
    { isAchievementOnly: boolean; selectionType: string }
  >;
  gradeExcludedMap: Map<string, boolean>;
  physicalArtsMap: Map<string, boolean>;
};

async function fetchComputationMetaForRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  existings: Array<{
    curriculum_revision_id: string | null;
    subject_type_id: string | null;
    subject_id: string | null;
    subject_group_id: string | null;
  }>,
): Promise<ComputationMeta> {
  const curriculumIds = [
    ...new Set(
      existings.map((e) => e.curriculum_revision_id).filter(Boolean) as string[],
    ),
  ];
  const typeIds = [
    ...new Set(
      existings.map((e) => e.subject_type_id).filter(Boolean) as string[],
    ),
  ];
  const subjectIds = [
    ...new Set(
      existings.map((e) => e.subject_id).filter(Boolean) as string[],
    ),
  ];
  const groupIds = [
    ...new Set(
      existings.map((e) => e.subject_group_id).filter(Boolean) as string[],
    ),
  ];

  const [curriculumRes, typesRes, subjectsRes, groupsRes] = await Promise.all([
    curriculumIds.length > 0
      ? supabase
          .from("curriculum_revisions")
          .select("id, year")
          .in("id", curriculumIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; year: number }>,
          error: null,
        }),
    typeIds.length > 0
      ? supabase
          .from("subject_types")
          .select("id, is_achievement_only, name")
          .in("id", typeIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            is_achievement_only: boolean;
            name: string;
          }>,
          error: null,
        }),
    subjectIds.length > 0
      ? supabase
          .from("subjects")
          .select("id, grade_excluded")
          .in("id", subjectIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; grade_excluded: boolean }>,
          error: null,
        }),
    groupIds.length > 0
      ? supabase
          .from("subject_groups")
          .select("id, is_physical_arts")
          .in("id", groupIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; is_physical_arts: boolean }>,
          error: null,
        }),
  ]);

  const subjectTypeMap = new Map<
    string,
    { isAchievementOnly: boolean; selectionType: string }
  >();
  for (const t of typesRes.data ?? []) {
    subjectTypeMap.set(t.id, {
      isAchievementOnly: t.is_achievement_only,
      selectionType: t.name,
    });
  }
  const gradeExcludedMap = new Map<string, boolean>();
  for (const s of subjectsRes.data ?? []) {
    gradeExcludedMap.set(s.id, s.grade_excluded);
  }
  const physicalArtsMap = new Map<string, boolean>();
  for (const g of groupsRes.data ?? []) {
    physicalArtsMap.set(g.id, g.is_physical_arts);
  }

  // 같은 요청의 모든 row 가 같은 curriculum 을 쓸 확률이 높아 year 는 첫 값 사용.
  const curriculumYear =
    (curriculumRes.data as Array<{ year: number }> | null)?.[0]?.year ?? null;

  return {
    curriculumYear,
    subjectTypeMap,
    gradeExcludedMap,
    physicalArtsMap,
  };
}

function computeFieldsForScore(
  score: {
    raw_score: number | null;
    avg_score: number | null;
    std_dev: number | null;
    rank_grade: number | null;
    achievement_level: string | null;
    achievement_ratio_a: number | null;
    achievement_ratio_b: number | null;
    achievement_ratio_c: number | null;
    achievement_ratio_d: number | null;
    achievement_ratio_e: number | null;
    total_students: number | null;
    class_rank: number | null;
    subject_type_id: string | null;
    subject_id: string | null;
    subject_group_id: string | null;
  },
  meta: ComputationMeta,
): {
  estimated_percentile: number | null;
  estimated_std_dev: number | null;
  converted_grade_9: number | null;
  adjusted_grade: number | null;
} {
  const typeInfo = score.subject_type_id
    ? meta.subjectTypeMap.get(score.subject_type_id)
    : undefined;
  const isAchievementOnly = typeInfo?.isAchievementOnly ?? false;
  const selectionType = typeInfo?.selectionType ?? null;
  const gradeExcluded = score.subject_id
    ? (meta.gradeExcludedMap.get(score.subject_id) ?? false)
    : false;
  const isPhysicalArts = score.subject_group_id
    ? (meta.physicalArtsMap.get(score.subject_group_id) ?? false)
    : false;

  const subjectCategory = determineSubjectCategory(
    isAchievementOnly,
    score.rank_grade,
    score.std_dev,
    selectionType,
    gradeExcluded,
  );

  const achievementScale = getAchievementScale({
    curriculumYear: meta.curriculumYear,
    subjectCategory,
    isPhysicalArts,
  });

  const computed = computeScoreAnalysis({
    rawScore: score.raw_score,
    avgScore: score.avg_score,
    stdDev: score.std_dev,
    rankGrade: score.rank_grade,
    achievementLevel: score.achievement_level,
    ratioA: score.achievement_ratio_a,
    ratioB: score.achievement_ratio_b,
    ratioC: score.achievement_ratio_c,
    ratioD: score.achievement_ratio_d,
    ratioE: score.achievement_ratio_e,
    totalStudents: score.total_students,
    classRank: score.class_rank,
    subjectCategory,
    gradeSystem: determineGradeSystem(meta.curriculumYear),
    achievementScale,
  });

  return {
    estimated_percentile: computed.estimatedPercentile,
    estimated_std_dev: computed.estimatedStdDev,
    converted_grade_9: computed.convertedGrade9,
    adjusted_grade: computed.adjustedGrade,
  };
}

function toAuditActorRole(role: string | null | undefined): AuditActorRole {
  if (role === "superadmin") return "superadmin";
  if (role === "consultant") return "consultant";
  return "admin";
}

// ─── Plan artifact handler (Sprint P2) ───────────────────────────────────────
//
// scores 와 달리 학생 본인이 편집할 수 없음(student RLS 는 read-only). 관리자
// 경로 전용. diff 대상은 plan_status (P5/P6 에서 priority·학기 재배정 확장 예정).

type PlanApplyArgs = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  tenantId: string;
  artifactId: string;
  versionNo: number;
  rawProps: unknown;
};

async function handlePlanApply(
  args: PlanApplyArgs,
): Promise<ApplyArtifactEditOutput> {
  const { supabase, user, tenantId, artifactId, versionNo, rawProps } = args;

  const isAdminLike =
    user.role === "admin" ||
    user.role === "consultant" ||
    user.role === "superadmin";
  if (!isAdminLike) {
    return {
      ok: false,
      reason: "수강 계획 편집은 관리자·컨설턴트만 가능합니다.",
    };
  }

  const propsParse = planPropsSchema.safeParse(rawProps);
  if (!propsParse.success) {
    const issue = propsParse.error.issues[0];
    if (issue?.path.includes("rows") && issue.code === "too_small") {
      return { ok: false, reason: "적용할 계획 행이 없습니다." };
    }
    return {
      ok: false,
      reason: `계획 데이터 형식 오류: ${issue?.message ?? "rows 가 유효하지 않습니다."}`,
    };
  }
  const rows = propsParse.data.rows;

  const ids = rows.map((r) => r.id);
  const existingRes = await supabase
    .from("student_course_plans")
    .select(
      "id, tenant_id, student_id, subject_id, grade, semester, plan_status, priority, source",
    )
    .in("id", ids);
  if (existingRes.error) {
    return { ok: false, reason: `계획 조회 실패: ${existingRes.error.message}` };
  }
  const existingById = new Map(
    (existingRes.data ?? []).map((e) => [e.id, e] as const),
  );

  let appliedCount = 0;
  let skippedCount = 0;
  const affectedStudents = new Set<string>();

  for (const row of rows) {
    const existing = existingById.get(row.id);
    if (!existing || existing.tenant_id !== tenantId) {
      skippedCount += 1;
      continue;
    }

    const statusChanged = existing.plan_status !== row.planStatus;
    const priorityChanged = (existing.priority ?? 0) !== row.priority;
    const slotChanged =
      existing.grade !== row.grade || existing.semester !== row.semester;
    if (!statusChanged && !priorityChanged && !slotChanged) {
      skippedCount += 1;
      continue;
    }

    const updatePayload: {
      plan_status?: PlanRow["planStatus"];
      priority?: number;
      grade?: number;
      semester?: number;
      source: "consultant";
    } = { source: "consultant" };
    if (statusChanged) updatePayload.plan_status = row.planStatus;
    if (priorityChanged) updatePayload.priority = row.priority;
    if (slotChanged) {
      updatePayload.grade = row.grade;
      updatePayload.semester = row.semester;
    }

    const updateRes = await supabase
      .from("student_course_plans")
      .update(updatePayload)
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
    if (updateRes.error) {
      skippedCount += 1;
      continue;
    }

    appliedCount += 1;
    affectedStudents.add(existing.student_id);

    void recordAuditLog({
      tenantId,
      actorId: user.userId,
      actorRole: toAuditActorRole(user.role),
      actorEmail: user.email ?? null,
      action: "update",
      resourceType: "course_plan",
      resourceId: row.id,
      oldData: {
        plan_status: existing.plan_status,
        priority: existing.priority,
        grade: existing.grade,
        semester: existing.semester,
        source: existing.source,
      },
      newData: {
        plan_status: row.planStatus,
        priority: row.priority,
        grade: row.grade,
        semester: row.semester,
        source: "consultant",
      },
      metadata: { via: "ai-chat-hitl", artifactId, versionNo },
    });
  }

  if (appliedCount === 0) {
    return {
      ok: false,
      reason:
        skippedCount > 0
          ? `변경점이 없거나 권한이 없어 적용되지 않았습니다. (${skippedCount}건 스킵)`
          : "적용 가능한 행이 없습니다.",
    };
  }

  // 학생별 상세 페이지 revalidate — admin 경로는 여러 곳에서 수강 계획을 노출.
  for (const studentId of affectedStudents) {
    revalidatePath(`/admin/students/${studentId}`);
  }
  revalidatePath("/admin/students");

  return { ok: true, appliedCount, skippedCount, artifactId, versionNo };
}
