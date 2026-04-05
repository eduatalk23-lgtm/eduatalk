"use server";

// ============================================
// 행특 방향 가이드 생성 Server Action
// 컨설턴트 내부용 (학생/학부모 비공개)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "../ai-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { fetchReportData } from "../../actions/report";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/haengteukGuide";
import type { HaengteukGuideInput, HaengteukGuideResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { syncPipelineTaskStatus } from "../../actions/pipeline";
import { formatHaengteukItemNames } from "../../evaluation-criteria/defaults";

const LOG_CTX = { domain: "student-record", action: "generateHaengteukGuide" };

// ============================================
// Phase V1: Prospective 행특 방향 — 수강계획+진로 기반
// ============================================

export async function generateProspectiveHaengteukGuide(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("../../actions/report").ReportData,
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null,
  edgePromptSection?: string,
  changcheGuideContext?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
): Promise<ActionResponse<HaengteukGuideResult & { summaryId: string }>> {
  const { logActionDebug: debug } = await import("@/lib/logging/actionLogger");
  debug(LOG_CTX, "prospective 모드 — 수강계획+진로 기반 행특 방향 생성", { studentId });

  const supabase = await createSupabaseServerClient();
  const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

  const plans = coursePlanData?.plans?.filter(
    (p) => p.plan_status === "confirmed" || p.plan_status === "recommended",
  ) ?? [];

  if (plans.length === 0) {
    return { success: false, error: "행특 기록과 수강 계획이 모두 없습니다. 먼저 수강 계획을 입력해주세요." };
  }

  const diagnosis = report.diagnosisData.consultantDiagnosis ?? report.diagnosisData.aiDiagnosis;

  // Impl-4: 이전 분석 학년의 보완방향 주입
  const { buildCrossGradeDirections } = await import("../../pipeline-task-runners-shared");
  const crossGradeDirections = await buildCrossGradeDirections(supabase, studentId, currentSchoolYear);

  const allPlannedNames = [
    ...new Set(
      plans.map((p) => (p.subject as { name?: string } | null)?.name).filter((n): n is string => !!n),
    ),
  ];

  const storylines = report.storylineData.storylines.map((sl) => `- ${sl.title} [${sl.keywords.slice(0, 3).join(", ")}]`).join("\n");

  // setek_guide 컨텍스트 조회 (있으면 방향 보강)
  let setekGuideContext = "";
  try {
    const { data: setekRows } = await supabase
      .from("student_record_setek_guides")
      .select("direction, keywords")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentSchoolYear)
      .eq("source", "ai")
      .limit(3);
    if (setekRows && setekRows.length > 0) {
      const lines = setekRows.map((r) => `- ${r.direction?.slice(0, 80) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`);
      setekGuideContext = `## 세특 방향 요약\n${lines.join("\n")}`;
    }
  } catch (e) {
    // 세특 가이드 조회 실패 시 무시 — 보조 데이터이므로 경미
    logActionWarn(LOG_CTX, "세특 가이드 조회 실패 (prospective 행특 방향 생성 중)", { studentId, error: String(e) });
  }

  const userPrompt = `# 신입생 행특 방향 가이드 요청 (수강계획+진로 기반)

## 학생 정보
- 이름: ${report.student.name ?? "학생"}
- 학년: ${report.student.grade}학년
- 목표 전공: ${report.student.targetMajor ?? "미설정"}
${report.student.targetSubClassificationName ? `- 세부 분류: ${report.student.targetSubClassificationName}` : ""}

## 수강 계획 (confirmed/recommended)
${allPlannedNames.map((n) => `- ${n}`).join("\n")}

${storylines ? `## 스토리라인\n${storylines}\n` : ""}
${(diagnosis?.strengths as string[] | undefined)?.length ? `## 강점 영역\n${(diagnosis.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}\n` : ""}
${(diagnosis?.weaknesses as string[] | undefined)?.length ? `## 보완 영역\n${(diagnosis.weaknesses as string[]).map((w: string) => `- ${w}`).join("\n")}\n` : ""}
${setekGuideContext ? `${setekGuideContext}\n` : ""}
${changcheGuideContext ? `${changcheGuideContext}\n` : ""}
${edgePromptSection ? `${edgePromptSection}\n` : ""}
${crossGradeDirections ? `## 이전 학년 보완방향 (분석 결과 기반)\n→ 아래 보완방향을 이어받아 설계방향에 반영하세요.\n${crossGradeDirections}\n` : ""}

## 지시사항

이 학생은 아직 행특 기록이 없습니다. 수강 계획과 진로를 바탕으로 **앞으로 작성할 행특 방향**을 제안해주세요.
- 수강 예정 과목에서 관찰될 수 있는 인성·태도·성장을 중심으로 방향을 제시합니다
- 7개 평가항목(${formatHaengteukItemNames()})을 예상 수준으로 평가합니다
- 기록이 없으므로 evaluationItems의 reasoning에는 "수강 계획 및 진로 방향 기반 예측"으로 기재합니다
- 진로 적합성과 자기주도적 학습 태도가 드러나도록 방향을 설계합니다
- prompt_version: "haengteuk_guide_v1_prospective"`;

  const result = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: "standard",
    temperature: 0.3,
    maxTokens: 8192,
    responseFormat: "json",
  });

  if (!result.content) {
    return { success: false, error: "AI 응답이 비어있습니다." };
  }

  const parsed = parseResponse(result.content);

  if (!parsed.guide.direction) {
    return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다." };
  }

  // 기존 AI 가이드 삭제 (prospective 범위만)
  const { error: deleteError } = await supabase
    .from("student_record_haengteuk_guides")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentSchoolYear)
    .eq("source", "ai")
    .eq("guide_mode", "prospective");

  if (deleteError) {
    logActionError(LOG_CTX, deleteError, { studentId, phase: "delete_before_insert_prospective" });
    return { success: false, error: `기존 가이드 삭제 실패: ${deleteError.message}` };
  }

  const row = {
    tenant_id: tenantId,
    student_id: studentId,
    school_year: currentSchoolYear,
    source: "ai" as const,
    status: "draft" as const,
    direction: parsed.guide.direction,
    keywords: parsed.guide.keywords,
    competency_focus: parsed.guide.competencyFocus,
    cautions: parsed.guide.cautions || null,
    teacher_points: parsed.guide.teacherPoints,
    evaluation_items: parsed.guide.evaluationItems ?? null,
    overall_direction: parsed.overallDirection || null,
    model_tier: "standard",
    prompt_version: "haengteuk_guide_v1_prospective",
    guide_mode: "prospective" as const,
    created_by: userId,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("student_record_haengteuk_guides")
    .insert(row)
    .select("id")
    .single();

  if (insertError || !inserted) {
    logActionError(LOG_CTX, insertError, { studentId, mode: "prospective" });
    return { success: false, error: `가이드 저장 실패: ${insertError?.message ?? "결과 없음"}` };
  }

  syncPipelineTaskStatus(studentId, "haengteuk_guide").catch((err) =>
      logActionWarn(LOG_CTX, "파이프라인 상태 동기화 실패", { studentId, task: "haengteuk_guide", error: String(err) }),
    );

  return {
    success: true,
    data: { ...parsed, summaryId: inserted.id },
  };
}

export async function generateHaengteukGuide(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
  /** 창체 방향 컨텍스트 (changche_guide 결과 요약) */
  changcheGuideContext?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
): Promise<ActionResponse<HaengteukGuideResult & { summaryId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // fetchReportData 재사용
    const reportResult = await fetchReportData(studentId);
    if (!reportResult.success || !reportResult.data) {
      return {
        success: false,
        error: reportResult.success === false ? reportResult.error : "데이터 수집 실패",
      };
    }

    const report = reportResult.data;
    const studentGrade = report.student.grade;
    const grades = targetGrades ?? Array.from({ length: studentGrade }, (_, i) => i + 1);

    // subject_id → 과목명 매핑 (세특 참고용)
    const supabase = await createSupabaseServerClient();
    const allSubjectIds = new Set<string>();
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;
      for (const s of data.seteks) allSubjectIds.add(s.subject_id);
    }
    const subjectMap = new Map<string, string>();
    if (allSubjectIds.size > 0) {
      const { data: subjects } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", [...allSubjectIds]);
      for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
    }

    // RecordTabData → HaengteukGuideInput 변환
    const recordDataByGrade: HaengteukGuideInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      recordDataByGrade[grade] = {
        haengteuk: (data.haengteuk?.imported_content?.trim() || data.haengteuk?.content)
          ? { content: data.haengteuk?.imported_content?.trim() ? data.haengteuk.imported_content : (data.haengteuk?.content ?? "") }
          : null,
        changche: data.changche
          .filter((c) => c.content || c.imported_content)
          .map((c) => ({
            activity_type: c.activity_type,
            content: c.imported_content?.trim() ? c.imported_content : (c.content || ""),
          })),
        seteks: data.seteks
          .filter((s) => s.content || s.imported_content)
          .map((s) => ({
            subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
            content: s.imported_content?.trim() ? s.imported_content : (s.content || ""),
          })),
      };
    }

    // 역량 진단 데이터 변환 (컨설턴트 진단 우선, 없으면 AI 진단)
    const diagnosisData = report.diagnosisData;
    const competencyScores = (
      diagnosisData.competencyScores.consultant.length > 0
        ? diagnosisData.competencyScores.consultant
        : diagnosisData.competencyScores.ai
    ).map((cs) => ({
      item: cs.competency_item,
      grade: cs.grade_value,
      narrative: cs.narrative ?? undefined,
    }));

    // 강점/약점 추출 (컨설턴트 진단 우선)
    const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
    const strengths = diagnosis?.strengths as string[] | undefined;
    const weaknesses = diagnosis?.weaknesses as string[] | undefined;

    // D→B단계: fetchReportData 결과에서 역량 분석 맥락 구성
    const { buildGuideAnalysisContextFromReport } = await import("../../pipeline-task-runners");
    const analysisContext = buildGuideAnalysisContextFromReport(report, undefined, "haengteuk");

    const input: HaengteukGuideInput = {
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
      changcheGuideContext,
      analysisContext,
    };

    // AI SDK 호출
    const userPrompt = buildUserPrompt(input);

    const result = await generateTextWithRateLimit({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.3,
      maxTokens: 8192,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    const parsed = parseResponse(result.content);

    if (!parsed.guide.direction) {
      return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다. 다시 시도해주세요." };
    }

    // DB 저장 — haengteuk_guides 테이블에 1행 삽입
    const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

    // 기존 AI 가이드 삭제 (재생성 시 중복 방지 — retrospective 범위만)
    const { error: deleteError } = await supabase
      .from("student_record_haengteuk_guides")
      .delete()
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentSchoolYear)
      .eq("source", "ai")
      .eq("guide_mode", "retrospective");

    if (deleteError) {
      logActionError(LOG_CTX, deleteError, { studentId, phase: "delete_before_insert" });
      return { success: false, error: `기존 가이드 삭제 실패: ${deleteError.message}` };
    }

    const row = {
      tenant_id: tenantId,
      student_id: studentId,
      school_year: currentSchoolYear,
      source: "ai" as const,
      status: "draft" as const,
      direction: parsed.guide.direction,
      keywords: parsed.guide.keywords,
      competency_focus: parsed.guide.competencyFocus,
      cautions: parsed.guide.cautions || null,
      teacher_points: parsed.guide.teacherPoints,
      evaluation_items: parsed.guide.evaluationItems ?? null,
      overall_direction: parsed.overallDirection || null,
      model_tier: "standard",
      prompt_version: "haengteuk_guide_v1",
      guide_mode: "retrospective" as const,
      created_by: userId,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("student_record_haengteuk_guides")
      .insert(row)
      .select("id")
      .single();

    if (insertError || !inserted) {
      logActionError(LOG_CTX, insertError, { studentId });
      return { success: false, error: `가이드 저장 실패: ${insertError?.message ?? "결과 없음"}` };
    }

    // 파이프라인 상태 동기화 (fire-and-forget)
    syncPipelineTaskStatus(studentId, "haengteuk_guide").catch((err) =>
      logActionWarn(LOG_CTX, "파이프라인 상태 동기화 실패", { studentId, task: "haengteuk_guide", error: String(err) }),
    );

    return {
      success: true,
      data: { ...parsed, summaryId: inserted.id },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (error instanceof SyntaxError || msg.includes("JSON")) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }

    return { success: false, error: "행특 방향 가이드 생성 중 오류가 발생했습니다." };
  }
}
