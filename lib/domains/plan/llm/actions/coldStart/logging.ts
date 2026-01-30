/**
 * Cold Start 파이프라인 로깅
 *
 * 파이프라인 실행 결과를 DB에 기록하여
 * 성능 분석 및 프롬프트 개선에 활용합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ColdStartRawInput, ColdStartPipelineResult } from "./types";

/** 응답 샘플 최대 길이 */
const MAX_RESPONSE_SAMPLE_LENGTH = 2000;

/**
 * Cold Start 파이프라인 실행 결과를 로깅합니다.
 *
 * @param input - 파이프라인 입력 파라미터
 * @param result - 파이프라인 실행 결과
 * @param durationMs - 실행 시간 (밀리초)
 * @param rawResponseSample - 파싱 실패 시 AI 응답 샘플 (선택)
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * const result = await runColdStartPipeline(input, options);
 * await logColdStartResult(input, result, Date.now() - startTime);
 * ```
 */
export async function logColdStartResult(
  input: ColdStartRawInput,
  result: ColdStartPipelineResult,
  durationMs: number,
  rawResponseSample?: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.warn("[ColdStartLog] Admin 클라이언트 없음, 로깅 스킵");
    return;
  }

  try {
    // 성공 시 콘텐츠 타입별 카운트
    let booksCount = 0;
    let lecturesCount = 0;
    let newItemsCount = 0;
    let updatedItemsCount = 0;
    let skippedItemsCount = 0;

    if (result.success && result.recommendations) {
      booksCount = result.recommendations.filter(
        (r) => r.contentType === "book"
      ).length;
      lecturesCount = result.recommendations.filter(
        (r) => r.contentType === "lecture"
      ).length;
    }

    if (result.success && result.persistence) {
      newItemsCount = result.persistence.newlySaved;
      skippedItemsCount = result.persistence.duplicatesSkipped;
      // updatedItemsCount는 persistence에 없으면 0
    }

    const outputResult = result.success
      ? {
          recommendations_count: result.recommendations?.length ?? 0,
          stats: result.stats,
          persistence: result.persistence,
        }
      : {
          failed_at: result.failedAt,
        };

    // 응답 샘플 자르기 (최대 2000자)
    const truncatedSample = rawResponseSample
      ? rawResponseSample.substring(0, MAX_RESPONSE_SAMPLE_LENGTH)
      : null;

    const { error } = await supabase.from("cold_start_logs").insert({
      input_params: input as unknown as Json,
      output_result: outputResult as unknown as Json,
      success: result.success,
      error_message: result.success ? null : (result.error ?? null),
      duration_ms: durationMs,
      items_count: result.success ? (result.recommendations?.length ?? 0) : 0,
      books_count: booksCount,
      lectures_count: lecturesCount,
      new_items_count: newItemsCount,
      updated_items_count: updatedItemsCount,
      skipped_items_count: skippedItemsCount,
      raw_response_sample: truncatedSample,
    });

    if (error) {
      console.error("[ColdStartLog] 로깅 실패:", error.message);
    }
  } catch (err) {
    // 로깅 실패가 파이프라인에 영향 주지 않도록
    console.error("[ColdStartLog] 예외 발생:", err);
  }
}

/**
 * 최근 Cold Start 로그 통계를 조회합니다.
 *
 * @param days - 조회할 기간 (일 수, 기본: 7)
 * @returns 로그 목록과 집계
 */
export async function getColdStartStats(days = 7) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("cold_start_logs")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ColdStartLog] 통계 조회 실패:", error.message);
    return null;
  }

  // 간단한 집계 계산
  const total = data.length;
  const successful = data.filter((d) => d.success).length;
  const avgDuration = total > 0
    ? data.reduce((sum, d) => sum + (d.duration_ms ?? 0), 0) / total
    : 0;
  const totalItems = data.reduce((sum, d) => sum + (d.items_count ?? 0), 0);

  return {
    logs: data,
    summary: {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDurationMs: Math.round(avgDuration),
      totalItemsRecommended: totalItems,
    },
  };
}
