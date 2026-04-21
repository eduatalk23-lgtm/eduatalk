/**
 * Phase G S-3-a: designStudentPlan — plan-sub 위임 MCP tool.
 *
 * Shell 이 조회 tool 만으로 해결할 수 없는 "수강 계획 설계·적합도 분석·충돌 해결"
 * 요청을 만나면 이 tool 을 호출한다. 내부적으로 planSub 서브에이전트가 6 tool 로
 * end-to-end 처리한 뒤 구조화된 요약을 반환한다.
 *
 * Layer 1 가드: admin/consultant/superadmin 만 tool 을 볼 수 있어야 한다
 *  (roleFilter.ADMIN_ONLY_TOOL_NAMES 에 등록). Layer 2 는 runSubagent 내부.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/lib/agents/types";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";
import { runSubagent } from "@/lib/mcp/subagents/_shared/subagentRunner";
import { planSub } from "@/lib/mcp/subagents/plan-sub";

function resolveSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

/**
 * Phase C-3 Sprint P1 (2026-04-21): Artifact 편집 지원용 row snapshot.
 *
 * PlanCard 가 테이블로 렌더하고, applyArtifactEdit 가 plan_status 변경을
 * `student_course_plans.id` 로 뒤에 writeback 할 수 있도록 **DB row id 를
 * 보존한 형태**로 함께 전달한다. LLM 은 rows 를 해석할 필요가 없고 summary
 * 만 사용하면 된다(prompt 에서 강제).
 */
export type PlanRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  semester: number;
  planStatus: "recommended" | "confirmed" | "rejected" | "completed";
  source: "auto" | "consultant" | "student" | "import";
  priority: number;
  notes: string | null;
};

export type DesignStudentPlanOutput =
  | {
      ok: true;
      runId: string;
      studentId: string;
      studentName: string | null;
      durationMs: number;
      stepCount: number;
      summary: {
        headline: string;
        adequacyScore?: number;
        keyFindings: string[];
        conflicts: string[];
        recommendedCourses: string[];
        recommendedActions: string[];
        artifactIds: string[];
        followUpQuestions?: string[];
      };
      /**
       * Sprint P1: planSub 실행 직후 `student_course_plans` 재조회 결과.
       * PlanCard 편집 / applyArtifactEdit(type='plan') 의 SSOT.
       * planSub 이 추천을 생성하지 않은 경우에도 학생의 전체 계획을 반환
       * (빈 배열 가능).
       */
      rows: PlanRow[];
    }
  | { ok: false; reason: string; runId?: string | null };

export const designStudentPlanDescription =
  "학생의 수강 계획을 설계합니다. 조회 tool(getStudentOverview/getStudentRecords) 만으로는 해결할 수 없는 요청 — 전공 계열 교과이수적합도 계산·추천 과목 생성·수강 계획 충돌 검사·계획 개선안 제시 — 에만 호출합니다. admin/consultant 전용. 실행에 최대 40초가 걸리므로 사용자에게 '수강 계획을 분석 중입니다, 잠시만 기다려 주세요'로 먼저 안내하세요. 내부에서 plan-sub 서브에이전트가 end-to-end 처리 후 요약 카드를 반환합니다.";

export const designStudentPlanInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("대상 학생 이름. 같은 테넌트에서만 검색됨."),
  request: z
    .string()
    .min(4)
    .max(1000)
    .describe(
      "자연어로 서브에이전트가 수행할 작업 요약. 예: '경영 계열로 추천 과목 다시 뽑고 충돌 검사해줘', '2학년 2학기 수강 계획 적합도 점검', '국제통상학 기준 수강 로드맵 제안'",
    ),
} as const;

export const designStudentPlanInputSchema = z.object(
  designStudentPlanInputShape,
);

export type DesignStudentPlanInput = z.infer<
  typeof designStudentPlanInputSchema
>;

export async function designStudentPlanExecute({
  studentName,
  request,
}: DesignStudentPlanInput): Promise<DesignStudentPlanOutput> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "designStudentPlan 은 admin/consultant 전용입니다.",
    };
  }

  const target = await resolveStudentTarget({ studentName });
  if (!target.ok) return { ok: false, reason: target.reason };

  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("grade, school_name, target_major, curriculum_revision")
    .eq("id", target.studentId)
    .eq("tenant_id", target.tenantId)
    .maybeSingle();

  if (!student) {
    return { ok: false, reason: "학생 프로필을 조회할 수 없습니다." };
  }

  let schoolCategory: string | null = null;
  if (student.school_name) {
    const { data: profile } = await supabase
      .from("school_profiles")
      .select("school_category")
      .eq("school_name", student.school_name)
      .eq("tenant_id", target.tenantId)
      .maybeSingle();
    schoolCategory = profile?.school_category ?? null;
  }

  const ctx: AgentContext = {
    userId: user.userId,
    role: user.role,
    tenantId: target.tenantId,
    studentId: target.studentId,
    studentName: target.studentName ?? studentName,
    schoolYear: resolveSchoolYear(),
    uiState: null,
    studentGrade: student.grade ?? null,
    schoolName: student.school_name ?? null,
    schoolCategory,
    targetMajor: student.target_major ?? null,
    curriculumRevision: student.curriculum_revision ?? null,
  };

  const result = await runSubagent({
    def: planSub,
    ctx,
    input: request,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, runId: result.runId };
  }

  // Sprint P1: planSub 실행 완료 후 student_course_plans 재조회 → PlanCard·
  // applyArtifactEdit 이 사용할 rows 스냅샷 구축. 실패해도 tool 자체는 성공
  // 으로 취급(rows=[]) — read-only 렌더는 가능.
  const rows = await fetchPlanRows(
    supabase,
    target.tenantId,
    target.studentId,
  );

  return {
    ok: true,
    runId: result.runId,
    studentId: target.studentId,
    studentName: target.studentName,
    durationMs: result.durationMs,
    stepCount: result.stepCount,
    summary: {
      headline: result.summary.headline,
      adequacyScore: result.summary.adequacyScore,
      keyFindings: result.summary.keyFindings ?? [],
      conflicts: result.summary.conflicts ?? [],
      recommendedCourses: result.summary.recommendedCourses ?? [],
      recommendedActions: result.summary.recommendedActions ?? [],
      artifactIds: result.summary.artifactIds ?? [],
      followUpQuestions: result.summary.followUpQuestions,
    },
    rows,
  };
}

/**
 * student_course_plans + subjects.name 병렬 조회 → PlanRow[] 빌드.
 * planSub 이 추천을 쓰지 않은 경우에도 학생의 기존 계획을 반환.
 * 에러는 흡수 — 빈 배열로 fallback.
 */
async function fetchPlanRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  studentId: string,
): Promise<PlanRow[]> {
  const plansRes = await supabase
    .from("student_course_plans")
    .select(
      "id, subject_id, grade, semester, plan_status, source, priority, notes",
    )
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("priority", { ascending: true });

  if (plansRes.error || !plansRes.data || plansRes.data.length === 0) {
    return [];
  }

  const subjectIds = Array.from(
    new Set(plansRes.data.map((r) => r.subject_id).filter(Boolean)),
  );
  const subjectsRes =
    subjectIds.length > 0
      ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
      : { data: [] as Array<{ id: string; name: string }>, error: null };

  const nameById = new Map(
    (subjectsRes.data ?? []).map((s) => [s.id, s.name] as const),
  );

  return plansRes.data.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    subjectName: nameById.get(r.subject_id) ?? "(알 수 없음)",
    grade: r.grade,
    semester: r.semester,
    planStatus: r.plan_status as PlanRow["planStatus"],
    source: r.source as PlanRow["source"],
    priority: r.priority ?? 0,
    notes: r.notes,
  }));
}
