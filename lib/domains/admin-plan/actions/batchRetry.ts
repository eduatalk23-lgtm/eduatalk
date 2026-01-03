"use server";

/**
 * 배치 플랜 재시도 액션
 *
 * Phase 2: 실패 학생 선택적 재시도
 *
 * 기존 배치 생성에서 실패한 학생들을 선택하여 재시도합니다.
 * 기존 generateBatchPlansWithStreaming을 재사용합니다.
 *
 * @module lib/domains/admin-plan/actions/batchRetry
 */

import type { BatchRetryInput, BatchRetryResult, RetryStudent } from "../types/retry";
import type { StudentPlanResult } from "./batchAIPlanGeneration";
import { generateBatchPlansWithStreaming } from "./batchAIPlanGeneration";
import type { StreamingOptions } from "../types/streaming";

// ============================================
// 재시도 헬퍼 함수
// ============================================

/**
 * 결과에서 재시도 가능한 학생 추출
 */
export async function extractRetryableStudents(
  results: StudentPlanResult[]
): Promise<RetryStudent[]> {
  return results
    .filter((r) => r.status === "error" || r.status === "skipped")
    .map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      previousError: r.error,
    }));
}

/**
 * 재시도 가능 여부 확인
 */
export async function hasRetryableStudents(results: StudentPlanResult[]): Promise<boolean> {
  return results.some((r) => r.status === "error" || r.status === "skipped");
}

// ============================================
// 재시도 액션
// ============================================

/**
 * SSE 스트리밍과 함께 재시도 (API 라우트용)
 *
 * @param input - 재시도 입력
 * @param streamingOptions - 스트리밍 옵션
 */
export async function retryBatchPlansWithStreaming(
  input: BatchRetryInput,
  streamingOptions?: StreamingOptions
): Promise<BatchRetryResult> {
  const { students, settings } = input;

  if (!students || students.length === 0) {
    return {
      success: false,
      results: [],
      summary: {
        total: 0,
        succeeded: 0,
        failed: 0,
        totalPlans: 0,
        totalCost: 0,
      },
      error: "재시도할 학생이 없습니다.",
    };
  }

  // 기존 generateBatchPlansWithStreaming 재사용
  const result = await generateBatchPlansWithStreaming({
    students: students.map((s) => ({
      studentId: s.studentId,
      contentIds: s.contentIds || [],
    })),
    settings: {
      startDate: settings.startDate,
      endDate: settings.endDate,
      dailyStudyMinutes: settings.dailyMinutes,
    },
    planGroupNameTemplate: settings.planGroupNameTemplate,
    streamingOptions,
  });

  return {
    success: result.success,
    results: result.results,
    summary: {
      total: result.summary.total,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      totalPlans: result.summary.totalPlans,
      totalCost: result.summary.totalCost,
    },
  };
}

// ============================================
// 결과 병합 유틸리티
// ============================================

/**
 * 기존 결과와 재시도 결과 병합
 *
 * 재시도 결과가 기존 실패 학생을 대체합니다.
 *
 * @param originalResults - 원래 결과
 * @param retryResults - 재시도 결과
 * @returns 병합된 결과
 */
export async function mergeRetryResults(
  originalResults: StudentPlanResult[],
  retryResults: StudentPlanResult[]
): Promise<StudentPlanResult[]> {
  const retryMap = new Map(retryResults.map((r) => [r.studentId, r]));

  return originalResults.map((original) => {
    const retried = retryMap.get(original.studentId);
    // 재시도 결과가 있으면 대체, 없으면 원본 유지
    return retried || original;
  });
}

/**
 * 병합된 결과에서 요약 재계산
 */
export async function recalculateSummary(
  results: StudentPlanResult[]
): Promise<BatchRetryResult["summary"]> {
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  const totalPlans = results.reduce((sum, r) => sum + (r.totalPlans || 0), 0);
  const totalCost = results.reduce(
    (sum, r) => sum + (r.cost?.estimatedUSD || 0),
    0
  );

  return {
    total: results.length,
    succeeded,
    failed,
    totalPlans,
    totalCost,
  };
}
