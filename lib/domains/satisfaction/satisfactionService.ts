/**
 * 만족도 수집 서비스
 *
 * 학습 플랜 완료 후 1-5점 별점 평가를 수집하고 분석합니다.
 *
 * @module lib/domains/satisfaction/satisfactionService
 */

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 타입 정의
// ============================================

/**
 * 만족도 평가 태그
 */
export type SatisfactionTag =
  | "too_easy"
  | "appropriate"
  | "too_hard"
  | "interesting"
  | "boring"
  | "helpful"
  | "confusing";

/**
 * 만족도 평가 입력
 */
export type SatisfactionRatingInput = {
  planId: string;
  studentId: string;
  tenantId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  tags?: SatisfactionTag[];
  feedback?: string;
  contentType?: string;
  subjectType?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  completionRate?: number;
};

/**
 * 만족도 평가 결과
 */
export type SatisfactionRating = {
  id: string;
  planId: string;
  studentId: string;
  rating: number;
  tags: string[];
  feedback: string | null;
  contentType: string | null;
  subjectType: string | null;
  createdAt: string;
};

/**
 * 만족도 요약
 */
export type SatisfactionSummary = {
  totalRatings: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  tagFrequency: Record<string, number>;
  byContentType: Record<string, { count: number; average: number }>;
  bySubjectType: Record<string, { count: number; average: number }>;
  recentTrend: "improving" | "stable" | "declining";
  period: {
    startDate: string;
    endDate: string;
  };
};

/**
 * 서비스 결과
 */
export type SatisfactionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 평가 분포 계산
 */
function calculateDistribution(
  ratings: number[]
): Record<1 | 2 | 3 | 4 | 5, number> {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const rating of ratings) {
    if (rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5]++;
    }
  }

  return distribution;
}

/**
 * 태그 빈도 계산
 */
function calculateTagFrequency(
  allTags: string[][]
): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const tags of allTags) {
    for (const tag of tags) {
      frequency[tag] = (frequency[tag] || 0) + 1;
    }
  }

  return frequency;
}

/**
 * 최근 트렌드 분석
 */
function analyzeRecentTrend(
  ratings: Array<{ rating: number; created_at: string }>
): "improving" | "stable" | "declining" {
  if (ratings.length < 4) {
    return "stable";
  }

  // 최근 절반과 이전 절반 비교
  const midpoint = Math.floor(ratings.length / 2);
  const sortedRatings = [...ratings].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const olderRatings = sortedRatings.slice(0, midpoint);
  const newerRatings = sortedRatings.slice(midpoint);

  const olderAvg =
    olderRatings.reduce((sum, r) => sum + r.rating, 0) / olderRatings.length;
  const newerAvg =
    newerRatings.reduce((sum, r) => sum + r.rating, 0) / newerRatings.length;

  const difference = newerAvg - olderAvg;

  if (difference > 0.3) return "improving";
  if (difference < -0.3) return "declining";
  return "stable";
}

// ============================================
// 메인 함수
// ============================================

/**
 * 만족도 평가 제출
 *
 * @param input - 평가 입력
 * @returns 생성된 평가 결과
 */
export async function submitSatisfactionRating(
  input: SatisfactionRatingInput
): Promise<SatisfactionResult<SatisfactionRating>> {
  const {
    planId,
    studentId,
    tenantId,
    rating,
    tags = [],
    feedback,
    contentType,
    subjectType,
    estimatedDuration,
    actualDuration,
    completionRate,
  } = input;

  try {
    const supabase = await createSupabaseServerClient();

    // 중복 평가 확인 (upsert로 처리)
    const { data: existing } = await supabase
      .from("plan_satisfaction_ratings")
      .select("id")
      .eq("plan_id", planId)
      .single();

    if (existing) {
      // 기존 평가 업데이트
      const { data, error } = await supabase
        .from("plan_satisfaction_ratings")
        .update({
          rating,
          tags,
          feedback: feedback || null,
          content_type: contentType || null,
          subject_type: subjectType || null,
          estimated_duration: estimatedDuration || null,
          actual_duration: actualDuration || null,
          completion_rate: completionRate || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`평가 업데이트 실패: ${error.message}`);
      }

      return {
        success: true,
        data: {
          id: data.id,
          planId: data.plan_id,
          studentId: data.student_id,
          rating: data.rating,
          tags: data.tags || [],
          feedback: data.feedback,
          contentType: data.content_type,
          subjectType: data.subject_type,
          createdAt: data.created_at,
        },
      };
    }

    // 새 평가 생성
    const { data, error } = await supabase
      .from("plan_satisfaction_ratings")
      .insert({
        plan_id: planId,
        student_id: studentId,
        tenant_id: tenantId || null,
        rating,
        tags,
        feedback: feedback || null,
        content_type: contentType || null,
        subject_type: subjectType || null,
        estimated_duration: estimatedDuration || null,
        actual_duration: actualDuration || null,
        completion_rate: completionRate || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`평가 생성 실패: ${error.message}`);
    }

    return {
      success: true,
      data: {
        id: data.id,
        planId: data.plan_id,
        studentId: data.student_id,
        rating: data.rating,
        tags: data.tags || [],
        feedback: data.feedback,
        contentType: data.content_type,
        subjectType: data.subject_type,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "satisfaction", action: "submitSatisfactionRating" }, error, { planId, studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 플랜의 만족도 평가 조회
 *
 * @param planId - 플랜 ID
 * @returns 평가 결과
 */
export async function getSatisfactionRating(
  planId: string
): Promise<SatisfactionResult<SatisfactionRating | null>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_satisfaction_ratings")
      .select("*")
      .eq("plan_id", planId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`평가 조회 실패: ${error.message}`);
    }

    if (!data) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: data.id,
        planId: data.plan_id,
        studentId: data.student_id,
        rating: data.rating,
        tags: data.tags || [],
        feedback: data.feedback,
        contentType: data.content_type,
        subjectType: data.subject_type,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "satisfaction", action: "getSatisfactionRating" }, error, { planId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 학생의 만족도 요약 조회
 *
 * @param studentId - 학생 ID
 * @param daysBack - 분석 기간 (일), 기본 30일
 * @returns 만족도 요약
 */
export async function getSatisfactionSummary(
  studentId: string,
  daysBack: number = 30
): Promise<SatisfactionResult<SatisfactionSummary>> {
  try {
    const supabase = await createSupabaseServerClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    const { data: ratings, error } = await supabase
      .from("plan_satisfaction_ratings")
      .select("*")
      .eq("student_id", studentId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`요약 조회 실패: ${error.message}`);
    }

    const ratingsList = ratings || [];
    const totalRatings = ratingsList.length;

    if (totalRatings === 0) {
      return {
        success: true,
        data: {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          tagFrequency: {},
          byContentType: {},
          bySubjectType: {},
          recentTrend: "stable",
          period: {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          },
        },
      };
    }

    // 평균 계산
    const sum = ratingsList.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Math.round((sum / totalRatings) * 10) / 10;

    // 분포 계산
    const ratingDistribution = calculateDistribution(
      ratingsList.map((r) => r.rating)
    );

    // 태그 빈도
    const tagFrequency = calculateTagFrequency(
      ratingsList.map((r) => r.tags || [])
    );

    // 콘텐츠 타입별 집계
    const byContentType: Record<string, { count: number; average: number }> =
      {};
    for (const r of ratingsList) {
      const type = r.content_type || "unknown";
      if (!byContentType[type]) {
        byContentType[type] = { count: 0, average: 0 };
      }
      byContentType[type].count++;
      byContentType[type].average += r.rating;
    }
    for (const type of Object.keys(byContentType)) {
      byContentType[type].average =
        Math.round(
          (byContentType[type].average / byContentType[type].count) * 10
        ) / 10;
    }

    // 과목별 집계
    const bySubjectType: Record<string, { count: number; average: number }> =
      {};
    for (const r of ratingsList) {
      const subject = r.subject_type || "unknown";
      if (!bySubjectType[subject]) {
        bySubjectType[subject] = { count: 0, average: 0 };
      }
      bySubjectType[subject].count++;
      bySubjectType[subject].average += r.rating;
    }
    for (const subject of Object.keys(bySubjectType)) {
      bySubjectType[subject].average =
        Math.round(
          (bySubjectType[subject].average / bySubjectType[subject].count) * 10
        ) / 10;
    }

    // 트렌드 분석
    const recentTrend = analyzeRecentTrend(
      ratingsList.map((r) => ({ rating: r.rating, created_at: r.created_at }))
    );

    return {
      success: true,
      data: {
        totalRatings,
        averageRating,
        ratingDistribution,
        tagFrequency,
        byContentType,
        bySubjectType,
        recentTrend,
        period: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "satisfaction", action: "getSatisfactionSummary" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 테넌트의 만족도 통계 조회 (관리자용)
 *
 * @param tenantId - 테넌트 ID
 * @param daysBack - 분석 기간 (일)
 * @returns 만족도 통계
 */
export async function getTenantSatisfactionStats(
  tenantId: string,
  daysBack: number = 30
): Promise<SatisfactionResult<SatisfactionSummary>> {
  try {
    const supabase = await createSupabaseServerClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    const { data: ratings, error } = await supabase
      .from("plan_satisfaction_ratings")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`테넌트 통계 조회 실패: ${error.message}`);
    }

    const ratingsList = ratings || [];
    const totalRatings = ratingsList.length;

    if (totalRatings === 0) {
      return {
        success: true,
        data: {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          tagFrequency: {},
          byContentType: {},
          bySubjectType: {},
          recentTrend: "stable",
          period: {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          },
        },
      };
    }

    // 동일한 계산 로직 적용
    const sum = ratingsList.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Math.round((sum / totalRatings) * 10) / 10;

    const ratingDistribution = calculateDistribution(
      ratingsList.map((r) => r.rating)
    );

    const tagFrequency = calculateTagFrequency(
      ratingsList.map((r) => r.tags || [])
    );

    const byContentType: Record<string, { count: number; average: number }> =
      {};
    for (const r of ratingsList) {
      const type = r.content_type || "unknown";
      if (!byContentType[type]) {
        byContentType[type] = { count: 0, average: 0 };
      }
      byContentType[type].count++;
      byContentType[type].average += r.rating;
    }
    for (const type of Object.keys(byContentType)) {
      byContentType[type].average =
        Math.round(
          (byContentType[type].average / byContentType[type].count) * 10
        ) / 10;
    }

    const bySubjectType: Record<string, { count: number; average: number }> =
      {};
    for (const r of ratingsList) {
      const subject = r.subject_type || "unknown";
      if (!bySubjectType[subject]) {
        bySubjectType[subject] = { count: 0, average: 0 };
      }
      bySubjectType[subject].count++;
      bySubjectType[subject].average += r.rating;
    }
    for (const subject of Object.keys(bySubjectType)) {
      bySubjectType[subject].average =
        Math.round(
          (bySubjectType[subject].average / bySubjectType[subject].count) * 10
        ) / 10;
    }

    const recentTrend = analyzeRecentTrend(
      ratingsList.map((r) => ({ rating: r.rating, created_at: r.created_at }))
    );

    return {
      success: true,
      data: {
        totalRatings,
        averageRating,
        ratingDistribution,
        tagFrequency,
        byContentType,
        bySubjectType,
        recentTrend,
        period: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "satisfaction", action: "getTenantSatisfactionStats" }, error, { tenantId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
