/**
 * 콜드 스타트 배치 처리 실행기
 *
 * 미리 정의된 교과/과목 조합을 순차적으로 처리하여
 * DB에 콘텐츠를 축적합니다.
 *
 * @example
 * ```typescript
 * import { runColdStartBatch } from "./batch";
 *
 * // 핵심 교과만 처리
 * const result = await runColdStartBatch("core", {
 *   saveToDb: true,
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
const DEFAULT_DELAY_MS = 5000;

/** 기본 재시도 횟수 */
const DEFAULT_MAX_RETRIES = 1;

/**
 * 콜드 스타트 배치 처리 실행
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
    onProgress,
    onError,
    onComplete,
    limit,
  } = options;

  // 대상 제한 적용
  const limitedTargets = limit ? targets.slice(0, limit) : targets;
  const total = limitedTargets.length;

  logActionDebug(
    "ColdStartBatch",
    `배치 시작 - 대상: ${total}개, saveToDb: ${saveToDb}, useMock: ${useMock}`
  );

  // 결과 수집
  const items: BatchItemResult[] = [];
  const errors: BatchError[] = [];
  let successCount = 0;
  let failureCount = 0;
  const skippedCount = 0;
  let totalNewlySaved = 0;
  let totalDuplicatesSkipped = 0;
  let usedFallbackCount = 0;

  // 순차 처리
  for (let i = 0; i < limitedTargets.length; i++) {
    const target = limitedTargets[i];
    const itemStartTime = Date.now();

    // 진행 상황 콜백
    const progress: BatchProgress = {
      current: target,
      currentIndex: i,
      total,
      percentComplete: Math.round(((i + 1) / total) * 100),
      successCount,
      failureCount,
      skippedCount,
    };
    onProgress?.(progress);

    logActionDebug(
      "ColdStartBatch",
      `[${i + 1}/${total}] 처리 중: ${targetToString(target)}`
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

          successCount++;
          totalNewlySaved += newlySaved;
          totalDuplicatesSkipped += duplicatesSkipped;
          if (usedFallback) usedFallbackCount++;

          success = true;

          logActionDebug(
            "ColdStartBatch",
            `[${i + 1}/${total}] 성공: ${result.recommendations.length}개 추천, ` +
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
            lastError.includes("한도");

          if (isRateLimit && attempt < maxRetries) {
            logActionWarn(
              "ColdStartBatch",
              `[${i + 1}/${total}] Rate limit, 재시도 ${attempt + 1}/${maxRetries}`
            );
            // Rate limit 시 더 긴 대기
            await delay(delayBetweenRequests * 2);
            continue;
          }

          // 재시도 불가능한 에러
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logActionWarn(
          "ColdStartBatch",
          `[${i + 1}/${total}] 예외 발생: ${lastError}`
        );
        break;
      }
    }

    // 실패 처리
    if (!success) {
      failureCount++;

      const batchError: BatchError = {
        target,
        error: lastError ?? "알 수 없는 에러",
        attempts: maxRetries + 1,
        isRateLimitError:
          lastError?.includes("429") ||
          lastError?.includes("quota") ||
          lastError?.includes("한도") ||
          false,
      };
      errors.push(batchError);
      onError?.(batchError);

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
        `[${i + 1}/${total}] 실패: ${targetToString(target)} - ${lastError}`
      );
    }

    if (itemResult) {
      items.push(itemResult);
    }

    // 다음 요청 전 대기 (마지막 항목 제외)
    if (i < limitedTargets.length - 1) {
      await delay(delayBetweenRequests);
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
      `소요 시간: ${Math.round(totalDurationMs / 1000)}초`
  );

  onComplete?.(result);

  return result;
}

/**
 * 배치 처리 드라이런 (실제 API 호출 없이 대상 목록만 확인)
 */
export function dryRunBatch(
  preset: BatchPreset | BatchTarget[]
): { targets: BatchTarget[]; estimatedDurationMinutes: number } {
  const targets = Array.isArray(preset) ? preset : getTargetsForPreset(preset);

  // 예상 소요 시간 계산 (5초 간격 + 평균 10초 처리 시간)
  const estimatedSeconds = targets.length * 15;
  const estimatedDurationMinutes = Math.ceil(estimatedSeconds / 60);

  return {
    targets,
    estimatedDurationMinutes,
  };
}

/**
 * 대기 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
