"use server";

/**
 * ML 예측 Server Actions
 *
 * Python ML API를 호출하여 성적 예측, 학습량 예측 등을 수행합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  pythonMLClient,
  type ScorePredictionResponse,
  type WorkloadPredictionResponse,
  type ContentRecommendationResponse,
  type ComprehensiveReportResponse,
} from "@/lib/api/python-ml";

// ============================================
// 성적 예측
// ============================================

export async function predictScore(
  studentId: string,
  subject: string,
  daysAhead: number = 30
): Promise<{ success: true; data: ScorePredictionResponse } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.predictScore({
      student_id: studentId,
      subject,
      days_ahead: daysAhead,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Score prediction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "예측에 실패했습니다.",
    };
  }
}

// ============================================
// 학습량 예측
// ============================================

export async function predictWorkload(
  studentId: string,
  weeksAhead: number = 1
): Promise<{ success: true; data: WorkloadPredictionResponse } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.predictWorkload({
      student_id: studentId,
      weeks_ahead: weeksAhead,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Workload prediction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "예측에 실패했습니다.",
    };
  }
}

// ============================================
// 예측 가능한 과목 목록
// ============================================

export async function getPredictableSubjects(
  studentId: string
): Promise<{ success: true; data: { subjects: string[]; all_subjects: string[] } } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.getPredictableSubjects(studentId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Get predictable subjects error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "과목 조회에 실패했습니다.",
    };
  }
}

// ============================================
// 콘텐츠 추천
// ============================================

export async function getContentRecommendations(
  studentId: string,
  options?: {
    subject?: string;
    limit?: number;
    includeReasons?: boolean;
  }
): Promise<{ success: true; data: ContentRecommendationResponse } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.recommendContent({
      student_id: studentId,
      subject: options?.subject,
      limit: options?.limit ?? 5,
      include_reasons: options?.includeReasons ?? true,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Content recommendation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 조회에 실패했습니다.",
    };
  }
}

// ============================================
// 취약 과목 조회
// ============================================

export async function getWeakSubjects(
  studentId: string
): Promise<{ success: true; data: { weak_subjects: string[]; scores: Record<string, number> } } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.getWeakSubjects(studentId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Get weak subjects error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "취약 과목 조회에 실패했습니다.",
    };
  }
}

// ============================================
// 종합 리포트
// ============================================

export async function getComprehensiveReport(
  studentId: string
): Promise<{ success: true; data: ComprehensiveReportResponse } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const result = await pythonMLClient.getComprehensiveReport(studentId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Comprehensive report error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리포트 조회에 실패했습니다.",
    };
  }
}

// ============================================
// ML API 상태 확인
// ============================================

export async function checkMLApiStatus(): Promise<{ available: boolean; message?: string }> {
  try {
    const isAvailable = await pythonMLClient.isAvailable();
    return { available: isAvailable };
  } catch (error) {
    return {
      available: false,
      message: error instanceof Error ? error.message : "API 연결 실패",
    };
  }
}
