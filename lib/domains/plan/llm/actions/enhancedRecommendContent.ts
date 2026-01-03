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

import type {
  StudentProfile,
  SubjectScoreInfo,
  LearningPatternInfo,
  OwnedContentInfo,
  ContentCandidate,
} from "../prompts/contentRecommendation";

import type { ModelTier } from "../types";

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

  // 위험도 분석 데이터
  const { data: riskData } = await supabase
    .from("student_risk_analysis")
    .select("subject, risk_score, recent_grade_trend")
    .eq("student_id", studentId);

  if (riskData) {
    riskData.forEach((risk) => {
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
  const { data: pattern } = await supabase
    .from("student_learning_patterns")
    .select("preferred_study_times, strong_days, weak_days")
    .eq("student_id", studentId)
    .single();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: plans } = await supabase
    .from("student_plan")
    .select("status, progress, estimated_minutes")
    .eq("student_id", studentId)
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!plans || plans.length === 0) {
    return pattern
      ? { preferredStudyTimes: pattern.preferred_study_times ?? undefined }
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

async function loadLearningVelocity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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

async function loadOwnedContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<OwnedContentInfo[]> {
  const { data: books } = await supabase
    .from("student_books")
    .select(`id, title, subject, subject_group_name, completed_pages, total_pages`)
    .eq("student_id", studentId);

  const { data: lectures } = await supabase
    .from("student_lectures")
    .select(`id, title, subject, subject_group_name, completed_episodes, total_episodes`)
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
