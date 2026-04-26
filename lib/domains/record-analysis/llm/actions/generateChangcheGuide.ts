"use server";

// ============================================
// 창체 방향 가이드 생성 Server Action
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
import { insertChangcheGuides } from "@/lib/domains/student-record/repository/guide-repository";
import {
  resolveCellGuideGridContext,
  renderCellGuideGridContextSection,
  applyMainExplorationToRow,
} from "./cell-guide-grid-context";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/changcheGuide";
import type { ChangcheGuideInput, ChangcheGuideResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";


const LOG_CTX = { domain: "record-analysis", action: "generateChangcheGuide" };

// ============================================
// Phase V1: Prospective 창체 방향 — 수강계획+진로 기반
// ============================================

export async function generateProspectiveChangcheGuide(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("@/lib/domains/student-record/actions/report").ReportData,
  coursePlanData: import("@/lib/domains/student-record/course-plan/types").CoursePlanTabData | null,
  edgePromptSection?: string,
  setekGuideContext?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
  /** 파이프라인에서 전달되는 학년별 analysisContext (있으면 report 기반 빌드를 스킵) */
  pipelineAnalysisContext?: import("../types").GuideAnalysisContext,
  /** ctx.belief.profileCard — 학생 정체성 누적 프로필 카드. undefined/"" 시 섹션 생략 */
  studentProfileCard?: string,
  /** 세특 서사 완성도(8단계) 섹션 텍스트. buildNarrativeArcDiagnosisSection() 결과. undefined/"" 시 생략. */
  narrativeArcSection?: string,
  /** β+1: MidPipeline Planner 메타 판정 섹션. buildMidPlanGuideSection() 결과. undefined/"" 시 생략. */
  midPlanSection?: string,
): Promise<ActionResponse<ChangcheGuideResult & { summaryId: string }>> {
  const { logActionDebug: debug } = await import("@/lib/logging/actionLogger");
  debug(LOG_CTX, "prospective 모드 — 수강계획 기반 창체 방향 생성", { studentId });

  const supabase = await createSupabaseServerClient();
  const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

  const plans = coursePlanData?.plans?.filter(
    (p) => p.plan_status === "confirmed" || p.plan_status === "recommended",
  ) ?? [];

  if (plans.length === 0) {
    return { success: false, error: "창체 기록과 수강 계획이 모두 없습니다. 먼저 수강 계획을 입력해주세요." };
  }

  const diagnosis = report.diagnosisData.consultantDiagnosis ?? report.diagnosisData.aiDiagnosis;

  // Impl-4: 이전 분석 학년의 역량/품질/보완방향 주입
  const { buildCrossGradeDirections } = await import("../../pipeline/pipeline-task-runners-shared");
  const crossGradeDirections = await buildCrossGradeDirections(supabase, studentId, currentSchoolYear);

  // Phase β G7 — 격자 컨텍스트
  const gridContext = await resolveCellGuideGridContext(
    studentId,
    tenantId,
    supabase,
  );
  const gridSection = renderCellGuideGridContextSection(gridContext);

  // 활동 유형별 관련 과목 추론
  const allPlannedNames = [
    ...new Set(
      plans.map((p) => (p.subject as { name?: string } | null)?.name).filter((n): n is string => !!n),
    ),
  ];

  // 자율: 주제탐구형 / 동아리: 진로 관련 전공 과목 / 진로: 진로탐색 관련
  const autonomySubjects = allPlannedNames.slice(0, 3).join(", ") || "수강 예정 과목";
  const clubSubjects = plans
    .filter((p) => {
      const st = (p.subject as { subject_type?: { name?: string } } | null)?.subject_type?.name ?? "";
      return st.includes("진로") || st.includes("전문");
    })
    .map((p) => (p.subject as { name?: string } | null)?.name)
    .filter((n): n is string => !!n)
    .slice(0, 3)
    .join(", ") || (allPlannedNames[0] ?? "전공 관련 과목");
  const careerSubjects = allPlannedNames.slice(0, 2).join(", ") || "수강 예정 과목";

  const storylines = report.storylineData.storylines.map((sl) => `- ${sl.title} [${sl.keywords.slice(0, 3).join(", ")}]`).join("\n");

  const profileCardSection = studentProfileCard
    ? `## 학생 정체성 (학년 누적 프로필)\n다음은 이 학생의 학년 누적 정체성 요약입니다.\n**제안하는 가이드 방향이 이 정체성과 정합되어야 합니다.**\n\n${studentProfileCard}\n`
    : "";

  const narrativeArcSectionBlock = narrativeArcSection
    ? `${narrativeArcSection}\n\n위 8단계 분석을 참고하여, 핵심 단계(①호기심 ②주제 ③탐구 ⑤결론)가 누락된 패턴을\n보완하는 방향으로 가이드를 작성하세요.\n`
    : "";

  const midPlanSectionBlock = midPlanSection ? `${midPlanSection}\n` : "";

  const userPrompt = `# 신입생 창체 방향 가이드 요청 (수강계획 기반)

## 학생 정보
- 이름: ${report.student.name ?? "학생"}
- 학년: ${report.student.grade}학년
- 목표 전공: ${report.student.targetMajor ?? "미설정"}
${report.student.targetSubClassificationName ? `- 세부 분류: ${report.student.targetSubClassificationName}` : ""}

## 수강 계획 (confirmed/recommended)
${allPlannedNames.map((n) => `- ${n}`).join("\n")}

## 활동 유형별 추론 과목
- 자율활동 참고 과목: ${autonomySubjects}
- 동아리활동 참고 과목: ${clubSubjects}
- 진로활동 참고 과목: ${careerSubjects}

${storylines ? `## 스토리라인\n${storylines}\n` : ""}
${(diagnosis?.strengths as string[] | undefined)?.length ? `## 강점 영역\n${(diagnosis.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}\n` : ""}
${(diagnosis?.weaknesses as string[] | undefined)?.length ? `## 보완 영역\n${(diagnosis.weaknesses as string[]).map((w: string) => `- ${w}`).join("\n")}\n` : ""}
${setekGuideContext ? `${setekGuideContext}\n` : ""}
${edgePromptSection ? `${edgePromptSection}\n` : ""}
${gridSection}
${profileCardSection}
${narrativeArcSectionBlock}
${midPlanSectionBlock}
${crossGradeDirections ? `## 이전 학년 보완방향 (분석 결과 기반)\n→ 아래 보완방향을 이어받아 설계방향에 반영하세요.\n${crossGradeDirections}\n` : ""}

## 지시사항

이 학생은 아직 창체 기록이 없습니다. 수강 계획과 진로를 바탕으로 **앞으로 작성할 창체 방향**을 제안해주세요.
- 자율, 동아리, 진로 각 활동 유형별로 방향을 제시합니다
- 수강 예정 과목과 연계하여 구체적인 탐구/활동 방향을 제안합니다
- 진로 적합성이 드러나도록 방향을 설계합니다
- prompt_version: "changche_guide_v1_prospective"`;

  const parsed = await callGuideAI(SYSTEM_PROMPT, userPrompt, parseResponse, { maxTokens: 16384, retryLabel: "changcheGuide" });
  if (!parsed) {
    return { success: false, error: "AI 응답이 비어있습니다." };
  }
  if (parsed.guides.length === 0) {
    return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다." };
  }

  // 기존 AI 가이드 삭제
  const deleteResult = await deleteExistingGuides(
    "student_record_changche_guides",
    { studentId, tenantId, schoolYear: currentSchoolYear, source: "ai", guideMode: "prospective" },
    LOG_CTX,
  );
  if (deleteResult) return deleteResult;

  const rows = parsed.guides.map((g, i) =>
    applyMainExplorationToRow(
      {
        tenant_id: tenantId,
        student_id: studentId,
        school_year: currentSchoolYear,
        activity_type: g.activityType,
        source: "ai" as const,
        status: "draft" as const,
        direction: g.direction,
        keywords: g.keywords,
        competency_focus: g.competencyFocus,
        cautions: g.cautions || null,
        teacher_points: g.teacherPoints,
        overall_direction: i === 0 ? parsed.overallDirection : null,
        model_tier: "standard",
        prompt_version: "changche_guide_v1_prospective",
        guide_mode: "prospective" as const,
        created_by: userId,
      },
      gridContext,
    ),
  );

  let inserted: { id: string }[];
  try {
    inserted = await insertChangcheGuides(rows as Record<string, unknown>[], supabase);
  } catch (insertError) {
    logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length, mode: "prospective" });
    return { success: false, error: `가이드 저장 실패: ${insertError instanceof Error ? insertError.message : "결과 없음"}` };
  }

  if (inserted.length === 0) {
    return { success: false, error: "가이드 저장 실패: 결과 없음" };
  }

  syncGuideTaskStatus(studentId, "changche_guide", LOG_CTX);

  return {
    success: true,
    data: { ...parsed, summaryId: inserted[0].id },
  };
}

export async function generateChangcheGuide(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
  /** 세특 방향 컨텍스트 (setek_guide 결과 요약) */
  setekGuideContext?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
  /** 파이프라인에서 전달되는 학년별 analysisContext (있으면 report 기반 빌드를 스킵) */
  pipelineAnalysisContext?: import("../types").GuideAnalysisContext,
  /** 파이프라인에서 전달되는 ReportData (있으면 fetchReportData 호출 스킵) */
  cachedReport?: import("@/lib/domains/student-record/actions/report").ReportData,
  /** ctx.belief.profileCard — 학생 정체성 누적 프로필 카드. undefined/"" 시 섹션 생략 */
  studentProfileCard?: string,
  /** 세특 서사 완성도(8단계) 섹션 텍스트. buildNarrativeArcDiagnosisSection() 결과. undefined/"" 시 생략. */
  narrativeArcSection?: string,
  /** MidPlanner 메타 판정 섹션 텍스트. buildMidPlanGuideSection() 결과. undefined/"" 시 생략. */
  midPlanSection?: string,
): Promise<ActionResponse<ChangcheGuideResult & { summaryId: string }>> {
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

    // subject_id → 과목명 매핑 (세특 참고용)
    const supabase = await createSupabaseServerClient();
    const subjectMap = await buildSubjectMap(report.recordDataByGrade, grades);

    // RecordTabData → ChangcheGuideInput 변환
    const recordDataByGrade: ChangcheGuideInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      const haengteukText = data.haengteuk ? resolveEffectiveContent(data.haengteuk).text : "";
      recordDataByGrade[grade] = {
        changche: data.changche
          .filter((c) => resolveEffectiveContent(c).text.length > 0)
          .map((c) => ({
            activity_type: c.activity_type,
            content: resolveEffectiveContent(c).text,
          })),
        seteks: data.seteks
          .filter((s) => resolveEffectiveContent(s).text.length > 0)
          .map((s) => ({
            subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
            content: resolveEffectiveContent(s).text,
          })),
        haengteuk: haengteukText.length > 0 ? { content: haengteukText } : null,
      };
    }

    // 역량 진단 데이터 변환 (컨설턴트 진단 우선, 없으면 AI 진단)
    const { competencyScores, strengths, weaknesses } = extractDiagnosisContext(report.diagnosisData);

    // D→B단계: fetchReportData 결과에서 역량 분석 맥락 구성
    const analysisContext = pipelineAnalysisContext ?? await (async () => {
      const { buildGuideAnalysisContextFromReport } = await import("../../pipeline/pipeline-task-runners");
      return buildGuideAnalysisContextFromReport(report, undefined, "changche");
    })();

    // Phase β G7 — 격자 컨텍스트
    const gridContext = await resolveCellGuideGridContext(
      studentId,
      tenantId,
      supabase,
    );

    const input: ChangcheGuideInput = {
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
      setekGuideContext,
      analysisContext,
      gridContext,
      studentProfileCard,
      narrativeArcSection: narrativeArcSection || undefined,
      midPlanSection: midPlanSection || undefined,
    };

    // AI SDK 호출
    const userPrompt = buildUserPrompt(input);

    const parsed = await callGuideAI(SYSTEM_PROMPT, userPrompt, parseResponse, { maxTokens: 16384, retryLabel: "changcheGuide" });
    if (!parsed) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }
    if (parsed.guides.length === 0) {
      return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다. 다시 시도해주세요." };
    }

    // DB 저장 — changche_guides 테이블에 활동유형별 행 삽입
    const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

    // 기존 AI 가이드 삭제 (재생성 시 중복 방지 — retrospective 범위만)
    const deleteResult = await deleteExistingGuides(
      "student_record_changche_guides",
      { studentId, tenantId, schoolYear: currentSchoolYear, source: "ai", guideMode: "retrospective" },
      LOG_CTX,
    );
    if (deleteResult) return deleteResult;

    const rows = parsed.guides.map((g, i) =>
      applyMainExplorationToRow(
        {
          tenant_id: tenantId,
          student_id: studentId,
          school_year: currentSchoolYear,
          activity_type: g.activityType,
          source: "ai" as const,
          status: "draft" as const,
          direction: g.direction,
          keywords: g.keywords,
          competency_focus: g.competencyFocus,
          cautions: g.cautions || null,
          teacher_points: g.teacherPoints,
          overall_direction: i === 0 ? parsed.overallDirection : null,
          model_tier: "standard",
          prompt_version: "changche_guide_v1",
          guide_mode: "retrospective" as const,
          created_by: userId,
        },
        gridContext,
      ),
    );

    let inserted: { id: string }[];
    try {
      inserted = await insertChangcheGuides(rows as Record<string, unknown>[], supabase);
    } catch (insertError) {
      logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length });
      return { success: false, error: `가이드 저장 실패: ${insertError instanceof Error ? insertError.message : "결과 없음"}` };
    }

    if (inserted.length === 0) {
      return { success: false, error: "가이드 저장 실패: 결과 없음" };
    }

    syncGuideTaskStatus(studentId, "changche_guide", LOG_CTX);

    return {
      success: true,
      data: { ...parsed, summaryId: inserted[0].id },
    };
  } catch (error) {
    return handleLlmActionError(error, "창체 방향 가이드 생성", LOG_CTX);
  }
}
