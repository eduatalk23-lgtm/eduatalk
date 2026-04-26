"use server";

// ============================================
// Phase 9.3 — 세특 방향 가이드 생성 Server Action
// 컨설턴트 내부용 (학생/학부모 비공개)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { fetchReportData } from "@/lib/domains/student-record/actions/report";
import { resolveEffectiveContent } from "../../pipeline";
import { buildSubjectMap, extractDiagnosisContext, deleteExistingGuides, syncGuideTaskStatus, callGuideAI } from "./guide-helpers";
import { insertSetekGuides } from "@/lib/domains/student-record/repository/guide-repository";
import {
  resolveCellGuideGridContext,
  applyMainExplorationToRow,
} from "./cell-guide-grid-context";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/setekGuide";
import type { SetekGuideInput, SetekGuideResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";


const LOG_CTX = { domain: "record-analysis", action: "generateSetekGuide" };

export async function generateSetekGuide(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
  /** 파이프라인에서 전달되는 학년별 analysisContext (있으면 report 기반 빌드를 스킵) */
  pipelineAnalysisContext?: import("../types").GuideAnalysisContext,
  /** 파이프라인에서 전달되는 ReportData (있으면 fetchReportData 호출 스킵) */
  cachedReport?: import("@/lib/domains/student-record/actions/report").ReportData,
  /** 학생 정체성 프로필 카드 (ctx.belief.profileCard). undefined/"" 시 프롬프트에서 생략. */
  studentProfileCard?: string,
  /** 세특 서사 완성도(8단계) 섹션 텍스트. buildNarrativeArcDiagnosisSection() 결과. undefined/"" 시 생략. */
  narrativeArcSection?: string,
  /** β+1: MidPipeline Planner 메타 판정 섹션. buildMidPlanGuideSection() 결과. undefined/"" 시 생략. */
  midPlanSection?: string,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // cachedReport가 있으면 fetchReportData 스킵
    let report: import("@/lib/domains/student-record/actions/report").ReportData;
    if (cachedReport) {
      report = cachedReport;
    } else {
      const reportResult = await fetchReportData(studentId);
      if (!reportResult.success || !reportResult.data) {
        return {
          success: false,
          error: reportResult.success === false ? reportResult.error : "데이터 수집 실패",
        };
      }
      report = reportResult.data;
    }
    const studentGrade = report.student.grade;
    const grades = targetGrades ?? Array.from({ length: studentGrade }, (_, i) => i + 1);

    // subject_id → 과목명 매핑
    const supabase = await createSupabaseServerClient();
    const subjectMap = await buildSubjectMap(report.recordDataByGrade, grades);

    // RecordTabData → SetekGuideInput 변환
    const recordDataByGrade: SetekGuideInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      recordDataByGrade[grade] = {
        seteks: data.seteks
          .filter((s) => resolveEffectiveContent(s).text.length > 0)
          .map((s) => ({
            subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
            content: resolveEffectiveContent(s).text,
          })),
        changche: data.changche
          .filter((c) => resolveEffectiveContent(c).text.length > 0)
          .map((c) => ({
            activity_type: c.activity_type,
            content: resolveEffectiveContent(c).text,
          })),
      };
    }

    // 데이터 유무 → 모드 결정
    const hasAnyData = Object.values(recordDataByGrade).some(
      (d) => d.seteks.length > 0,
    );

    // Phase R2: 기록 없으면 prospective 모드로 전환
    if (!hasAnyData) {
      return generateProspectiveSetekGuide(studentId, tenantId, userId, report, grades, edgePromptSection, targetSchoolYear, pipelineAnalysisContext, studentProfileCard, narrativeArcSection);
    }

    // 역량 진단 데이터 변환 (컨설턴트 진단 우선, 없으면 AI 진단)
    const { competencyScores, strengths, weaknesses } = extractDiagnosisContext(report.diagnosisData);

    // D→B단계: 파이프라인 경로면 학년별 타겟팅된 맥락 사용, 아니면 report에서 구성
    let analysisContext = pipelineAnalysisContext;
    if (!analysisContext) {
      const { buildGuideAnalysisContextFromReport } = await import("../../pipeline/pipeline-task-runners");
      analysisContext = buildGuideAnalysisContextFromReport(report);
    }

    // Phase β G7 — 격자 컨텍스트 (레벨 cap + 메인 탐구)
    const gridContext = await resolveCellGuideGridContext(
      studentId,
      tenantId,
      supabase,
    );

    const input: SetekGuideInput = {
      studentName: report.student.name ?? "학생",
      grade: studentGrade,
      targetMajor: report.student.targetMajor ?? undefined,
      targetSubClassificationName: report.student.targetSubClassificationName ?? undefined,
      targetMidName: report.student.targetMidName ?? undefined,
      targetGrades: grades,
      recordDataByGrade,
      competencyScores: competencyScores.length > 0 ? competencyScores : undefined,
      storylines: report.storylineData.storylines.map((sl) => ({
        title: sl.title,
        keywords: sl.keywords,
      })),
      strengths: strengths && strengths.length > 0 ? strengths : undefined,
      weaknesses: weaknesses && weaknesses.length > 0 ? weaknesses : undefined,
      edgePromptSection,
      analysisContext,
      gridContext,
      studentProfileCard: studentProfileCard || undefined,
      narrativeArcSection: narrativeArcSection || undefined,
      midPlanSection: midPlanSection || undefined,
    };

    // AI SDK 호출
    const parsed = await callGuideAI(SYSTEM_PROMPT, buildUserPrompt(input), parseResponse, { maxTokens: 32768 });
    if (!parsed) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    if (parsed.guides.length === 0) {
      return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다. 다시 시도해주세요." };
    }

    // DB 저장 — setek_guides 테이블에 과목별 행 삽입
    const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

    // 과목명 → subject_id 역매핑
    const nameToSubjectId = new Map<string, string>();
    for (const [id, name] of subjectMap) nameToSubjectId.set(name, id);

    // 기존 AI 가이드 삭제 (재생성 시 중복 방지 — retrospective 범위만)
    const deleteResult = await deleteExistingGuides(
      "student_record_setek_guides",
      { studentId, tenantId, schoolYear: currentSchoolYear, source: "ai", guideMode: "retrospective" },
      LOG_CTX,
    );
    if (deleteResult) return deleteResult;

    const rows = parsed.guides
      .map((g, i) => {
        const subjectId = nameToSubjectId.get(g.subjectName);
        if (!subjectId) return null;
        const base = {
          tenant_id: tenantId,
          student_id: studentId,
          school_year: currentSchoolYear,
          subject_id: subjectId,
          source: "ai" as const,
          status: "draft" as const,
          direction: g.direction,
          keywords: g.keywords,
          competency_focus: g.competencyFocus,
          cautions: g.cautions || null,
          teacher_points: g.teacherPoints,
          overall_direction: i === 0 ? parsed.overallDirection : null,
          model_tier: "standard",
          prompt_version: "guide_v1",
          guide_mode: "retrospective" as const,
          created_by: userId,
        };
        return applyMainExplorationToRow(base, gridContext);
      })
      .filter(Boolean);

    if (rows.length === 0) {
      return { success: false, error: "매칭 가능한 과목이 없습니다." };
    }

    let inserted: { id: string }[];
    try {
      inserted = await insertSetekGuides(rows as Record<string, unknown>[], supabase);
    } catch (insertError) {
      logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length });
      return { success: false, error: `가이드 저장 실패: ${insertError instanceof Error ? insertError.message : "결과 없음"}` };
    }

    if (inserted.length === 0) {
      return { success: false, error: "가이드 저장 실패: 결과 없음" };
    }

    syncGuideTaskStatus(studentId, "setek_guide", LOG_CTX);

    return {
      success: true,
      data: { ...parsed, summaryId: inserted[0].id },
    };
  } catch (error) {
    return handleLlmActionError(error, "세특 방향 가이드 생성", LOG_CTX);
  }
}

// ============================================
// Phase R2: Prospective 모드 — 기록 없이 계획 과목 기반
// ============================================

export async function generateProspectiveSetekGuide(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("@/lib/domains/student-record/actions/report").ReportData,
  grades: number[],
  edgePromptSection?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 */
  targetSchoolYear?: number,
  /** 파이프라인에서 전달되는 학년별 analysisContext (있으면 report 기반 빌드를 스킵) */
  pipelineAnalysisContext?: import("../types").GuideAnalysisContext,
  /** 학생 정체성 프로필 카드 (ctx.belief.profileCard). undefined/"" 시 프롬프트에서 생략. */
  studentProfileCard?: string,
  /** 세특 서사 완성도(8단계) 섹션 텍스트. buildNarrativeArcDiagnosisSection() 결과. undefined/"" 시 생략. */
  narrativeArcSection?: string,
  /** β+1: MidPipeline Planner 메타 판정 섹션. buildMidPlanGuideSection() 결과. undefined/"" 시 생략. */
  midPlanSection?: string,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
  const { logActionDebug: debug } = await import("@/lib/logging/actionLogger");
  debug(LOG_CTX, "prospective 모드 — 수강계획 기반 세특 방향 생성", { studentId });

  const supabase = await createSupabaseServerClient();
  const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

  // 수강 계획 조회
  const { fetchCoursePlanTabData } = await import("@/lib/domains/student-record/actions/coursePlan");
  const coursePlanRes = await fetchCoursePlanTabData(studentId).catch(() => null);
  const coursePlanData = coursePlanRes?.success ? coursePlanRes.data : null;

  // 계획 과목 (confirmed + recommended). runSetekGuideForGrade 는 학년별 호출이므로
  //   grades(= [targetGrade]) 에 속하는 plans 만 LLM 에 노출해야 cross-grade 오염을 방지한다.
  //   (이전 버그: 2/3학년 가이드 프롬프트에 1학년 공통과목이 섞여 들어가 LLM 이
  //    엉뚱한 학년의 setek_guide 를 생성하고 전부 targetSchoolYear 로 저장되었다.)
  const plans = coursePlanData?.plans?.filter((p) =>
    (p.plan_status === "confirmed" || p.plan_status === "recommended") &&
    grades.includes(p.grade),
  ) ?? [];

  if (plans.length === 0) {
    return { success: false, error: "세특 기록과 수강 계획이 모두 없습니다. 먼저 진로 설정 또는 세특을 입력해주세요." };
  }

  // 가이드 배정 컨텍스트
  const { buildGuideContextSection } = await import("@/lib/domains/student-record/guide-context");
  const guideSection = await buildGuideContextSection(studentId, "guide").catch(() => "");

  // 진단 데이터 (있으면 사용)
  const diagnosis = report.diagnosisData.consultantDiagnosis ?? report.diagnosisData.aiDiagnosis;

  // Impl-4: 이전 분석 학년의 역량/품질/보완방향 주입
  const { buildGuideAnalysisContextFromReport, buildCrossGradeDirections } = await import("../../pipeline/pipeline-task-runners-shared");
  const analysisContext = pipelineAnalysisContext ?? buildGuideAnalysisContextFromReport(report);
  const crossGradeDirections = await buildCrossGradeDirections(supabase, studentId, currentSchoolYear);

  // Phase β G7 — 격자 컨텍스트
  const gridContext = await resolveCellGuideGridContext(
    studentId,
    tenantId,
    supabase,
  );

  const input: SetekGuideInput = {
    mode: "prospective",
    studentName: report.student.name ?? "학생",
    grade: report.student.grade,
    targetMajor: report.student.targetMajor ?? undefined,
    targetSubClassificationName: report.student.targetSubClassificationName ?? undefined,
    targetMidName: report.student.targetMidName ?? undefined,
    targetGrades: grades,
    recordDataByGrade: {},
    storylines: report.storylineData.storylines.map((sl) => ({
      title: sl.title,
      keywords: sl.keywords,
    })),
    strengths: (diagnosis?.strengths as string[]) ?? undefined,
    weaknesses: (diagnosis?.weaknesses as string[]) ?? undefined,
    edgePromptSection,
    plannedSubjects: plans.map((p) => ({
      subjectName: p.subject?.name ?? "과목 미정",
      grade: p.grade,
      semester: p.semester,
      subjectType: p.subject?.subject_type?.name ?? undefined,
    })),
    guideAssignments: guideSection || undefined,
    analysisContext,
    crossGradeDirections,
    gridContext,
    studentProfileCard: studentProfileCard || undefined,
    narrativeArcSection: narrativeArcSection || undefined,
    midPlanSection: midPlanSection || undefined,
  };

  const parsed = await callGuideAI(SYSTEM_PROMPT, buildUserPrompt(input), parseResponse, { maxTokens: 32768 });
  if (!parsed) {
    return { success: false, error: "AI 응답이 비어있습니다." };
  }
  if (parsed.guides.length === 0) {
    return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다." };
  }

  // 과목명 → subject_id 매핑 (계획 과목에서)
  const nameToSubjectId = new Map<string, string>();
  for (const p of plans) {
    if (p.subject?.name) nameToSubjectId.set(p.subject.name, p.subject_id);
  }

  // 기존 AI 가이드 삭제
  const prospDeleteResult = await deleteExistingGuides(
    "student_record_setek_guides",
    { studentId, tenantId, schoolYear: currentSchoolYear, source: "ai", guideMode: "prospective" },
    LOG_CTX,
  );
  if (prospDeleteResult) return prospDeleteResult;

  const rows = parsed.guides
    .map((g, i) => {
      const subjectId = nameToSubjectId.get(g.subjectName);
      if (!subjectId) return null;
      const base = {
        tenant_id: tenantId,
        student_id: studentId,
        school_year: currentSchoolYear,
        subject_id: subjectId,
        source: "ai" as const,
        status: "draft" as const,
        direction: g.direction,
        keywords: g.keywords,
        competency_focus: g.competencyFocus,
        cautions: g.cautions || null,
        teacher_points: g.teacherPoints,
        overall_direction: i === 0 ? parsed.overallDirection : null,
        model_tier: "standard",
        prompt_version: "guide_v1_prospective",
        guide_mode: "prospective" as const,
        created_by: userId,
      };
      return applyMainExplorationToRow(base, gridContext);
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return { success: false, error: "매칭 가능한 과목이 없습니다." };
  }

  let inserted: { id: string }[];
  try {
    inserted = await insertSetekGuides(rows as Record<string, unknown>[], supabase);
  } catch (insertError) {
    logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length, mode: "prospective" });
    return { success: false, error: `가이드 저장 실패: ${insertError instanceof Error ? insertError.message : "결과 없음"}` };
  }

  if (inserted.length === 0) {
    return { success: false, error: "가이드 저장 실패: 결과 없음" };
  }

  syncGuideTaskStatus(studentId, "setek_guide", LOG_CTX);

  return {
    success: true,
    data: { ...parsed, summaryId: inserted[0].id, requestedSubjectCount: plans.length },
  };
}
