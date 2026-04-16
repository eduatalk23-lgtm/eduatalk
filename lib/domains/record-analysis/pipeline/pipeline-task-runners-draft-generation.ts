// ============================================
// P7: draft_generation — 설계 모드 전용 AI 가안 생성
//
// 방향 가이드(P4-P6) 결과를 기반으로 세특/창체/행특 AI 초안을 생성.
// NEIS 기록이 없는 설계 모드 학년에서만 실행. 분석 모드는 스킵.
//
// B6 (2026-04-15): 청크화 지원 (B5 draft_analysis 패턴 이식)
//   - runDraftGenerationForGrade: 단일 호출 (기존, 호환)
//   - runDraftGenerationChunkForGrade: 청크 단위 실행 (hasMore/totalUncached)
// ============================================

import { assertGradeCtx, type PipelineContext } from "./pipeline-types";
import type { TaskRunnerOutput } from "./pipeline-executor";
import { generateTextWithRateLimit } from "../llm/ai-client";
import * as guideRepo from "@/lib/domains/student-record/repository/guide-repository";
import { withRetry } from "../llm/retry";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { getCharLimit, PIPELINE_THRESHOLDS, COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import type { CompetencyArea } from "@/lib/domains/student-record/types";
import { computeLevelingForStudent } from "@/lib/domains/student-record/leveling";
import {
  SETEK_DRAFT_SYSTEM_PROMPT,
  CHANGCHE_DRAFT_SYSTEM_PROMPT,
  HAENGTEUK_DRAFT_SYSTEM_PROMPT,
} from "../llm/prompts/draft-system-prompts";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_CTX = { domain: "record-analysis", action: "draftGeneration" };

const COMPETENCY_AREA_BY_CODE = new Map<string, CompetencyArea>(
  COMPETENCY_ITEMS.map((item) => [item.code, item.area] as const),
);

const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율활동", club: "동아리활동", career: "진로활동" };

/**
 * L4-E: ctx.analysisContext에 채워진 prior grade weakCompetencies를 area set으로 환산.
 * 1학년 또는 prior 분석 미수행 시 빈 Set 반환 → 정렬은 기존 동작.
 */
function collectPriorWeakAreas(ctx: PipelineContext): Set<CompetencyArea> {
  const out = new Set<CompetencyArea>();
  const buckets = ctx.analysisContext;
  if (!buckets) return out;
  for (const grade of Object.keys(buckets)) {
    const ac = buckets[Number(grade)];
    if (!ac) continue;
    for (const w of ac.weakCompetencies) {
      const area = COMPETENCY_AREA_BY_CODE.get(w.item);
      if (area) out.add(area);
    }
  }
  return out;
}

// ─── Private 헬퍼 ──

/**
 * subject_id 목록 → { id: name } 맵 조회 (supabase 직접 인스턴스 사용).
 * draft generation 내부 전용. 파이프라인 컨텍스트의 supabase 인스턴스를 그대로 받아 재사용.
 */
export async function fetchSubjectNames(
  supabase: SupabaseClient,
  subjectIds: string[],
): Promise<Map<string, string>> {
  if (subjectIds.length === 0) return new Map();
  const { data } = (await supabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds)) as { data: Array<{ id: string; name: string }> | null };
  const map = new Map<string, string>();
  for (const s of data ?? []) map.set(s.id, s.name);
  return map;
}

/** 시스템 프롬프트에 레벨 디렉티브 주입 */
export function withLevelDirective(basePrompt: string, levelDirective: string | null): string {
  if (!levelDirective) return basePrompt;
  return `${basePrompt}\n\n## 난이도 기준\n${levelDirective}`;
}

/**
 * AI 가안 생성 후 DB에 저장하는 공통 헬퍼.
 * @returns 생성 성공 시 true, 빈 응답이면 false
 */
export async function generateAndSaveDraft(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  systemPrompt: string,
  userPrompt: string,
  levelDirective: string | null,
  label: string,
): Promise<boolean> {
  const result = await withRetry(
    () => generateTextWithRateLimit({
      system: withLevelDirective(systemPrompt, levelDirective),
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.5,
      maxTokens: PIPELINE_THRESHOLDS.DEFAULT_DRAFT_MAX_TOKENS,
    }),
    { label },
  );

  if (!result.content?.trim()) {
    logActionDebug(LOG_CTX, `draft empty for ${recordId}`);
    return false;
  }

  const { error: updateErr } = await supabase
    .from(tableName)
    .update({
      ai_draft_content: result.content.trim(),
      ai_draft_at: new Date().toISOString(),
      ai_draft_status: "done",
    })
    .eq("id", recordId);

  if (updateErr) {
    logActionError(LOG_CTX, updateErr, { recordId, phase: `draft_generation_${label}` });
  }

  return true;
}

// ============================================
// B6: PendingDraftItem — collect/process 분리용 타입
// ============================================

type PendingDraftItem =
  | {
      kind: "setek";
      recordId: string;
      semester: number;
      subjectName: string;
      guide: { direction: string; keywords: string[] };
    }
  | {
      kind: "changche";
      recordId: string;
      activityType: string;
      label: string;
      charLimit: number;
      guide: { direction: string; keywords: string[]; teacherPoints: string[] };
    }
  | {
      kind: "haengteuk";
      recordId: string;
      charLimit: number;
      guide: { direction: string; keywords: string[] };
    };

/**
 * 설계 학년에서 아직 가안이 생성되지 않은 pending 레코드 수집.
 * 정렬 순서: setek (L4-E 진로교과 우선 → 학기순) → changche → haengteuk.
 * 이미 ai_draft_content 있는 레코드, 방향 가이드 없는 레코드는 제외.
 */
async function collectPendingDraftItems(
  ctx: PipelineContext,
  targetSchoolYear: number,
): Promise<PendingDraftItem[]> {
  const { studentId, targetGrade, supabase } = ctx;
  if (targetGrade == null) return [];

  const pending: PendingDraftItem[] = [];

  // ─── 세특 ─────────────────────────────────────────
  const { data: setekRecords } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id, semester, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .order("semester", { ascending: true });

  if (setekRecords && setekRecords.length > 0) {
    const setekGuides = await guideRepo.findSetekGuideDirectionsForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );
    const guideMap = new Map<string, { direction: string; keywords: string[] }>();
    for (const g of setekGuides) {
      guideMap.set(g.subject_id, { direction: g.direction, keywords: g.keywords ?? [] });
    }

    const subjectIds = [...new Set(setekRecords.map((r: { subject_id: string }) => r.subject_id))];
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name, subject_type:subject_type_id(name)")
      .in("id", subjectIds);
    const subjectNameMap = new Map<string, string>();
    const careerSubjectIds = new Set<string>();
    for (const s of (subjects ?? []) as Array<{ id: string; name: string; subject_type?: { name?: string } | null }>) {
      subjectNameMap.set(s.id, s.name);
      const typeName = s.subject_type?.name ?? "";
      if (typeName.includes("진로") || typeName.includes("전문")) careerSubjectIds.add(s.id);
    }

    const priorWeakAreas = collectPriorWeakAreas(ctx);
    const careerWeak = priorWeakAreas.has("career");
    const academicWeak = priorWeakAreas.has("academic");
    const sortedRecords = [...(setekRecords as Array<{ id: string; subject_id: string; semester: number; content: string | null; ai_draft_content: string | null }>)]
      .sort((a, b) => {
        const aCareer = careerSubjectIds.has(a.subject_id);
        const bCareer = careerSubjectIds.has(b.subject_id);
        const aTier = aCareer ? (careerWeak ? 0 : 1) : (academicWeak ? 2 : 3);
        const bTier = bCareer ? (careerWeak ? 0 : 1) : (academicWeak ? 2 : 3);
        return aTier - bTier || a.semester - b.semester;
      });

    for (const record of sortedRecords) {
      if (record.ai_draft_content?.trim()) continue;
      const guide = guideMap.get(record.subject_id);
      if (!guide?.direction) continue;
      pending.push({
        kind: "setek",
        recordId: record.id,
        semester: record.semester,
        subjectName: subjectNameMap.get(record.subject_id) ?? "과목",
        guide,
      });
    }
  }

  // ─── 창체 ─────────────────────────────────────────
  const { data: changcheRecords } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (changcheRecords && changcheRecords.length > 0) {
    const changcheGuides = await guideRepo.findChangcheGuideDirectionsForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );
    const guideMap = new Map<string, { direction: string; keywords: string[]; teacherPoints: string[] }>();
    for (const g of changcheGuides) {
      guideMap.set(g.activity_type, {
        direction: g.direction,
        keywords: g.keywords ?? [],
        teacherPoints: g.teacher_points ?? [],
      });
    }

    for (const record of changcheRecords as Array<{ id: string; activity_type: string; content: string | null; ai_draft_content: string | null }>) {
      if (record.ai_draft_content?.trim()) continue;
      const guide = guideMap.get(record.activity_type);
      if (!guide?.direction) continue;
      pending.push({
        kind: "changche",
        recordId: record.id,
        activityType: record.activity_type,
        label: ACTIVITY_LABELS[record.activity_type] ?? record.activity_type,
        charLimit: getCharLimit(record.activity_type as "autonomy" | "club" | "career", targetSchoolYear),
        guide,
      });
    }
  }

  // ─── 행특 ─────────────────────────────────────────
  const { data: haengteukRecord } = await supabase
    .from("student_record_haengteuk")
    .select("id, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .maybeSingle();

  if (haengteukRecord && !haengteukRecord.ai_draft_content?.trim()) {
    const haengteukGuide = await guideRepo.findHaengteukGuideDirectionForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );
    if (haengteukGuide?.direction) {
      pending.push({
        kind: "haengteuk",
        recordId: haengteukRecord.id,
        charLimit: getCharLimit("haengteuk", targetSchoolYear),
        guide: { direction: haengteukGuide.direction, keywords: haengteukGuide.keywords ?? [] },
      });
    }
  }

  return pending;
}

/**
 * 행특 프롬프트 조립 시 "이 학년의 다른 기록 방향" 컨텍스트로 쓸
 * 이미 DB에 가안이 생성된 세특/창체 라벨 목록 조회 (청크 간 유지).
 */
async function fetchAlreadyGeneratedLabels(
  ctx: PipelineContext,
  targetSchoolYear: number,
): Promise<string[]> {
  const { studentId, supabase } = ctx;
  const out: string[] = [];

  const { data: setekDone } = await supabase
    .from("student_record_seteks")
    .select("subject_id, ai_draft_content, subjects:subject_id(name)")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .not("ai_draft_content", "is", null);
  for (const r of (setekDone ?? []) as Array<{ ai_draft_content: string | null; subjects?: { name?: string } | { name?: string }[] | null }>) {
    if (!r.ai_draft_content?.trim()) continue;
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (name) out.push(`세특:${name}`);
  }

  const { data: changcheDone } = await supabase
    .from("student_record_changche")
    .select("activity_type, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .not("ai_draft_content", "is", null);
  for (const r of (changcheDone ?? []) as Array<{ activity_type: string; ai_draft_content: string | null }>) {
    if (!r.ai_draft_content?.trim()) continue;
    out.push(`창체:${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}`);
  }

  return out;
}

/**
 * 단일 PendingDraftItem 처리 — LLM 호출 + DB 저장.
 * @returns { saved, label } — 생성 성공 시 saved=true, label은 summary 용도
 */
async function processDraftItem(
  ctx: PipelineContext,
  item: PendingDraftItem,
  levelDirective: string | null,
  targetSchoolYear: number,
): Promise<{ saved: boolean; label: string }> {
  const { supabase, targetGrade } = ctx;

  // Blueprint 섹션 — 설계 모드 P7 가안에 정합성 주입 (2026-04-16 D 결정 5)
  let blueprintContextSection = "";
  if (ctx.gradeMode === "design" && ctx.blueprint) {
    const { buildBlueprintGuideSection } = await import(
      "@/lib/domains/record-analysis/llm/prompts/blueprintGuideSection"
    );
    const section = buildBlueprintGuideSection(ctx.blueprint, [targetGrade]);
    if (section) blueprintContextSection = `\n\n${section}\n`;
  }

  if (item.kind === "setek") {
    const userPrompt = `## 과목: ${item.subjectName} (${targetGrade}학년 ${item.semester}학기)\n\n## 세특 방향\n${item.guide.direction}\n\n## 포함할 키워드\n${item.guide.keywords.join(", ")}${blueprintContextSection}\n\n위 정보를 바탕으로 NEIS 500자 이내의 세특 초안을 작성해주세요.`;
    try {
      const saved = await generateAndSaveDraft(
        supabase,
        "student_record_seteks",
        item.recordId,
        SETEK_DRAFT_SYSTEM_PROMPT,
        userPrompt,
        levelDirective,
        "draftSetek",
      );
      if (saved) logActionDebug(LOG_CTX, `세특 가안 생성: ${item.subjectName}`, { recordId: item.recordId });
      return { saved, label: `세특:${item.subjectName}` };
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: item.recordId, subject: item.subjectName });
      return { saved: false, label: `세특:${item.subjectName}` };
    }
  }

  if (item.kind === "changche") {
    const teacherSection = item.guide.teacherPoints.length > 0
      ? `## 교사 관찰 포인트\n${item.guide.teacherPoints.join("\n")}\n\n`
      : "";
    const userPrompt = `## 활동유형: ${item.label} (${targetGrade}학년)\n\n## 방향\n${item.guide.direction}\n\n## 포함할 키워드\n${item.guide.keywords.join(", ")}${blueprintContextSection}\n\n${teacherSection}${item.charLimit}자 이내의 ${item.label} 특기사항 초안을 작성해주세요.`;
    try {
      const saved = await generateAndSaveDraft(
        supabase,
        "student_record_changche",
        item.recordId,
        CHANGCHE_DRAFT_SYSTEM_PROMPT,
        userPrompt,
        levelDirective,
        "draftChangche",
      );
      return { saved, label: `창체:${item.label}` };
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: item.recordId, activityType: item.activityType });
      return { saved: false, label: `창체:${item.label}` };
    }
  }

  // haengteuk: DB 에서 이미 생성된 세특/창체 라벨 조회하여 컨텍스트 주입 (청크 간 누적)
  const alreadyGenerated = await fetchAlreadyGeneratedLabels(ctx, targetSchoolYear);
  let userPrompt = `## 행동특성 및 종합의견 (${targetGrade}학년)\n\n## 방향\n${item.guide.direction}\n\n`;
  if (item.guide.keywords.length > 0) {
    userPrompt += `## 키워드\n${item.guide.keywords.join(", ")}\n\n`;
  }
  if (blueprintContextSection) {
    userPrompt += `${blueprintContextSection.trim()}\n\n`;
  }
  if (alreadyGenerated.length > 0) {
    userPrompt += `## 이 학년의 다른 기록\n이 학년에서 ${alreadyGenerated.join(", ")} 등의 방향이 설정되어 있습니다. 이를 참고하여 행특을 작성해주세요.\n\n`;
  }
  userPrompt += `${item.charLimit}자 이내의 행동특성 및 종합의견 초안을 작성해주세요.`;

  try {
    const saved = await generateAndSaveDraft(
      supabase,
      "student_record_haengteuk",
      item.recordId,
      HAENGTEUK_DRAFT_SYSTEM_PROMPT,
      userPrompt,
      levelDirective,
      "draftHaengteuk",
    );
    return { saved, label: "행특" };
  } catch (err) {
    logActionError(LOG_CTX, err, { recordId: item.recordId });
    return { saved: false, label: "행특" };
  }
}

/**
 * 레벨링 산출 (없으면 계산 후 ctx 에 캐시) + targetSchoolYear 계산.
 */
async function resolveLevelingAndSchoolYear(
  ctx: PipelineContext,
): Promise<{ levelDirective: string | null; targetSchoolYear: number }> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  if (!ctx.leveling) {
    try {
      ctx.leveling = await computeLevelingForStudent({
        studentId,
        tenantId,
        grade: targetGrade,
      });
      logActionDebug(LOG_CTX, `레벨링 산출: L${ctx.leveling.adequateLevel} (${ctx.leveling.tierLabel}, gap=${ctx.leveling.gap})`, { studentId, targetGrade });
    } catch (err) {
      logActionError(LOG_CTX, err, { step: "leveling", studentId });
    }
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  return {
    levelDirective: ctx.leveling?.levelDirective ?? null,
    targetSchoolYear,
  };
}

// ─── 메인 Runner (단일 호출, 호환용) ──

export async function runDraftGenerationForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (gradeResolved?.hasAnyNeis) {
    return "분석 모드 학년 — 가안 생성 스킵 (NEIS 기록 기반)";
  }

  const { levelDirective, targetSchoolYear } = await resolveLevelingAndSchoolYear(ctx);
  const pending = await collectPendingDraftItems(ctx, targetSchoolYear);

  if (pending.length === 0) {
    return "설계 모드 — 가안 생성 대상 없음 (방향 가이드 미생성 또는 이미 생성됨)";
  }

  let attempted = 0;
  const generatedLabels: string[] = [];
  for (const item of pending) {
    attempted++;
    const { saved, label } = await processDraftItem(ctx, item, levelDirective, targetSchoolYear);
    if (saved) generatedLabels.push(label);
  }

  // B7: 완결성 가드 — 시도 대비 생성 비율이 90% 미만이면 failed 처리
  const ratio = generatedLabels.length / attempted;
  if (ratio < 0.9) {
    throw new Error(
      `draft_generation 부분 실행: ${generatedLabels.length}/${attempted}건만 생성 (${(ratio * 100).toFixed(0)}% < 90%)`,
    );
  }

  return `설계 모드 가안 ${generatedLabels.length}/${attempted}건 생성: ${generatedLabels.join(", ")}`;
}

// ─── 청크 Runner (B6, B5 패턴) ──

export async function runDraftGenerationChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (gradeResolved?.hasAnyNeis) {
    return {
      preview: "분석 모드 학년 — 가안 생성 스킵 (NEIS 기록 기반)",
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const { levelDirective, targetSchoolYear } = await resolveLevelingAndSchoolYear(ctx);
  const pending = await collectPendingDraftItems(ctx, targetSchoolYear);

  const totalUncached = pending.length;
  if (totalUncached === 0) {
    return {
      preview: "설계 모드 — 가안 생성 대상 없음 (방향 가이드 미생성 또는 이미 생성됨)",
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const toProcess = pending.slice(0, chunkSize);
  const hasMore = totalUncached > chunkSize;

  let attempted = 0;
  const generatedLabels: string[] = [];
  for (const item of toProcess) {
    attempted++;
    const { saved, label } = await processDraftItem(ctx, item, levelDirective, targetSchoolYear);
    if (saved) generatedLabels.push(label);
  }

  // B7: 청크 단위 완결성 가드 — 한 청크 내 실패율 10% 초과 시 throw
  const ratio = attempted > 0 ? generatedLabels.length / attempted : 1;
  if (attempted > 0 && ratio < 0.9) {
    throw new Error(
      `draft_generation 청크 부분 실행: ${generatedLabels.length}/${attempted}건만 생성 (${(ratio * 100).toFixed(0)}% < 90%)`,
    );
  }

  // 무한 루프 가드: 청크가 아무 진행도 못 했으면 throw (pending 이 줄지 않아 client 가 loop)
  if (attempted === 0 && totalUncached > 0) {
    throw new Error(
      `draft_generation 청크 진행 정지: pending ${totalUncached}건인데 처리 0건`,
    );
  }

  const remainingHint = hasMore ? ` · 잔여 ${totalUncached - toProcess.length}건` : "";
  return {
    preview: `설계 모드 가안 ${generatedLabels.length}/${attempted}건 생성${remainingHint}`,
    hasMore,
    totalUncached,
    chunkProcessed: attempted,
  };
}
