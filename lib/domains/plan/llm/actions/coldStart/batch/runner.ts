/**
 * 콜드 스타트 배치 처리 실행기
 *
 * 미리 정의된 교과/과목 조합을 병렬로 처리하여
 * DB에 콘텐츠를 축적합니다.
 *
 * @example
 * ```typescript
 * import { runColdStartBatch } from "./batch";
 *
 * // 핵심 교과만 처리 (병렬 2개)
 * const result = await runColdStartBatch("core", {
 *   saveToDb: true,
 *   concurrency: 2,
 *   onProgress: (p) => console.log(`${p.percentComplete}% 완료`),
 * });
 *
 * console.log(`성공: ${result.stats.succeeded}, 실패: ${result.stats.failed}`);
 * ```
 */

import type {
  BatchTarget,
  BatchOptions,
  BatchResult,
  BatchItemResult,
  BatchError,
  BatchProgress,
  BatchPreset,
} from "./types";
import { getTargetsForPreset, targetToString } from "./targets";
import { runColdStartPipeline } from "../pipeline";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";

/** 기본 요청 간 딜레이 (ms) - Rate limit 방지 */
const DEFAULT_DELAY_MS = 3000;

/** 성공 시 단축된 딜레이 (ms) */
const SUCCESS_DELAY_MS = 2000;

/** Rate limit 시 대기 시간 (ms) */
const RATE_LIMIT_DELAY_MS = 10000;

/** 기본 재시도 횟수 */
const DEFAULT_MAX_RETRIES = 1;

/** 기본 동시 처리 수 */
const DEFAULT_CONCURRENCY = 2;

/**
 * 콜드 스타트 배치 처리 실행 (병렬 처리 지원)
 *
 * @param preset - 배치 프리셋 또는 커스텀 대상 배열
 * @param options - 배치 옵션
 * @returns 배치 처리 결과
 */
export async function runColdStartBatch(
  preset: BatchPreset | BatchTarget[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // 대상 목록 결정
  const targets = Array.isArray(preset) ? preset : getTargetsForPreset(preset);

  // 옵션 기본값 설정
  const {
    tenantId = null,
    saveToDb = true,
    useMock = false,
    delayBetweenRequests = DEFAULT_DELAY_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    concurrency = DEFAULT_CONCURRENCY,
    onProgress,
    onError,
    onItemComplete,
    onComplete,
    limit,
  } = options;

  // 대상 제한 적용
  const limitedTargets = limit ? targets.slice(0, limit) : targets;
  const total = limitedTargets.length;

  // 실제 동시 처리 수 (최소 1, 최대 5)
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, 5));

  logActionDebug(
    "ColdStartBatch",
    `배치 시작 - 대상: ${total}개, 동시처리: ${effectiveConcurrency}, saveToDb: ${saveToDb}`
  );

  // 결과 수집
  const items: BatchItemResult[] = [];
  const errors: BatchError[] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalNewlySaved = 0;
  let totalDuplicatesSkipped = 0;
  let usedFallbackCount = 0;
  let completedCount = 0;

  // Rate limit 상태 추적 (청크 단위로 관리, 병렬 처리 내부에서 수정하지 않음)
  let consecutiveRateLimitChunks = 0;
  let currentDelay = delayBetweenRequests;

  /** 처리 결과 + Rate limit 여부 */
  interface ProcessItemResult {
    itemResult: BatchItemResult;
    hitRateLimit: boolean;
  }

  /**
   * 단일 항목 처리 함수
   * - 공유 상태를 수정하지 않음 (병렬 안전)
   * - Rate limit 발생 여부를 반환하여 청크 완료 후 처리
   */
  async function processItem(
    target: BatchTarget,
    index: number
  ): Promise<ProcessItemResult> {
    const itemStartTime = Date.now();
    let hitRateLimit = false;

    logActionDebug(
      "ColdStartBatch",
      `[${index + 1}/${total}] 처리 중: ${targetToString(target)}`
    );

    // 재시도 루프
    let lastError: string | undefined;
    let success = false;
    let itemResult: BatchItemResult | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 파이프라인 실행
        const result = await runColdStartPipeline(
          {
            subjectCategory: target.subjectCategory,
            subject: target.subject,
            difficulty: target.difficulty,
            contentType: target.contentType,
          },
          {
            tenantId,
            saveToDb,
            useMock,
            enableFallback: true,
          }
        );

        if (result.success) {
          const usedFallback = result.stats.usedFallback ?? false;
          const newlySaved = result.persistence?.newlySaved ?? 0;
          const duplicatesSkipped = result.persistence?.duplicatesSkipped ?? 0;

          itemResult = {
            target,
            success: true,
            recommendationCount: result.recommendations.length,
            newlySaved,
            duplicatesSkipped,
            usedFallback,
            durationMs: Date.now() - itemStartTime,
          };

          success = true;

          logActionDebug(
            "ColdStartBatch",
            `[${index + 1}/${total}] 성공: ${result.recommendations.length}개 추천, ` +
              `${newlySaved}개 저장, ${duplicatesSkipped}개 중복 스킵` +
              (usedFallback ? " (fallback 사용)" : "")
          );
          break;
        } else {
          lastError = result.error;

          // Rate limit 에러인지 확인
          const isRateLimit =
            lastError.includes("429") ||
            lastError.includes("quota") ||
            lastError.includes("한도") ||
            lastError.includes("RATE_LIMIT");

          if (isRateLimit) {
            hitRateLimit = true;

            if (attempt < maxRetries) {
              // 재시도 시 고정 딜레이 사용 (공유 상태 미참조)
              const retryDelay = RATE_LIMIT_DELAY_MS * Math.pow(1.5, attempt);
              logActionWarn(
                "ColdStartBatch",
                `[${index + 1}/${total}] Rate limit, ${retryDelay}ms 대기 후 재시도 ${attempt + 1}/${maxRetries}`
              );
              await delay(retryDelay);
              continue;
            }
          }

          // 재시도 불가능한 에러
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logActionWarn(
          "ColdStartBatch",
          `[${index + 1}/${total}] 예외 발생: ${lastError}`
        );
        break;
      }
    }

    // 실패 시 결과 생성
    if (!success) {
      itemResult = {
        target,
        success: false,
        recommendationCount: 0,
        newlySaved: 0,
        duplicatesSkipped: 0,
        usedFallback: false,
        error: lastError,
        durationMs: Date.now() - itemStartTime,
      };

      logActionWarn(
        "ColdStartBatch",
        `[${index + 1}/${total}] 실패: ${targetToString(target)} - ${lastError}`
      );
    }

    return { itemResult: itemResult!, hitRateLimit };
  }

  /**
   * 청크 단위 병렬 처리
   */
  const chunks = chunkArray(limitedTargets, effectiveConcurrency);

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const chunkStartIndex = chunkIndex * effectiveConcurrency;

    // 청크 내 항목들을 병렬 처리
    const chunkPromises = chunk.map((target, i) =>
      processItem(target, chunkStartIndex + i)
    );

    const chunkResults = await Promise.allSettled(chunkPromises);

    // 청크 내 rate limit 발생 여부 추적
    let chunkHadRateLimit = false;
    let chunkHadSuccess = false;

    // 결과 수집
    for (let i = 0; i < chunkResults.length; i++) {
      const result = chunkResults[i];
      const index = chunkStartIndex + i;

      if (result.status === "fulfilled") {
        const { itemResult, hitRateLimit } = result.value;
        items.push(itemResult);

        if (hitRateLimit) chunkHadRateLimit = true;

        if (itemResult.success) {
          successCount++;
          chunkHadSuccess = true;
          totalNewlySaved += itemResult.newlySaved;
          totalDuplicatesSkipped += itemResult.duplicatesSkipped;
          if (itemResult.usedFallback) usedFallbackCount++;
        } else {
          failureCount++;
          const batchError: BatchError = {
            target: itemResult.target,
            error: itemResult.error ?? "알 수 없는 에러",
            attempts: maxRetries + 1,
            isRateLimitError:
              itemResult.error?.includes("429") ||
              itemResult.error?.includes("quota") ||
              false,
          };
          errors.push(batchError);
          onError?.(batchError);
        }

        // 개별 항목 완료 콜백
        onItemComplete?.(itemResult, index, total);
      } else {
        // Promise 자체가 실패한 경우 (예외적)
        failureCount++;
        const errorMsg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        const failedTarget = chunk[i];
        const itemResult: BatchItemResult = {
          target: failedTarget,
          success: false,
          recommendationCount: 0,
          newlySaved: 0,
          duplicatesSkipped: 0,
          usedFallback: false,
          error: errorMsg,
          durationMs: 0,
        };
        items.push(itemResult);

        const batchError: BatchError = {
          target: failedTarget,
          error: errorMsg,
          attempts: 1,
          isRateLimitError: false,
        };
        errors.push(batchError);
        onError?.(batchError);
        onItemComplete?.(itemResult, index, total);
      }

      completedCount++;
    }

    // 청크 완료 후 rate limit 상태 업데이트 (병렬 안전)
    if (chunkHadRateLimit) {
      consecutiveRateLimitChunks++;
      currentDelay = Math.min(
        RATE_LIMIT_DELAY_MS * Math.pow(1.5, consecutiveRateLimitChunks),
        30000
      );
    } else if (chunkHadSuccess) {
      consecutiveRateLimitChunks = 0;
      currentDelay = SUCCESS_DELAY_MS;
    }

    // 진행 상황 콜백
    const progress: BatchProgress = {
      current: chunk[chunk.length - 1],
      currentIndex: chunkStartIndex + chunk.length - 1,
      total,
      percentComplete: Math.round((completedCount / total) * 100),
      successCount,
      failureCount,
      skippedCount: 0,
    };
    onProgress?.(progress);

    // 다음 청크 전 대기 (마지막 청크 제외)
    if (chunkIndex < chunks.length - 1) {
      await delay(currentDelay);
    }
  }

  // 최종 결과
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  const result: BatchResult = {
    success: failureCount === 0,
    startedAt,
    completedAt,
    totalDurationMs,
    stats: {
      total,
      succeeded: successCount,
      failed: failureCount,
      usedFallback: usedFallbackCount,
      totalNewlySaved,
      totalDuplicatesSkipped,
    },
    items,
    errors,
  };

  logActionDebug(
    "ColdStartBatch",
    `배치 완료 - 성공: ${successCount}, 실패: ${failureCount}, ` +
      `새로 저장: ${totalNewlySaved}, 중복 스킵: ${totalDuplicatesSkipped}, ` +
      `소요 시간: ${Math.round(totalDurationMs / 1000)}초 (동시처리: ${effectiveConcurrency})`
  );

  onComplete?.(result);

  return result;
}

/**
 * 배치 처리 드라이런 (실제 API 호출 없이 대상 목록만 확인)
 */
export function dryRunBatch(
  preset: BatchPreset | BatchTarget[],
  concurrency: number = DEFAULT_CONCURRENCY
): { targets: BatchTarget[]; estimatedDurationMinutes: number } {
  const targets = Array.isArray(preset) ? preset : getTargetsForPreset(preset);
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, 5));

  // 예상 소요 시간 계산 (병렬 처리 반영)
  // 평균 처리 시간: 10초, 딜레이: 3초
  const chunksCount = Math.ceil(targets.length / effectiveConcurrency);
  const estimatedSeconds = chunksCount * (10 + 3); // 청크당 13초
  const estimatedDurationMinutes = Math.ceil(estimatedSeconds / 60);

  return {
    targets,
    estimatedDurationMinutes,
  };
}

/**
 * 배열을 청크로 분할
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 대기 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
