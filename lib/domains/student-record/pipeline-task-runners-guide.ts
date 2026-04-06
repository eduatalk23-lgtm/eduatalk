// ============================================
// 가이드 생성 태스크 러너 (Grade Pipeline P4-P6)
// 7: runSetekGuide
// 8: runChangcheGuide
// 9: runHaengteukGuide
// 5-b: runSlotGeneration
// G2: runSetekGuideForGrade
// G3: runChangcheGuideForGrade
// G4: runHaengteukGuideForGrade
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertGradeCtx,
  type PipelineContext,
  TaskRunnerOutput,
} from "./pipeline-types";
import type { PersistedEdge } from "./edge-repository";
import type { CrossRefEdge } from "./cross-reference";
import * as diagnosisRepo from "./diagnosis-repository";
import { ACTIVITY_TYPE_LABELS } from "./constants";
import { toGuideAnalysisContext, mergeGuideAnalysisContexts } from "./pipeline-task-runners-shared";

const LOG_CTX = { domain: "student-record", action: "pipeline-guide" };

// ============================================
// 공통 헬퍼
// ============================================

/** 개선 우선순위 섹션 빌드 (세특 방향에 주입) */
async function buildImprovementsSection(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<string | undefined> {
  const diagForGuide = await diagnosisRepo.findDiagnosis(studentId, schoolYear, tenantId, "ai");
  if (!diagForGuide || !Array.isArray(diagForGuide.improvements) || (diagForGuide.improvements as unknown[]).length === 0) {
    return undefined;
  }
  const imps = diagForGuide.improvements as Array<{ priority: string; area: string; action: string }>;
  return `## 개선 우선순위 (세특 방향에 반영)\n${imps.map((i) => `- [${i.priority}] ${i.area}: ${i.action}`).join("\n")}`;
}

/** report 1회 fetch + 에러 처리 */
async function fetchReportOrThrow(
  studentId: string,
  errorLabel: string,
): Promise<import("./actions/report").ReportData> {
  const { fetchReportData } = await import("./actions/report");
  const result = await fetchReportData(studentId);
  if (!result.success || !result.data) {
    throw new Error(result.success === false ? result.error : `${errorLabel} 리포트 데이터 수집 실패`);
  }
  return result.data;
}

// ============================================
// 7. 세특 방향 가이드
// ============================================

export async function runSetekGuide(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  const { studentId, tenantId } = ctx;
  const hasNeisGrades = ctx.neisGrades && ctx.neisGrades.length > 0;
  const hasConsultingGrades = ctx.consultingGrades && ctx.consultingGrades.length > 0;

  // 공통 컨텍스트 준비
  let guideEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("./edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }
  const { buildGuideContextSection } = await import("./guide-context");
  const guideContextSection = await buildGuideContextSection(studentId, "guide");

  const currentYear = calculateSchoolYear();
  const improvementsSection = await buildImprovementsSection(studentId, currentYear, tenantId);

  const extraSections = [guideEdgeSection, guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;
  const results: string[] = [];

  // report 1회 fetch — NEIS+consulting 양쪽에서 공유
  let sharedReport: import("./actions/report").ReportData | undefined;
  if (hasNeisGrades || hasConsultingGrades) {
    sharedReport = await fetchReportOrThrow(studentId, "세특 방향");
  }

  // NEIS 학년 → 분석형 세특 가이드 (NEIS 데이터 기반)
  if (hasNeisGrades) {
    const { analyzeSetekGuide } = await import("./llm/actions/guide-modules");
    const mergedAnalysisCtx = mergeGuideAnalysisContexts(
      ctx.neisGrades!.map((g) => toGuideAnalysisContext(ctx.analysisContext?.[g])),
    );
    const result = await analyzeSetekGuide(studentId, ctx.neisGrades!, extraSections, undefined, mergedAnalysisCtx, sharedReport);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    if (guides) results.push(`NEIS ${guides.length}과목`);
  }

  // 컨설팅 학년 → 수강계획 기반 세특 방향 (학년별 개별 호출 — 타임아웃 안전)
  if (hasConsultingGrades) {
    const { generateSetekDirection } = await import("./llm/actions/guide-modules");
    const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
    const { userId: guideUserId } = await reqAuth();
    for (const grade of ctx.consultingGrades!) {
      const targetSchoolYear = currentYear - ctx.studentGrade + grade;
      const gradeAnalysisCtx = toGuideAnalysisContext(ctx.analysisContext?.[grade]);
      const result = await generateSetekDirection(
        studentId, tenantId, guideUserId,
        sharedReport!, [grade], extraSections, targetSchoolYear, gradeAnalysisCtx,
      );
      if (!result.success) {
        logActionWarn(LOG_CTX, `세특 방향 생성 실패 (grade ${grade})`, { studentId, error: result.error });
        continue;
      }
      const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
      if (guides) results.push(`${grade}학년 방향 ${guides.length}과목`);
    }
  }

  return results.length > 0 ? results.join(", ") : "세특 방향 생성 완료";
}

// ============================================
// 8. 창체 방향 가이드
// ============================================

export async function runChangcheGuide(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, coursePlanData } = ctx;

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const report = await fetchReportOrThrow(studentId, "창체 방향");

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateChangcheDirection } = await import("./llm/actions/guide-modules");
    // 세특 방향 컨텍스트 (setek_guide 결과 있으면 전달)
    const currentYear = calculateSchoolYear();
    let setekCtx: string | undefined;
    const { data: setekRows } = await supabase
      .from("student_record_setek_guides")
      .select("direction, keywords")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentYear)
      .eq("source", "ai")
      .limit(4);
    if (setekRows && setekRows.length > 0) {
      const lines = setekRows.map((r) =>
        `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
      );
      setekCtx = `## 세특 방향 요약\n${lines.join("\n")}`;
    }
    const allGradesCtx = mergeGuideAnalysisContexts(
      (ctx.consultingGrades ?? []).map((g) => toGuideAnalysisContext(ctx.analysisContext?.[g])),
    );
    const result = await generateChangcheDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      report, coursePlanData ?? null, undefined, setekCtx, undefined, allGradesCtx,
    );
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
    return guides ? `${guides.length}개 활동유형 방향 생성 (예비)` : "창체 방향 생성 완료 (예비)";
  }

  // NEIS 있음 → 분석 모듈
  const { analyzeChangcheGuide } = await import("./llm/actions/guide-modules");
  // Phase E2: 엣지 데이터 → 창체 가이드 프롬프트에 투입
  let guideEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("./edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }

  // 세특 방향 컨텍스트 — setek_guide DB 결과에서 요약 구성
  let setekGuideContext: string | undefined;
  const currentYear = calculateSchoolYear();
  const { data: setekRows } = await supabase
    .from("student_record_setek_guides")
    .select("subject_id, direction, keywords, competency_focus")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentYear)
    .eq("source", "ai")
    .limit(6);
  if (setekRows && setekRows.length > 0) {
    // subject_id → 과목명 조회
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", setekRows.map((r) => r.subject_id));
    const subMap = new Map((subs ?? []).map((s) => [s.id, s.name]));
    const lines = setekRows.map((r) =>
      `- ${subMap.get(r.subject_id) ?? r.subject_id}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
    );
    setekGuideContext = `## 세특 방향 요약\n${lines.join("\n")}`;
  }

  const mergedCtxChangche = mergeGuideAnalysisContexts(
    (ctx.neisGrades ?? []).map((g) => toGuideAnalysisContext(ctx.analysisContext?.[g])),
  );
  const result = await analyzeChangcheGuide(studentId, undefined, guideEdgeSection, setekGuideContext, undefined, mergedCtxChangche, report);
  if (!result.success) throw new Error(result.error);
  const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
  return guides ? `${guides.length}개 활동유형 방향 생성` : "창체 방향 생성 완료";
}

// ============================================
// 9. 행특 방향 가이드
// ============================================

export async function runHaengteukGuide(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, coursePlanData } = ctx;

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const report = await fetchReportOrThrow(studentId, "행특 방향");

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateHaengteukDirection } = await import("./llm/actions/guide-modules");
    // 창체 방향 컨텍스트 (changche_guide 결과 있으면 전달)
    const currentYear = calculateSchoolYear();
    let changcheCtx: string | undefined;
    const { data: changcheRows } = await supabase
      .from("student_record_changche_guides")
      .select("activity_type, direction, keywords")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentYear)
      .eq("source", "ai")
      .limit(3);
    if (changcheRows && changcheRows.length > 0) {
      const lines = changcheRows.map((r) =>
        `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
      );
      changcheCtx = `## 창체 방향 요약\n${lines.join("\n")}`;
    }
    const allGradesCtxH = mergeGuideAnalysisContexts(
      (ctx.consultingGrades ?? []).map((g) => toGuideAnalysisContext(ctx.analysisContext?.[g])),
    );
    const result = await generateHaengteukDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      report, coursePlanData ?? null, undefined, changcheCtx, undefined, allGradesCtxH,
    );
    if (!result.success) throw new Error(result.error);
    return "행특 방향 생성 완료 (예비)";
  }

  // NEIS 있음 → 분석 모듈
  const { analyzeHaengteukGuide } = await import("./llm/actions/guide-modules");
  // Phase E2: 엣지 데이터 → 행특 가이드 프롬프트에 투입
  let guideEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("./edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }

  // 창체 방향 컨텍스트 — changche_guide DB 결과에서 요약 구성
  let changcheGuideContext: string | undefined;
  const currentYear = calculateSchoolYear();
  const { data: changcheRows } = await supabase
    .from("student_record_changche_guides")
    .select("activity_type, direction, keywords")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentYear)
    .eq("source", "ai")
    .limit(3);
  if (changcheRows && changcheRows.length > 0) {
    const lines = changcheRows.map((r) =>
      `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
    );
    changcheGuideContext = `## 창체 방향 요약\n${lines.join("\n")}`;
  }

  const mergedCtxHaengteuk = mergeGuideAnalysisContexts(
    (ctx.neisGrades ?? []).map((g) => toGuideAnalysisContext(ctx.analysisContext?.[g])),
  );
  const result = await analyzeHaengteukGuide(studentId, undefined, guideEdgeSection, changcheGuideContext, undefined, mergedCtxHaengteuk, report);
  if (!result.success) throw new Error(result.error);
  return "행특 방향 생성 완료";
}

// ============================================
// 5-b. 슬롯 생성 (NEIS 없는 컨설팅 학년)
// ============================================

export async function runSlotGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, consultingGrades, coursePlanData, supabase } = ctx;

  if (!consultingGrades || consultingGrades.length === 0) {
    return "NEIS 미확보 학년 없음 — 슬롯 생성 불필요";
  }

  const { ensureConsultingGradeSlots } = await import("./pipeline-slot-generator");
  const result = await ensureConsultingGradeSlots({
    studentId,
    tenantId,
    studentGrade,
    consultingGrades,
    coursePlanData: coursePlanData ?? null,
    supabase,
  });

  return `슬롯 생성: 세특 ${result.setekCount}과목, 창체 ${result.changcheCount}영역, 행특 ${result.haengteukCount}건`;
}

// ============================================
// G2. 학년별 세특 방향 가이드
// ============================================

export async function runSetekGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // 해당 학년이 NEIS 학년인지 컨설팅 학년인지 판별
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;
  const isConsultingGrade = !isNeisGrade;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 세특 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석이 모두 캐시 + 기존 AI 가이드 존재 → LLM 스킵
  const setekUpstream = ctx.results["competency_setek"] as Record<string, unknown> | undefined;
  if (setekUpstream?.allCached === true) {
    const { count } = await ctx.supabase
      .from("student_record_setek_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 세특 방향 ${count}과목 (캐시)`,
        result: { cached: true },
      };
    }
  }

  const { buildGuideContextSection } = await import("./guide-context");
  const guideContextSection = await buildGuideContextSection(studentId, "guide");
  const improvementsSection = await buildImprovementsSection(studentId, currentSchoolYear, tenantId);

  const extraSections = [guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`);

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 세특 가이드
    const { analyzeSetekGuide } = await import("./llm/actions/guide-modules");
    const gradeAnalysisCtx = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
    const result = await analyzeSetekGuide(studentId, [targetGrade], extraSections, undefined, gradeAnalysisCtx, gradeReport);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    return guides ? `${targetGrade}학년 NEIS 세특 ${guides.length}과목` : `${targetGrade}학년 세특 방향 생성 완료`;
  }

  if (isConsultingGrade) {
    // 컨설팅 학년 → 수강계획 기반 세특 방향 (창체/행특 ForGrade 패턴과 동일)
    const { generateSetekDirection } = await import("./llm/actions/guide-modules");
    const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
    const { userId: guideUserId } = await reqAuth();
    const gradeAnalysisCtx = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
    const result = await generateSetekDirection(
      studentId, tenantId, guideUserId,
      gradeReport, [targetGrade], extraSections, targetSchoolYear, gradeAnalysisCtx,
    );
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    return guides ? `${targetGrade}학년 세특 방향 ${guides.length}과목` : `${targetGrade}학년 세특 방향 생성 완료`;
  }

  return `${targetGrade}학년 세특 방향 건너뜀`;
}

// ============================================
// G3. 학년별 창체 방향 가이드
// ============================================

export async function runChangcheGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, coursePlanData, targetGrade } = ctx;

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 창체 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 세특 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  const changcheUpstream = ctx.results["competency_changche"] as Record<string, unknown> | undefined;
  const setekGuideStable = (ctx.results["setek_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (changcheUpstream?.allCached === true && setekGuideStable) {
    const { count } = await ctx.supabase
      .from("student_record_changche_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 창체 ${count}개 활동유형 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`);

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 창체 가이드
    const { analyzeChangcheGuide } = await import("./llm/actions/guide-modules");
    const gradeAnalysisCtx = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
    const result = await analyzeChangcheGuide(studentId, [targetGrade], undefined, undefined, undefined, gradeAnalysisCtx, gradeReport);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
    return guides ? `${targetGrade}학년 창체 ${guides.length}개 활동유형 방향 생성` : `${targetGrade}학년 창체 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 창체 방향
  const { generateChangcheDirection } = await import("./llm/actions/guide-modules");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  // 세특 방향 컨텍스트 (해당 학년 school_year 기준)
  const { data: setekCtxRows } = await ctx.supabase
    .from("student_record_setek_guides")
    .select("direction, keywords")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai")
    .limit(4);
  const setekCtx = setekCtxRows?.length
    ? `## 세특 방향 요약\n${setekCtxRows.map((r) => `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  const gradeAnalysisCtxForChangche = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
  await generateChangcheDirection(
    studentId, tenantId, guideUserId,
    gradeReport, coursePlanData ?? null, undefined, setekCtx, targetSchoolYear, gradeAnalysisCtxForChangche,
  );

  return `${targetGrade}학년 창체 방향 생성 완료 (예비)`;
}

// ============================================
// G4. 학년별 행특 방향 가이드
// ============================================

export async function runHaengteukGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, coursePlanData, targetGrade } = ctx;

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 행특 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 창체 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  const haengteukUpstream = ctx.results["competency_haengteuk"] as Record<string, unknown> | undefined;
  const changcheGuideStable = (ctx.results["changche_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (haengteukUpstream?.allCached === true && changcheGuideStable) {
    const { count } = await ctx.supabase
      .from("student_record_haengteuk_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 행특 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`);

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 행특 가이드
    const { analyzeHaengteukGuide } = await import("./llm/actions/guide-modules");
    const gradeAnalysisCtxH = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
    const result = await analyzeHaengteukGuide(studentId, [targetGrade], undefined, undefined, undefined, gradeAnalysisCtxH, gradeReport);
    if (!result.success) throw new Error(result.error);
    return `${targetGrade}학년 행특 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 행특 방향
  const { generateHaengteukDirection } = await import("./llm/actions/guide-modules");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  // 창체 방향 컨텍스트 (해당 학년 school_year 기준)
  const { data: changcheCtxRows } = await ctx.supabase
    .from("student_record_changche_guides")
    .select("activity_type, direction, keywords")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai")
    .limit(3);
  const changcheCtx = changcheCtxRows?.length
    ? `## 창체 방향 요약\n${changcheCtxRows.map((r) => `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  const gradeAnalysisCtxForHaengteuk = toGuideAnalysisContext(ctx.analysisContext?.[targetGrade]);
  await generateHaengteukDirection(
    studentId, tenantId, guideUserId,
    gradeReport, coursePlanData ?? null, undefined, changcheCtx, targetSchoolYear, gradeAnalysisCtxForHaengteuk,
  );

  return `${targetGrade}학년 행특 방향 생성 완료 (예비)`;
}

