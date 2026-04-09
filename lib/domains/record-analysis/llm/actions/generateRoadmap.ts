"use server";

// ============================================
// Phase R1 — AI 3개년 활동 로드맵 생성 Server Action
// planning 모드: 기록 없는 신규 학생 (수강계획+스토리라인 기반)
// analysis 모드: 기존 학생 (진단+기존활동 추가 고려)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  ROADMAP_SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/roadmapGeneration";
import type { RoadmapGenerationInput, RoadmapGenerationOutput } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "generateRoadmap" };

export async function generateAiRoadmap(
  studentId: string,
  forceMode?: "planning" | "analysis",
): Promise<ActionResponse<RoadmapGenerationOutput>> {
  try {
    const { tenantId: rawTenantId } = await requireAdminOrConsultant();
    if (!rawTenantId) return { success: false, error: "테넌트 정보가 없습니다." };
    const tenantId = rawTenantId;
    const supabase = await createSupabaseServerClient();
    const currentSchoolYear = calculateSchoolYear();

    // 학생 정보 조회
    const { data: student } = await supabase
      .from("students")
      .select("grade, target_major, target_sub_classification_id, school_name, user_profiles(name)")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const studentGrade = (student.grade as number) ?? 1;
    const targetMajor = (student.target_major as string) ?? undefined;
    const studentName = (student.user_profiles as { name?: string } | null)?.name ?? "학생";

    // 모드 자동 감지
    let mode: "planning" | "analysis" = forceMode ?? "planning";
    if (!forceMode) {
      const { count: setekCount } = await supabase
        .from("student_record_seteks")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .not("content", "eq", "")
        .is("deleted_at", null);

      mode = (setekCount ?? 0) > 0 ? "analysis" : "planning";
    }

    logActionDebug(LOG_CTX, `로드맵 생성 모드: ${mode}`, { studentId, studentGrade });

    // 교육과정 연도 결정
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const enrollmentYear = currentSchoolYear - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);

    // 병렬 데이터 수집
    const { fetchCoursePlanTabData } = await import("@/lib/domains/student-record/actions/coursePlan");
    const repository = await import("@/lib/domains/student-record/repository");
    const { buildGuideContextSection } = await import("@/lib/domains/student-record/guide-context");
    const { getMajorRecommendedCourses } = await import("@/lib/domains/student-record/constants");

    const [
      coursePlanRes,
      storylines,
      guideSection,
    ] = await Promise.all([
      fetchCoursePlanTabData(studentId).catch(() => null),
      repository.findStorylinesByStudent(studentId, tenantId),
      buildGuideContextSection(studentId, "guide").catch(() => ""),
    ]);
    const coursePlanResult = coursePlanRes?.success ? coursePlanRes.data : null;

    // 추천 과목 조회
    let recommendedCourses: RoadmapGenerationInput["recommendedCourses"];
    if (targetMajor) {
      const recs = getMajorRecommendedCourses(targetMajor, curriculumYear);
      if (recs) {
        recommendedCourses = [
          ...recs.general.map((name) => ({ name, type: "general" as const })),
          ...recs.career.map((name) => ({ name, type: "career" as const })),
          ...(recs.fusion ?? []).map((name) => ({ name, type: "fusion" as const })),
        ];
      }
    }

    // 수강 계획 변환
    const coursePlans: RoadmapGenerationInput["coursePlans"] = coursePlanResult?.plans?.map((p) => ({
      subjectName: p.subject?.name ?? "과목 미정",
      grade: p.grade,
      semester: p.semester,
      status: p.plan_status,
      subjectType: p.subject?.subject_type?.name ?? undefined,
    }));

    // 입력 조립
    const input: RoadmapGenerationInput = {
      mode,
      studentName,
      grade: studentGrade,
      targetMajor,
      targetSubClassificationName: undefined,
      curriculumYear,
      coursePlans,
      storylines: storylines.map((sl) => ({
        id: sl.id,
        title: sl.title,
        career_field: sl.career_field,
        keywords: sl.keywords ?? [],
        grade_1_theme: sl.grade_1_theme,
        grade_2_theme: sl.grade_2_theme,
        grade_3_theme: sl.grade_3_theme,
      })),
      guideAssignments: guideSection || undefined,
      recommendedCourses,
    };

    // analysis 모드 전용 데이터
    if (mode === "analysis") {
      const diagnosisRepo = await import("@/lib/domains/student-record/repository/diagnosis-repository");
      const { fetchSetekGuides } = await import("@/lib/domains/student-record/actions/activitySummary");

      const [diagnosis, setekGuidesRes] = await Promise.all([
        diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
        fetchSetekGuides(studentId).catch(() => ({ success: false as const, error: "" })),
      ]);

      if (diagnosis) {
        input.diagnosisStrengths = diagnosis.strengths ?? [];
        input.diagnosisWeaknesses = diagnosis.weaknesses ?? [];
        if (Array.isArray(diagnosis.improvements)) {
          input.diagnosisImprovements = (diagnosis.improvements as Array<{ priority: string; area: string; action: string }>);
        }
      }

      if (setekGuidesRes.success && setekGuidesRes.data) {
        input.setekGuides = setekGuidesRes.data.map((g) => ({
          subjectName: g.subject_id, // subject_id — pipeline에서 subject name 조인은 별도로 하지 않음
          direction: g.direction ?? "",
          keywords: g.keywords ?? [],
        }));
      }

      // 기존 활동 요약 (기존 로드맵에서 execution_content가 있는 것)
      const existingRoadmap = await repository.findAllRoadmapItemsByStudent(studentId, tenantId);
      const executed = existingRoadmap.filter((r) => r.execution_content);
      if (executed.length > 0) {
        input.existingActivities = executed.map((r) => ({
          grade: r.grade,
          area: r.area,
          content: r.execution_content!,
        }));
      }
    }

    // LLM 호출
    const userPrompt = buildUserPrompt(input);
    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: ROADMAP_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "standard",
        temperature: 0.4,
        maxTokens: 8192,
        responseFormat: "json",
      }),
      { label: "generateAiRoadmap" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseResponse(result.content);

    if (parsed.items.length === 0) {
      return { success: false, error: "로드맵 항목을 생성하지 못했습니다." };
    }

    // 기존 AI 로드맵 삭제 (재실행 안전성)
    const existing = await repository.findAllRoadmapItemsByStudent(studentId, tenantId);
    const aiItems = existing.filter((r) => r.plan_content.startsWith("[AI]"));
    if (aiItems.length > 0) {
      await Promise.allSettled(aiItems.map((r) => repository.deleteRoadmapItemById(r.id)));
    }

    // storyline_title → storyline_id 매핑
    const storylineMap = new Map(storylines.map((sl) => [sl.title, sl.id]));
    const baseSortOrder = existing.filter((r) => !r.plan_content.startsWith("[AI]")).length;

    // DB 저장
    let savedCount = 0;
    await Promise.allSettled(
      parsed.items.map((item, i) =>
        repository.insertRoadmapItem({
          tenant_id: tenantId,
          student_id: studentId,
          school_year: currentSchoolYear - studentGrade + item.grade,
          grade: item.grade,
          semester: item.semester,
          area: item.area,
          plan_content: `[AI] ${item.plan_content}`,
          plan_keywords: item.plan_keywords,
          planned_at: new Date().toISOString(),
          storyline_id: item.storyline_title ? (storylineMap.get(item.storyline_title) ?? null) : null,
          sort_order: baseSortOrder + i,
        }).then(() => { savedCount++; }),
      ),
    );

    logActionDebug(LOG_CTX, `로드맵 ${savedCount}/${parsed.items.length}건 저장 완료 (${mode})`, { studentId });

    return { success: true, data: parsed };
  } catch (error) {
    return handleLlmActionError(error, "로드맵 생성", LOG_CTX);
  }
}
