"use server";

/**
 * 향상된 AI 콘텐츠 추천 서버 액션
 *
 * Phase 6: 추천 관련성 개선
 *
 * 기존 추천 기능에 다음을 추가:
 * - 매칭 점수 세분화
 * - 시너지 콘텐츠 추천
 * - 난이도 진행 적용
 * - 학습 속도 기반 예상 완료 기간
 * - 시험 일정 반영
 *
 * @module enhancedRecommendContent
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

import { createMessage, extractJSON, estimateCost } from "../client";
import {
  ENHANCED_CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
  buildEnhancedContentRecommendationPrompt,
  estimateEnhancedRecommendationTokens,
  validateEnhancedRecommendationResponse,
  calculateDaysUntilExam,
  type EnhancedContentRecommendationRequest,
  type EnhancedContentRecommendationResponse,
  type EnhancedRecommendedContent,
  type ExamInfo,
  type LearningVelocity,
  type ContentCompletionHistory,
} from "../prompts/enhancedContentRecommendation";

import type { ModelTier } from "../types";

import {
  loadStudentProfile,
  loadScoreInfo,
  loadLearningPattern,
  loadOwnedContents,
  loadCandidateContents,
  type SupabaseClient,
} from "../loaders";

// ============================================
// 타입 정의
// ============================================

export interface EnhancedRecommendContentInput {
  /** 학생 ID */
  studentId: string;
  /** 추천할 과목 카테고리 (없으면 전체) */
  subjectCategories?: string[];
  /** 추천 개수 (기본값: 5) */
  maxRecommendations?: number;
  /** 추천 포커스 */
  focusArea?: "weak_subjects" | "all_subjects" | "exam_prep";
  /** 시너지 콘텐츠 추천 포함 */
  includeSynergy?: boolean;
  /** 난이도 진행 적용 */
  applyDifficultyProgression?: boolean;
  /** 추가 지시사항 */
  additionalInstructions?: string;
  /** 모델 티어 (기본값: standard - 세부 분석 필요) */
  modelTier?: ModelTier;
}

export interface EnhancedRecommendContentResult {
  success: boolean;
  data?: {
    recommendations: EnhancedRecommendedContent[];
    summary: EnhancedContentRecommendationResponse["summary"];
    insights: EnhancedContentRecommendationResponse["insights"];
    synergies?: EnhancedContentRecommendationResponse["synergies"];
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
  };
  error?: string;
}

// ============================================
// 향상된 데이터 로드 함수 (고유)
// ============================================

async function loadLearningVelocity(
  supabase: SupabaseClient,
  studentId: string
): Promise<LearningVelocity | undefined> {
  // 최근 30일 학습 속도 계산
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: plans } = await supabase
    .from("student_plan")
    .select("estimated_minutes, actual_minutes, range_start, range_end, content_type, plan_date")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!plans || plans.length < 5) return undefined;

  // 페이지 수 계산
  const bookPlans = plans.filter((p) => p.content_type === "book" && p.range_start && p.range_end);
  const totalPages = bookPlans.reduce((sum, p) => sum + ((p.range_end || 0) - (p.range_start || 0) + 1), 0);

  // 강의 수 계산
  const lecturePlans = plans.filter((p) => p.content_type === "lecture" && p.range_start && p.range_end);
  const totalLectures = lecturePlans.reduce((sum, p) => sum + ((p.range_end || 0) - (p.range_start || 0) + 1), 0);

  // 평균 세션 시간
  const totalMinutes = plans.reduce((sum, p) => sum + (p.actual_minutes || p.estimated_minutes || 0), 0);
  const avgSessionMinutes = Math.round(totalMinutes / plans.length);

  // 학습 일수
  const uniqueDates = new Set(plans.map((p) => p.plan_date));
  const studyDaysPerWeek = Math.round((uniqueDates.size / 30) * 7);

  return {
    pagesPerDay: bookPlans.length > 0 ? Math.round(totalPages / 30) : undefined,
    lecturesPerDay: lecturePlans.length > 0 ? Math.round(totalLectures / 30 * 10) / 10 : undefined,
    avgSessionMinutes,
    studyDaysPerWeek,
  };
}

async function loadExams(
  supabase: SupabaseClient,
  studentId: string
): Promise<ExamInfo[]> {
  const today = new Date().toISOString().split("T")[0];
  const sixtyDaysLater = new Date();
  sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);

  const { data: exams } = await supabase
    .from("exam_schedules")
    .select("id, exam_name, exam_date, exam_type, subjects")
    .eq("student_id", studentId)
    .gte("exam_date", today)
    .lte("exam_date", sixtyDaysLater.toISOString().split("T")[0])
    .order("exam_date", { ascending: true });

  if (!exams || exams.length === 0) return [];

  return exams.map((e) => ({
    examName: e.exam_name,
    examDate: e.exam_date,
    examType: e.exam_type as ExamInfo["examType"],
    subjects: e.subjects ?? undefined,
    daysUntil: calculateDaysUntilExam(e.exam_date),
  }));
}

async function loadCompletionHistory(
  supabase: SupabaseClient,
  studentId: string
): Promise<ContentCompletionHistory[]> {
  // 최근 3개월 내 완료한 콘텐츠
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: completedPlans } = await supabase
    .from("plan_groups")
    .select(`
      id,
      name,
      start_date,
      end_date,
      status
    `)
    .eq("student_id", studentId)
    .eq("status", "completed")
    .gte("end_date", threeMonthsAgo.toISOString().split("T")[0])
    .limit(10);

  if (!completedPlans || completedPlans.length === 0) return [];

  // 간략한 히스토리 반환 (상세 쿼리는 비용 고려하여 생략)
  return completedPlans.map((p) => {
    const startDate = new Date(p.start_date);
    const endDate = new Date(p.end_date);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      contentId: p.id,
      contentType: "book" as const,
      subject: "mixed",
      completedAt: p.end_date,
      durationDays,
      difficulty: "medium" as const,
    };
  });
}

// ============================================
// 메인 액션
// ============================================

/**
 * 향상된 AI 콘텐츠 추천
 *
 * 기존 추천 기능에 매칭 점수 세분화, 시너지 추천, 난이도 진행, 시험 대비를 추가합니다.
 *
 * @param input - 향상된 추천 입력
 * @returns 향상된 추천 결과
 */
export async function enhancedRecommendContentWithAI(
  input: EnhancedRecommendContentInput
): Promise<EnhancedRecommendContentResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 1. 학생 프로필 로드
    const studentProfile = await loadStudentProfile(supabase, input.studentId);
    if (!studentProfile) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 2. 관련 데이터 병렬 로드 (향상된 데이터 포함)
    const [
      scores,
      learningPattern,
      velocity,
      exams,
      completionHistory,
      ownedContents,
      candidateContents,
    ] = await Promise.all([
      loadScoreInfo(supabase, input.studentId),
      loadLearningPattern(supabase, input.studentId),
      loadLearningVelocity(supabase, input.studentId),
      loadExams(supabase, input.studentId),
      loadCompletionHistory(supabase, input.studentId),
      loadOwnedContents(supabase, input.studentId),
      loadCandidateContents(supabase, input.subjectCategories, 50),
    ]);

    if (candidateContents.length === 0) {
      return { success: false, error: "추천 가능한 콘텐츠가 없습니다." };
    }

    // 3. 이미 보유한 콘텐츠 제외
    const ownedIds = new Set(ownedContents.map((c) => c.id));
    const filteredCandidates = candidateContents.filter((c) => !ownedIds.has(c.id));

    if (filteredCandidates.length === 0) {
      return { success: false, error: "추천할 새로운 콘텐츠가 없습니다." };
    }

    // 4. 향상된 LLM 요청 빌드
    const llmRequest: EnhancedContentRecommendationRequest = {
      student: studentProfile,
      scores,
      learningPattern,
      ownedContents,
      candidateContents: filteredCandidates.slice(0, 30),
      maxRecommendations: input.maxRecommendations || 5,
      focusArea: input.focusArea,
      additionalInstructions: input.additionalInstructions,
      // 향상된 필드
      exams: exams.length > 0 ? exams : undefined,
      velocity,
      completionHistory: completionHistory.length > 0 ? completionHistory : undefined,
      includeSynergy: input.includeSynergy ?? true,
      applyDifficultyProgression: input.applyDifficultyProgression ?? true,
    };

    // 5. 토큰 추정 로깅
    const tokenEstimate = estimateEnhancedRecommendationTokens(llmRequest);
    console.log(`[Enhanced AI Content Rec] 예상 토큰: ${tokenEstimate.totalTokens}`);

    // 6. LLM 호출 (standard 모델 권장 - 세부 분석 필요)
    const modelTier = input.modelTier || "standard";
    const userPrompt = buildEnhancedContentRecommendationPrompt(llmRequest);

    const result = await createMessage({
      system: ENHANCED_CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 7. 응답 파싱
    const parsed = extractJSON<EnhancedContentRecommendationResponse>(result.content);

    if (!parsed || !parsed.recommendations) {
      console.error("[Enhanced AI Content Rec] 파싱 실패:", result.content.substring(0, 500));
      return { success: false, error: "추천 결과 파싱에 실패했습니다." };
    }

    // 8. 응답 검증
    const validContentIds = new Set(filteredCandidates.map((c) => c.id));
    const validation = validateEnhancedRecommendationResponse(parsed, validContentIds);

    if (validation.validRecommendations.length === 0) {
      console.warn("[Enhanced AI Content Rec] 유효한 추천 없음:", validation.errors);
      return { success: false, error: "유효한 추천 결과가 없습니다." };
    }

    // 9. 비용 계산
    const estimatedCost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      success: true,
      data: {
        recommendations: validation.validRecommendations,
        summary: {
          ...parsed.summary,
          totalRecommended: validation.validRecommendations.length,
        },
        insights: parsed.insights,
        synergies: parsed.synergies,
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD: estimatedCost,
        },
      },
    };
  } catch (error) {
    console.error("[Enhanced AI Content Rec] 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 생성 중 오류가 발생했습니다.",
    };
  }
}
