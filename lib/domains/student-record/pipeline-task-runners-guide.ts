// ============================================
// 가이드 생성 태스크 러너 (Grade Pipeline P4-P6)
// 7: runSetekGuide
// 8: runChangcheGuide
// 9: runHaengteukGuide
// 5-b: runSlotGeneration
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type {
  PipelineContext,
  TaskRunnerOutput,
} from "./pipeline-types";
import type { PersistedEdge } from "./edge-repository";
import type { CrossRefEdge } from "./cross-reference";
import * as diagnosisRepo from "./diagnosis-repository";

const LOG_CTX = { domain: "student-record", action: "pipeline-guide" };

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

  let improvementsSection: string | undefined;
  const currentYear = calculateSchoolYear();
  const diagForGuide = await diagnosisRepo.findDiagnosis(studentId, currentYear, tenantId, "ai");
  if (diagForGuide && Array.isArray(diagForGuide.improvements) && (diagForGuide.improvements as unknown[]).length > 0) {
    const imps = diagForGuide.improvements as Array<{ priority: string; area: string; action: string }>;
    improvementsSection = `## 개선 우선순위 (세특 방향에 반영)\n${imps.map((i) => `- [${i.priority}] ${i.area}: ${i.action}`).join("\n")}`;
  }

  const extraSections = [guideEdgeSection, guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;
  const results: string[] = [];

  // NEIS 학년 → 분석형 세특 가이드 (NEIS 데이터 기반)
  if (hasNeisGrades) {
    const { analyzeSetekGuide } = await import("./llm/actions/guide-modules");
    const result = await analyzeSetekGuide(studentId, ctx.neisGrades!, extraSections);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    if (guides) results.push(`NEIS ${guides.length}과목`);
  }

  // 컨설팅 학년 → 수강계획 기반 세특 방향 (학년별 개별 호출 — 타임아웃 안전)
  if (hasConsultingGrades) {
    const { generateSetekDirection } = await import("./llm/actions/guide-modules");
    for (const grade of ctx.consultingGrades!) {
      const targetSchoolYear = currentYear - ctx.studentGrade + grade;
      const result = await generateSetekDirection(studentId, [grade], extraSections, targetSchoolYear);
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

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateChangcheDirection } = await import("./llm/actions/guide-modules");
    const { fetchReportData } = await import("./actions/report");
    const reportResult = await fetchReportData(studentId);
    if (!reportResult.success || !reportResult.data) {
      throw new Error(reportResult.success === false ? reportResult.error : "데이터 수집 실패");
    }
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
    const result = await generateChangcheDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      reportResult.data, coursePlanData ?? null, undefined, setekCtx,
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

  const result = await analyzeChangcheGuide(studentId, undefined, guideEdgeSection, setekGuideContext);
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

  // NEIS 없음 → 수강계획 기반 방향 생성 (컨설팅 모듈)
  const hasNeisData = ctx.neisGrades && ctx.neisGrades.length > 0;
  if (!hasNeisData) {
    const { generateHaengteukDirection } = await import("./llm/actions/guide-modules");
    const { fetchReportData } = await import("./actions/report");
    const reportResult = await fetchReportData(studentId);
    if (!reportResult.success || !reportResult.data) {
      throw new Error(reportResult.success === false ? reportResult.error : "데이터 수집 실패");
    }
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
      const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
      const lines = changcheRows.map((r) =>
        `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
      );
      changcheCtx = `## 창체 방향 요약\n${lines.join("\n")}`;
    }
    const result = await generateHaengteukDirection(
      studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
      reportResult.data, coursePlanData ?? null, undefined, changcheCtx,
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
    const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
    const lines = changcheRows.map((r) =>
      `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
    );
    changcheGuideContext = `## 창체 방향 요약\n${lines.join("\n")}`;
  }

  const result = await analyzeHaengteukGuide(studentId, undefined, guideEdgeSection, changcheGuideContext);
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

