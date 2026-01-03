"use server";

/**
 * AI 콘텐츠 추천 서버 액션
 *
 * Claude API를 사용하여 학생에게 최적의 학습 콘텐츠를 추천합니다.
 * 관리자가 학생 플랜을 생성할 때 사용됩니다.
 *
 * @module recommendContent
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

import { createMessage, extractJSON, estimateCost } from "../client";
import {
  CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
  buildContentRecommendationPrompt,
  estimateContentRecommendationTokens,
  type ContentRecommendationRequest,
  type ContentRecommendationResponse,
  type StudentProfile,
  type SubjectScoreInfo,
  type LearningPatternInfo,
  type OwnedContentInfo,
  type ContentCandidate,
} from "../prompts/contentRecommendation";

import type { ModelTier } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface RecommendContentInput {
  /** 학생 ID */
  studentId: string;
  /** 추천할 과목 카테고리 (없으면 전체) */
  subjectCategories?: string[];
  /** 추천 개수 (기본값: 5) */
  maxRecommendations?: number;
  /** 추천 포커스 */
  focusArea?: "weak_subjects" | "all_subjects" | "exam_prep";
  /** 추가 지시사항 */
  additionalInstructions?: string;
  /** 모델 티어 (기본값: fast - 비용 효율적) */
  modelTier?: ModelTier;
}

export interface RecommendContentResult {
  success: boolean;
  data?: {
    recommendations: ContentRecommendationResponse["recommendations"];
    summary: ContentRecommendationResponse["summary"];
    insights: ContentRecommendationResponse["insights"];
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
  };
  error?: string;
}

// ============================================
// 데이터 로드 함수
// ============================================

async function loadStudentProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<StudentProfile | null> {
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, school_name, target_university, target_major")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    school: student.school_name ?? undefined,
    targetUniversity: student.target_university ?? undefined,
    targetMajor: student.target_major ?? undefined,
  };
}

async function loadScoreInfo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<SubjectScoreInfo[]> {
  // 최근 성적 + 위험도 분석 데이터 조회
  const { data: scores } = await supabase
    .from("scores")
    .select(`
      id,
      subject,
      subject_category,
      grade,
      percentile,
      score_type,
      created_at
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!scores || scores.length === 0) return [];

  // 과목별로 그룹화하여 최신 성적 추출
  const subjectMap = new Map<string, SubjectScoreInfo>();

  scores.forEach((score) => {
    const key = `${score.subject_category}-${score.subject}`;

    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subjectId: score.id,
        subject: score.subject,
        subjectCategory: score.subject_category,
        latestGrade: score.grade ?? undefined,
        latestPercentile: score.percentile ?? undefined,
      });
    }
  });

  // 위험도 분석 데이터 조회
  const { data: riskData } = await supabase
    .from("student_risk_analysis")
    .select("subject, risk_score, recent_grade_trend")
    .eq("student_id", studentId);

  if (riskData) {
    riskData.forEach((risk) => {
      // 해당 과목 찾기
      subjectMap.forEach((info, key) => {
        if (info.subject === risk.subject || key.includes(risk.subject)) {
          info.riskScore = risk.risk_score ?? undefined;
          info.recentTrend = risk.recent_grade_trend > 0
            ? "improving"
            : risk.recent_grade_trend < 0
              ? "declining"
              : "stable";
          info.isWeak = (risk.risk_score ?? 0) >= 60;
        }
      });
    });
  }

  return Array.from(subjectMap.values());
}

async function loadLearningPattern(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<LearningPatternInfo | undefined> {
  // 학습 패턴 데이터 조회
  const { data: pattern } = await supabase
    .from("student_learning_patterns")
    .select("preferred_study_times, strong_days, weak_days")
    .eq("student_id", studentId)
    .single();

  // 최근 30일 통계 계산
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: plans } = await supabase
    .from("student_plan")
    .select("status, progress, estimated_minutes")
    .eq("student_id", studentId)
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!plans || plans.length === 0) {
    return pattern
      ? {
          preferredStudyTimes: pattern.preferred_study_times ?? undefined,
        }
      : undefined;
  }

  const completed = plans.filter((p) => p.status === "completed").length;
  const completionRate = Math.round((completed / plans.length) * 100);
  const avgMinutes = Math.round(
    plans.reduce((sum, p) => sum + (p.estimated_minutes || 0), 0) / 30
  );

  return {
    preferredStudyTimes: pattern?.preferred_study_times ?? undefined,
    averageDailyMinutes: avgMinutes,
    completionRate,
  };
}

async function loadOwnedContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<OwnedContentInfo[]> {
  // 학생의 보유 콘텐츠 조회 (책 + 강의)
  const { data: books } = await supabase
    .from("student_books")
    .select(`
      id,
      title,
      subject,
      subject_group_name,
      completed_pages,
      total_pages
    `)
    .eq("student_id", studentId);

  const { data: lectures } = await supabase
    .from("student_lectures")
    .select(`
      id,
      title,
      subject,
      subject_group_name,
      completed_episodes,
      total_episodes
    `)
    .eq("student_id", studentId);

  const contents: OwnedContentInfo[] = [];

  if (books) {
    books.forEach((b) => {
      const completedPercentage = b.total_pages && b.completed_pages
        ? Math.round((b.completed_pages / b.total_pages) * 100)
        : undefined;

      contents.push({
        id: b.id,
        title: b.title,
        subject: b.subject ?? "",
        subjectCategory: b.subject_group_name ?? "",
        contentType: "book",
        completedPercentage,
      });
    });
  }

  if (lectures) {
    lectures.forEach((l) => {
      const completedPercentage = l.total_episodes && l.completed_episodes
        ? Math.round((l.completed_episodes / l.total_episodes) * 100)
        : undefined;

      contents.push({
        id: l.id,
        title: l.title,
        subject: l.subject ?? "",
        subjectCategory: l.subject_group_name ?? "",
        contentType: "lecture",
        completedPercentage,
      });
    });
  }

  return contents;
}

async function loadCandidateContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  subjectCategories?: string[],
  limit: number = 50
): Promise<ContentCandidate[]> {
  // 마스터 콘텐츠에서 추천 후보 조회
  let query = supabase
    .from("content_masters")
    .select(`
      id,
      title,
      subject,
      subject_category,
      content_type,
      difficulty_level,
      publisher,
      platform,
      total_pages,
      total_episodes,
      description
    `)
    .eq("is_active", true)
    .limit(limit);

  if (subjectCategories && subjectCategories.length > 0) {
    query = query.in("subject_category", subjectCategories);
  }

  const { data: contents } = await query;

  if (!contents) return [];

  return contents.map((c) => ({
    id: c.id,
    title: c.title,
    subject: c.subject ?? "",
    subjectCategory: c.subject_category ?? "",
    contentType: c.content_type as "book" | "lecture",
    difficulty: c.difficulty_level as "easy" | "medium" | "hard" | undefined,
    publisher: c.publisher ?? undefined,
    platform: c.platform ?? undefined,
    description: c.description ?? undefined,
    totalPages: c.total_pages ?? undefined,
    totalLectures: c.total_episodes ?? undefined,
  }));
}

// ============================================
// 메인 액션
// ============================================

/**
 * Claude API를 사용하여 학생에게 최적의 학습 콘텐츠를 추천합니다
 *
 * 처리 과정:
 * 1. 학생 프로필 및 성적 데이터 로드
 * 2. 학습 패턴 및 보유 콘텐츠 조회
 * 3. 추천 후보 콘텐츠 조회
 * 4. LLM 요청 빌드
 * 5. Claude API 호출 (fast 모델 사용 권장)
 * 6. 응답 파싱 및 검증
 * 7. 추천 결과 반환
 *
 * @param {RecommendContentInput} input - 추천 입력
 * @returns {Promise<RecommendContentResult>} 추천 결과
 *
 * @example
 * ```typescript
 * // 관리자 페이지에서 호출
 * const result = await recommendContentWithAI({
 *   studentId: 'student-uuid',
 *   maxRecommendations: 5,
 *   focusArea: 'weak_subjects',
 * });
 *
 * if (result.success) {
 *   result.data.recommendations.forEach((rec) => {
 *     console.log(`${rec.priority}. ${rec.title} - ${rec.reason}`);
 *   });
 * }
 * ```
 */
export async function recommendContentWithAI(
  input: RecommendContentInput
): Promise<RecommendContentResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 관리자 권한 확인 (선택적)
  // const role = await getCurrentUserRole();
  // if (role !== "admin" && role !== "consultant") {
  //   return { success: false, error: "권한이 없습니다." };
  // }

  try {
    // 1. 학생 프로필 로드
    const studentProfile = await loadStudentProfile(supabase, input.studentId);
    if (!studentProfile) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 2. 관련 데이터 병렬 로드
    const [scores, learningPattern, ownedContents, candidateContents] = await Promise.all([
      loadScoreInfo(supabase, input.studentId),
      loadLearningPattern(supabase, input.studentId),
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

    // 4. LLM 요청 빌드
    const llmRequest: ContentRecommendationRequest = {
      student: studentProfile,
      scores,
      learningPattern,
      ownedContents,
      candidateContents: filteredCandidates.slice(0, 30), // 최대 30개로 제한
      maxRecommendations: input.maxRecommendations || 5,
      focusArea: input.focusArea,
      additionalInstructions: input.additionalInstructions,
    };

    // 5. 토큰 추정 로깅
    const tokenEstimate = estimateContentRecommendationTokens(llmRequest);
    console.log(`[AI Content Rec] 예상 토큰: ${tokenEstimate.totalTokens}`);

    // 6. LLM 호출 (기본: fast 모델 - 비용 효율적)
    const modelTier = input.modelTier || "fast";
    const userPrompt = buildContentRecommendationPrompt(llmRequest);

    const result = await createMessage({
      system: CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 7. 응답 파싱
    const parsed = extractJSON<ContentRecommendationResponse>(result.content);

    if (!parsed || !parsed.recommendations) {
      console.error("[AI Content Rec] 파싱 실패:", result.content.substring(0, 500));
      return { success: false, error: "추천 결과 파싱에 실패했습니다." };
    }

    // 8. 추천 결과 검증 (contentId가 유효한지 확인)
    const validContentIds = new Set(filteredCandidates.map((c) => c.id));
    const validRecommendations = parsed.recommendations.filter((rec) =>
      validContentIds.has(rec.contentId)
    );

    if (validRecommendations.length === 0) {
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
        recommendations: validRecommendations,
        summary: {
          ...parsed.summary,
          totalRecommended: validRecommendations.length,
        },
        insights: parsed.insights,
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD: estimatedCost,
        },
      },
    };
  } catch (error) {
    console.error("[AI Content Rec] 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 생성 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 추천 결과 캐싱 (선택적)
// ============================================

// 추천 결과를 1시간 캐싱할 수 있는 구조
// 실제 구현은 Redis 또는 Supabase 테이블 사용

/**
 * 캐시된 추천 결과 조회
 * (향후 구현 - 현재는 항상 null 반환)
 */
export async function getCachedRecommendations(
  studentId: string,
  focusArea?: string
): Promise<RecommendContentResult["data"] | null> {
  // TODO: 캐시 구현
  return null;
}

/**
 * 추천 결과 캐시 저장
 * (향후 구현)
 */
export async function cacheRecommendations(
  studentId: string,
  focusArea: string | undefined,
  data: RecommendContentResult["data"]
): Promise<void> {
  // TODO: 캐시 구현
}
