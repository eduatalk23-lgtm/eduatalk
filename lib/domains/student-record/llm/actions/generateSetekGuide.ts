"use server";

// ============================================
// Phase 9.3 — 세특 방향 가이드 생성 Server Action
// 컨설턴트 내부용 (학생/학부모 비공개)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { fetchReportData } from "../../actions/report";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/setekGuide";
import type { SetekGuideInput, SetekGuideResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { syncPipelineTaskStatus } from "../../actions/pipeline";

const LOG_CTX = { domain: "student-record", action: "generateSetekGuide" };

export async function generateSetekGuide(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 (미지정 시 calculateSchoolYear() 사용) */
  targetSchoolYear?: number,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
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

    // subject_id → 과목명 매핑
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

    // RecordTabData → SetekGuideInput 변환
    const recordDataByGrade: SetekGuideInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      recordDataByGrade[grade] = {
        seteks: data.seteks
          .filter((s) => s.content || s.imported_content)
          .map((s) => ({
            subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
            content: s.content || s.imported_content!,
          })),
        changche: data.changche
          .filter((c) => c.content || c.imported_content)
          .map((c) => ({
            activity_type: c.activity_type,
            content: c.content || c.imported_content!,
          })),
      };
    }

    // 데이터 유무 → 모드 결정
    const hasAnyData = Object.values(recordDataByGrade).some(
      (d) => d.seteks.length > 0,
    );

    // Phase R2: 기록 없으면 prospective 모드로 전환
    if (!hasAnyData) {
      return generateProspectiveSetekGuide(studentId, tenantId, userId, report, grades, edgePromptSection, targetSchoolYear);
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
    };

    // AI SDK 호출
    const userPrompt = buildUserPrompt(input);

    const result = await generateTextWithRateLimit({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.3,
      maxTokens: 32768,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    const parsed = parseResponse(result.content);

    if (parsed.guides.length === 0) {
      return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다. 다시 시도해주세요." };
    }

    // DB 저장 — setek_guides 테이블에 과목별 행 삽입
    const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

    // 과목명 → subject_id 역매핑
    const nameToSubjectId = new Map<string, string>();
    for (const [id, name] of subjectMap) nameToSubjectId.set(name, id);

    // 기존 AI 가이드 삭제 (재생성 시 중복 방지)
    const { error: deleteError } = await supabase
      .from("student_record_setek_guides")
      .delete()
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentSchoolYear)
      .eq("source", "ai");

    if (deleteError) {
      logActionError(LOG_CTX, deleteError, { studentId, phase: "delete_before_insert" });
      return { success: false, error: `기존 가이드 삭제 실패: ${deleteError.message}` };
    }

    const rows = parsed.guides
      .map((g, i) => {
        const subjectId = nameToSubjectId.get(g.subjectName);
        if (!subjectId) return null;
        return {
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
          created_by: userId,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      return { success: false, error: "매칭 가능한 과목이 없습니다." };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("student_record_setek_guides")
      .insert(rows)
      .select("id");

    if (insertError || !inserted?.length) {
      logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length });
      return { success: false, error: `가이드 저장 실패: ${insertError?.message ?? "결과 없음"}` };
    }

    // 파이프라인 상태 동기화 (fire-and-forget)
    syncPipelineTaskStatus(studentId, "setek_guide").catch((err) =>
      logActionWarn(LOG_CTX, "파이프라인 상태 동기화 실패", { studentId, task: "setek_guide", error: String(err) }),
    );

    return {
      success: true,
      data: { ...parsed, summaryId: inserted[0].id },
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

    return { success: false, error: "세특 방향 가이드 생성 중 오류가 발생했습니다." };
  }
}

// ============================================
// Phase R2: Prospective 모드 — 기록 없이 계획 과목 기반
// ============================================

export async function generateProspectiveSetekGuide(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("../../actions/report").ReportData,
  grades: number[],
  edgePromptSection?: string,
  /** Phase V2: 3년 가상본 — 저장 대상 school_year 명시 */
  targetSchoolYear?: number,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
  const { logActionDebug: debug } = await import("@/lib/logging/actionLogger");
  debug(LOG_CTX, "prospective 모드 — 수강계획 기반 세특 방향 생성", { studentId });

  const supabase = await createSupabaseServerClient();
  const currentSchoolYear = targetSchoolYear ?? calculateSchoolYear();

  // 수강 계획 조회
  const { fetchCoursePlanTabData } = await import("../../actions/coursePlan");
  const coursePlanRes = await fetchCoursePlanTabData(studentId).catch(() => null);
  const coursePlanData = coursePlanRes?.success ? coursePlanRes.data : null;

  // 계획 과목 (confirmed + recommended)
  const plans = coursePlanData?.plans?.filter((p) =>
    p.plan_status === "confirmed" || p.plan_status === "recommended",
  ) ?? [];

  if (plans.length === 0) {
    return { success: false, error: "세특 기록과 수강 계획이 모두 없습니다. 먼저 진로 설정 또는 세특을 입력해주세요." };
  }

  // 가이드 배정 컨텍스트
  const { buildGuideContextSection } = await import("../../guide-context");
  const guideSection = await buildGuideContextSection(studentId, "guide").catch(() => "");

  // 진단 데이터 (있으면 사용)
  const diagnosis = report.diagnosisData.consultantDiagnosis ?? report.diagnosisData.aiDiagnosis;

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
  };

  const userPrompt = buildUserPrompt(input);

  const result = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: "standard",
    temperature: 0.3,
    maxTokens: 32768,
    responseFormat: "json",
  });

  if (!result.content) {
    return { success: false, error: "AI 응답이 비어있습니다." };
  }

  const parsed = parseResponse(result.content);
  if (parsed.guides.length === 0) {
    return { success: false, error: "AI가 유효한 가이드를 생성하지 못했습니다." };
  }

  // 과목명 → subject_id 매핑 (계획 과목에서)
  const nameToSubjectId = new Map<string, string>();
  for (const p of plans) {
    if (p.subject?.name) nameToSubjectId.set(p.subject.name, p.subject_id);
  }

  // 기존 AI 가이드 삭제
  const { error: deleteError } = await supabase
    .from("student_record_setek_guides")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentSchoolYear)
    .eq("source", "ai");

  if (deleteError) {
    logActionError(LOG_CTX, deleteError, { studentId, phase: "delete_before_insert_prospective" });
    return { success: false, error: `기존 가이드 삭제 실패: ${deleteError.message}` };
  }

  const rows = parsed.guides
    .map((g, i) => {
      const subjectId = nameToSubjectId.get(g.subjectName);
      if (!subjectId) return null;
      return {
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
        created_by: userId,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return { success: false, error: "매칭 가능한 과목이 없습니다." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("student_record_setek_guides")
    .insert(rows)
    .select("id");

  if (insertError || !inserted?.length) {
    logActionError(LOG_CTX, insertError, { studentId, rowCount: rows.length, mode: "prospective" });
    return { success: false, error: `가이드 저장 실패: ${insertError?.message ?? "결과 없음"}` };
  }

  syncPipelineTaskStatus(studentId, "setek_guide").catch((err) =>
      logActionWarn(LOG_CTX, "파이프라인 상태 동기화 실패", { studentId, task: "setek_guide", error: String(err) }),
    );

  return {
    success: true,
    data: { ...parsed, summaryId: inserted[0].id },
  };
}
