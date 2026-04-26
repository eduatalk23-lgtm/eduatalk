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
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { CrossRefEdge } from "@/lib/domains/student-record/cross-reference";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import * as guideRepo from "@/lib/domains/student-record/repository/guide-repository";
import { ACTIVITY_TYPE_LABELS } from "@/lib/domains/student-record/constants";
import { toGuideAnalysisContext, mergeGuideAnalysisContexts } from "./pipeline-task-runners-shared";

// M4: 가이드 배정 컨텍스트 캐시 — Phase 4-6 간 DB 재조회 방지
type GuideContextKey = "guide" | "summary" | "strategy";
async function getCachedGuideContext(
  ctx: PipelineContext,
  studentId: string,
  context: GuideContextKey,
): Promise<string> {
  if (!ctx.cachedGuideContexts) ctx.cachedGuideContexts = {};
  const cached = ctx.cachedGuideContexts[context];
  if (cached !== undefined) return cached;

  const { buildGuideContextSection } = await import("@/lib/domains/student-record/guide-context");
  const section = await buildGuideContextSection(studentId, context);
  ctx.cachedGuideContexts[context] = section;
  return section;
}

const LOG_CTX = { domain: "record-analysis", action: "pipeline-guide" };

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

/** report 1회 fetch + 에러 처리 (ctx 전달 시 캐시하여 Phase 4-6 간 재사용) */
async function fetchReportOrThrow(
  studentId: string,
  errorLabel: string,
  ctx?: PipelineContext,
): Promise<import("@/lib/domains/student-record/actions/report").ReportData> {
  if (ctx?.cachedReport) return ctx.cachedReport;
  const { fetchReportData } = await import("@/lib/domains/student-record/actions/report");
  const result = await fetchReportData(studentId);
  if (!result.success || !result.data) {
    throw new Error(result.success === false ? result.error : `${errorLabel} 리포트 데이터 수집 실패`);
  }
  if (ctx) ctx.cachedReport = result.data;
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
    const { buildEdgePromptSection } = await import("@/lib/domains/student-record/edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }
  const guideContextSection = await getCachedGuideContext(ctx, studentId, "guide");

  const currentYear = calculateSchoolYear();
  const improvementsSection = await buildImprovementsSection(studentId, currentYear, tenantId);

  const extraSections = [guideEdgeSection, guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;
  const results: string[] = [];

  // report 1회 fetch — NEIS+consulting 양쪽에서 공유
  let sharedReport: import("@/lib/domains/student-record/actions/report").ReportData | undefined;
  if (hasNeisGrades || hasConsultingGrades) {
    sharedReport = await fetchReportOrThrow(studentId, "세특 방향", ctx);
  }

  // narrative arc 8단계 분석 섹션 — setek/changche/haengteuk 가이드 공유 (학생당 1회 DB 조회)
  // best-effort: 실패해도 가이드 정상 진행
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section");
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, ctx.supabase);
  } catch {
    narrativeArcSection = undefined;
  }

  // MidPlan 메타 판정 섹션 (β+1 — 좌절 1 해결: MidPlan override → 가이드)
  let midPlanSection: string | undefined;
  try {
    const { buildMidPlanGuideSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
    const midPlan =
      ctx.midPlan ??
      ((ctx.results["_midPlan"] as import("../orient/mid-pipeline-planner").MidPlan | undefined) ?? null);
    midPlanSection = buildMidPlanGuideSection(midPlan);
  } catch {
    midPlanSection = undefined;
  }

  // NEIS 학년 → 분석형 세특 가이드 (NEIS 데이터 기반)
  if (hasNeisGrades) {
    const { analyzeSetekGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    const mergedAnalysisCtx = mergeGuideAnalysisContexts(
      ctx.neisGrades!.map((g) => toGuideAnalysisContext(ctx.belief.analysisContext?.[g])),
    );
    const profileCard = ctx.belief.profileCard || undefined;
    const result = await analyzeSetekGuide(studentId, ctx.neisGrades!, extraSections, undefined, mergedAnalysisCtx, sharedReport, profileCard, narrativeArcSection, midPlanSection);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    if (guides) results.push(`NEIS ${guides.length}과목`);
  }

  // 컨설팅 학년 → 수강계획 기반 세특 방향 (학년별 개별 호출 — 타임아웃 안전)
  if (hasConsultingGrades) {
    const { generateSetekDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
    const { userId: guideUserId } = await reqAuth();
    const profileCard = ctx.belief.profileCard || undefined;
    const gradeResults = await Promise.allSettled(
      ctx.consultingGrades!.map(async (grade) => {
        const targetSchoolYear = currentYear - ctx.studentGrade + grade;
        const gradeAnalysisCtx = toGuideAnalysisContext(ctx.belief.analysisContext?.[grade]);
        const result = await generateSetekDirection(
          studentId, tenantId, guideUserId,
          sharedReport!, [grade], extraSections, targetSchoolYear, gradeAnalysisCtx, profileCard, narrativeArcSection, midPlanSection,
        );
        return { grade, result };
      }),
    );
    for (const r of gradeResults) {
      if (r.status === "rejected") {
        logActionWarn(LOG_CTX, `세특 방향 생성 실패`, { studentId, error: String(r.reason) });
        continue;
      }
      const { grade, result } = r.value;
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
  const report = await fetchReportOrThrow(studentId, "창체 방향", ctx);

  // narrative arc 8단계 분석 섹션 (best-effort, 양 경로 공유)
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section");
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, ctx.supabase);
  } catch {
    narrativeArcSection = undefined;
  }

  // MidPlan 메타 판정 섹션 (β+1 — 좌절 1 해결)
  let midPlanSection: string | undefined;
  try {
    const { buildMidPlanGuideSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
    const midPlan =
      ctx.midPlan ??
      ((ctx.results["_midPlan"] as import("../orient/mid-pipeline-planner").MidPlan | undefined) ?? null);
    midPlanSection = buildMidPlanGuideSection(midPlan);
  } catch {
    midPlanSection = undefined;
  }

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateChangcheDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    // 세특 방향 컨텍스트 (setek_guide 결과 있으면 전달)
    const currentYear = calculateSchoolYear();
    let setekCtx: string | undefined;
    const setekRows = await guideRepo.findSetekGuideSummary(
      { studentId, tenantId, schoolYear: currentYear, source: "ai", limit: 4 },
      supabase,
    );
    if (setekRows.length > 0) {
      const lines = setekRows.map((r) =>
        `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
      );
      setekCtx = `## 세특 방향 요약\n${lines.join("\n")}`;
    }
    const allGradesCtx = mergeGuideAnalysisContexts(
      (ctx.consultingGrades ?? []).map((g) => toGuideAnalysisContext(ctx.belief.analysisContext?.[g])),
    );
    const profileCard = ctx.belief.profileCard || undefined;
    const result = await generateChangcheDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      report, coursePlanData ?? null, undefined, setekCtx, undefined, allGradesCtx, profileCard, narrativeArcSection, midPlanSection,
    );
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
    return guides ? `${guides.length}개 활동유형 방향 생성 (예비)` : "창체 방향 생성 완료 (예비)";
  }

  // NEIS 있음 → 분석 모듈
  const { analyzeChangcheGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
  // Phase E2: 엣지 데이터 → 창체 가이드 프롬프트에 투입
  let guideEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("@/lib/domains/student-record/edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }

  // 세특 방향 컨텍스트 — setek_guide DB 결과에서 요약 구성
  let setekGuideContext: string | undefined;
  const currentYear = calculateSchoolYear();
  const setekDetailRows = await guideRepo.findSetekGuideWithSubject(
    { studentId, tenantId, schoolYear: currentYear, source: "ai", limit: 6 },
    supabase,
  );
  if (setekDetailRows.length > 0) {
    const lines = setekDetailRows.map((r) => {
      const sub = r.subject;
      return `- ${sub?.name ?? sub?.id ?? "미상"}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`;
    });
    setekGuideContext = `## 세특 방향 요약\n${lines.join("\n")}`;
  }

  const mergedCtxChangche = mergeGuideAnalysisContexts(
    (ctx.neisGrades ?? []).map((g) => toGuideAnalysisContext(ctx.belief.analysisContext?.[g])),
  );
  const profileCardChangche = ctx.belief.profileCard || undefined;
  const result = await analyzeChangcheGuide(studentId, undefined, guideEdgeSection, setekGuideContext, undefined, mergedCtxChangche, report, profileCardChangche, narrativeArcSection, midPlanSection);
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
  const report = await fetchReportOrThrow(studentId, "행특 방향", ctx);

  // narrative arc 8단계 분석 섹션 (best-effort, 양 경로 공유)
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section");
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, ctx.supabase);
  } catch {
    narrativeArcSection = undefined;
  }

  // MidPlan 메타 판정 섹션 (β+1 — 좌절 1 해결)
  let midPlanSection: string | undefined;
  try {
    const { buildMidPlanGuideSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
    const midPlan =
      ctx.midPlan ??
      ((ctx.results["_midPlan"] as import("../orient/mid-pipeline-planner").MidPlan | undefined) ?? null);
    midPlanSection = buildMidPlanGuideSection(midPlan);
  } catch {
    midPlanSection = undefined;
  }

  const profileCardHaengteuk = ctx.belief.profileCard || undefined;

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateHaengteukDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    // 창체 방향 컨텍스트 (changche_guide 결과 있으면 전달)
    const currentYear = calculateSchoolYear();
    let changcheCtx: string | undefined;
    const changcheRows = await guideRepo.findChangcheGuideSummary(
      { studentId, tenantId, schoolYear: currentYear, source: "ai", limit: 3 },
      supabase,
    );
    if (changcheRows.length > 0) {
      const lines = changcheRows.map((r) =>
        `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
      );
      changcheCtx = `## 창체 방향 요약\n${lines.join("\n")}`;
    }
    const allGradesCtxH = mergeGuideAnalysisContexts(
      (ctx.consultingGrades ?? []).map((g) => toGuideAnalysisContext(ctx.belief.analysisContext?.[g])),
    );
    const result = await generateHaengteukDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      report, coursePlanData ?? null, undefined, changcheCtx, undefined, allGradesCtxH, profileCardHaengteuk, narrativeArcSection, midPlanSection,
    );
    if (!result.success) throw new Error(result.error);
    return "행특 방향 생성 완료 (예비)";
  }

  // NEIS 있음 → 분석 모듈
  const { analyzeHaengteukGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
  // Phase E2: 엣지 데이터 → 행특 가이드 프롬프트에 투입
  let guideEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("@/lib/domains/student-record/edge-summary");
    guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
  }

  // 창체 방향 컨텍스트 — changche_guide DB 결과에서 요약 구성
  let changcheGuideContext: string | undefined;
  const currentYear = calculateSchoolYear();
  const changcheDetailRows = await guideRepo.findChangcheGuideSummary(
    { studentId, tenantId, schoolYear: currentYear, source: "ai", limit: 3 },
    supabase,
  );
  if (changcheDetailRows.length > 0) {
    const lines = changcheDetailRows.map((r) =>
      `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
    );
    changcheGuideContext = `## 창체 방향 요약\n${lines.join("\n")}`;
  }

  const mergedCtxHaengteuk = mergeGuideAnalysisContexts(
    (ctx.neisGrades ?? []).map((g) => toGuideAnalysisContext(ctx.belief.analysisContext?.[g])),
  );
  const result = await analyzeHaengteukGuide(studentId, undefined, guideEdgeSection, changcheGuideContext, undefined, mergedCtxHaengteuk, report, profileCardHaengteuk, narrativeArcSection, midPlanSection);
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

  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 세특 방향 건너뜀`;
  }
  // NEIS 학년(hasAnyNeis=true): 분석형 가이드 / 컨설팅 학년(=false): 수강계획 기반 가이드

  // 캐시 체크: 상위 역량 분석이 모두 캐시 + 기존 AI 가이드 존재 → LLM 스킵
  // 설계 모드 전용 — analysis 모드는 ctx.analysisContext/ctx.gradeThemes가 풀런마다 변동하므로
  // competency content 미변경이어도 가이드 입력이 바뀌어 outdated 결과 재사용 위험 (2026-04-16 G).
  const setekUpstream = ctx.results["competency_setek"] as Record<string, unknown> | undefined;
  if (ctx.gradeMode === "design" && setekUpstream?.allCached === true) {
    const count = await guideRepo.countSetekGuides(
      { studentId, tenantId, schoolYear: targetSchoolYear, source: "ai" },
      ctx.supabase,
    );

    if (count > 0) {
      return {
        preview: `${targetGrade}학년 세특 방향 ${count}과목 (캐시)`,
        result: { cached: true },
      };
    }
  }

  const guideContextSection2 = await getCachedGuideContext(ctx, studentId, "guide");
  const improvementsSection = await buildImprovementsSection(studentId, currentSchoolYear, tenantId);

  // Blueprint 섹션 주입 (설계 모드 + ctx.belief.blueprint 적재된 경우만)
  let blueprintGuideSection: string | undefined;
  if (ctx.gradeMode === "design" && ctx.belief.blueprint) {
    const { buildBlueprintGuideSection } = await import(
      "@/lib/domains/record-analysis/llm/prompts/blueprintGuideSection"
    );
    const section = buildBlueprintGuideSection(ctx.belief.blueprint, [targetGrade]);
    if (section) blueprintGuideSection = section;
  }

  const extraSections =
    [guideContextSection2, improvementsSection, blueprintGuideSection]
      .filter(Boolean)
      .join("\n") || undefined;

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`, ctx);

  const profileCard = ctx.belief.profileCard || undefined;

  // narrative arc 8단계 분석 섹션 (best-effort)
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section");
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, ctx.supabase);
  } catch {
    narrativeArcSection = undefined;
  }

  // MidPlan 메타 판정 섹션 (β+1 — 좌절 1 해결)
  let midPlanSection: string | undefined;
  try {
    const { buildMidPlanGuideSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
    const midPlan =
      ctx.midPlan ??
      ((ctx.results["_midPlan"] as import("../orient/mid-pipeline-planner").MidPlan | undefined) ?? null);
    midPlanSection = buildMidPlanGuideSection(midPlan);
  } catch {
    midPlanSection = undefined;
  }

  if (gradeResolved.hasAnyNeis) {
    // NEIS 학년 → 분석형 세특 가이드
    // targetSchoolYear 전달 필수 — 미지정 시 generateSetekGuide가 calculateSchoolYear()(현재 학년도)로 저장해
    // 여러 학년의 보완 방향이 같은 row에 덮어써지는 버그 발생
    const { analyzeSetekGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    const gradeAnalysisCtx = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
    const result = await analyzeSetekGuide(studentId, [targetGrade], extraSections, targetSchoolYear, gradeAnalysisCtx, gradeReport, profileCard, narrativeArcSection, midPlanSection);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    return guides ? `${targetGrade}학년 NEIS 세특 ${guides.length}과목` : `${targetGrade}학년 세특 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 세특 방향 (창체/행특 ForGrade 패턴과 동일)
  const { generateSetekDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();
  const gradeAnalysisCtx = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
  const result = await generateSetekDirection(
    studentId, tenantId, guideUserId,
    gradeReport, [targetGrade], extraSections, targetSchoolYear, gradeAnalysisCtx, profileCard, narrativeArcSection, midPlanSection,
  );
  if (!result.success) throw new Error(result.error);
  const guides = result.data?.guides ?? [];
  // 완결성 가드 (P7 draft_generation 90% 패턴 재사용).
  // LLM 이 요청된 수강계획 과목의 90% 미만만 가이드를 생성하면 부분 실행으로 판단해 실패 처리.
  // 이전: silently 부분 생성 → 다운스트림 P7/P8/P9 가 누락 과목을 skip 하여 근본 원인 추적 곤란.
  const requested = result.data?.requestedSubjectCount ?? 0;
  if (requested > 0 && guides.length / requested < 0.9) {
    const pct = ((guides.length / requested) * 100).toFixed(0);
    throw new Error(
      `setek_guide 부분 생성: ${guides.length}/${requested}과목 (${pct}% < 90%)`,
    );
  }
  return `${targetGrade}학년 세특 방향 ${guides.length}과목`;
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

  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 창체 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 세특 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  // 설계 모드 전용 — setek_guide가 이미 analysis 모드에서 캐시 우회되므로 setekGuideStable은 natural false.
  const changcheUpstream = ctx.results["competency_changche"] as Record<string, unknown> | undefined;
  const setekGuideStable = (ctx.results["setek_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (ctx.gradeMode === "design" && changcheUpstream?.allCached === true && setekGuideStable) {
    const changcheCount = await guideRepo.countChangcheGuides(
      { studentId, tenantId, schoolYear: targetSchoolYear, source: "ai" },
      ctx.supabase,
    );

    if (changcheCount > 0) {
      return {
        preview: `${targetGrade}학년 창체 ${changcheCount}개 활동유형 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`, ctx);

  // Blueprint 섹션 주입 (설계 모드 + ctx.belief.blueprint 적재된 경우만)
  let blueprintGuideSection: string | undefined;
  if (ctx.gradeMode === "design" && ctx.belief.blueprint) {
    const { buildBlueprintGuideSection } = await import(
      "@/lib/domains/record-analysis/llm/prompts/blueprintGuideSection"
    );
    const section = buildBlueprintGuideSection(ctx.belief.blueprint, [targetGrade]);
    if (section) blueprintGuideSection = section;
  }

  if (gradeResolved.hasAnyNeis) {
    // NEIS 학년 → 분석형 창체 가이드
    // targetSchoolYear 전달 필수 — 미지정 시 학년별 결과가 현재 학년도 1개 row에 덮어써짐
    const { analyzeChangcheGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    const gradeAnalysisCtx = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
    const result = await analyzeChangcheGuide(studentId, [targetGrade], blueprintGuideSection, undefined, targetSchoolYear, gradeAnalysisCtx, gradeReport);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
    return guides ? `${targetGrade}학년 창체 ${guides.length}개 활동유형 방향 생성` : `${targetGrade}학년 창체 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 창체 방향
  const { generateChangcheDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  // 세특 방향 컨텍스트 (해당 학년 school_year 기준)
  const setekCtxRows = await guideRepo.findSetekGuideSummary(
    { studentId, tenantId, schoolYear: targetSchoolYear, source: "ai", limit: 4 },
    ctx.supabase,
  );
  const setekCtx = setekCtxRows.length > 0
    ? `## 세특 방향 요약\n${setekCtxRows.map((r) => `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  const gradeAnalysisCtxForChangche = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
  await generateChangcheDirection(
    studentId, tenantId, guideUserId,
    gradeReport, coursePlanData ?? null, blueprintGuideSection, setekCtx, targetSchoolYear, gradeAnalysisCtxForChangche,
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

  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 행특 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 창체 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  // 설계 모드 전용 — changche_guide가 이미 analysis 모드에서 캐시 우회되므로 changcheGuideStable은 natural false.
  const haengteukUpstream = ctx.results["competency_haengteuk"] as Record<string, unknown> | undefined;
  const changcheGuideStable = (ctx.results["changche_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (ctx.gradeMode === "design" && haengteukUpstream?.allCached === true && changcheGuideStable) {
    const haengteukCount = await guideRepo.countHaengteukGuides(
      { studentId, tenantId, schoolYear: targetSchoolYear, source: "ai" },
      ctx.supabase,
    );

    if (haengteukCount > 0) {
      return {
        preview: `${targetGrade}학년 행특 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  // report 1회 fetch — NEIS/consulting 양 경로 공유
  const gradeReport = await fetchReportOrThrow(studentId, `${targetGrade}학년`, ctx);

  // Blueprint 섹션 주입 (설계 모드 + ctx.belief.blueprint 적재된 경우만)
  let blueprintGuideSection: string | undefined;
  if (ctx.gradeMode === "design" && ctx.belief.blueprint) {
    const { buildBlueprintGuideSection } = await import(
      "@/lib/domains/record-analysis/llm/prompts/blueprintGuideSection"
    );
    const section = buildBlueprintGuideSection(ctx.belief.blueprint, [targetGrade]);
    if (section) blueprintGuideSection = section;
  }

  if (gradeResolved.hasAnyNeis) {
    // NEIS 학년 → 분석형 행특 가이드
    // targetSchoolYear 전달 필수 — 미지정 시 학년별 결과가 현재 학년도 1개 row에 덮어써짐
    const { analyzeHaengteukGuide } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
    const gradeAnalysisCtxH = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
    const result = await analyzeHaengteukGuide(studentId, [targetGrade], blueprintGuideSection, undefined, targetSchoolYear, gradeAnalysisCtxH, gradeReport);
    if (!result.success) throw new Error(result.error);
    return `${targetGrade}학년 행특 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 행특 방향
  const { generateHaengteukDirection } = await import("@/lib/domains/record-analysis/llm/actions/guide-modules");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  // 창체 방향 컨텍스트 (해당 학년 school_year 기준)
  const changcheCtxRows = await guideRepo.findChangcheGuideSummary(
    { studentId, tenantId, schoolYear: targetSchoolYear, source: "ai", limit: 3 },
    ctx.supabase,
  );
  const changcheCtx = changcheCtxRows.length > 0
    ? `## 창체 방향 요약\n${changcheCtxRows.map((r) => `- ${ACTIVITY_TYPE_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  const gradeAnalysisCtxForHaengteuk = toGuideAnalysisContext(ctx.belief.analysisContext?.[targetGrade], ctx.belief.gradeThemes);
  await generateHaengteukDirection(
    studentId, tenantId, guideUserId,
    gradeReport, coursePlanData ?? null, blueprintGuideSection, changcheCtx, targetSchoolYear, gradeAnalysisCtxForHaengteuk,
  );

  return `${targetGrade}학년 행특 방향 생성 완료 (예비)`;
}

