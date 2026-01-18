#!/usr/bin/env npx tsx
/**
 * 콜드 스타트 배치 처리 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/cold-start-batch.ts [preset] [options]
 *
 * 프리셋:
 *   core     - 핵심 교과/과목 (기본값, ~24개)
 *   math     - 수학 전체 (~21개)
 *   english  - 영어 전체 (~10개)
 *   science  - 과학 전체 (~17개)
 *   all      - 전체 (~80개)
 *
 * 옵션:
 *   --dry-run     실제 API 호출 없이 대상만 확인
 *   --mock        Mock 데이터 사용 (API 호출 없음)
 *   --no-save     DB 저장 안 함
 *   --limit=N     처리 대상 제한
 *   --delay=N     요청 간 딜레이 (ms, 기본: 5000)
 *
 * 예시:
 *   npx tsx scripts/cold-start-batch.ts core --dry-run
 *   npx tsx scripts/cold-start-batch.ts math --limit=5
 *   npx tsx scripts/cold-start-batch.ts all --mock
 */

import {
  runColdStartBatch,
  dryRunBatch,
  targetToString,
  type BatchPreset,
  type BatchProgress,
  type BatchError,
  type BatchResult,
} from "../lib/domains/plan/llm/actions/coldStart/batch";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// 프리셋 결정
const presetArg = args.find((arg) => !arg.startsWith("--"));
const preset: BatchPreset = (presetArg as BatchPreset) || "core";

// 옵션 파싱
const isDryRun = args.includes("--dry-run");
const useMock = args.includes("--mock");
const noSave = args.includes("--no-save");

const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

const delayArg = args.find((arg) => arg.startsWith("--delay="));
const delayBetweenRequests = delayArg
  ? parseInt(delayArg.split("=")[1], 10)
  : 5000;

// ─────────────────────────────────────────────────────────────────────────────
// 콘솔 출력 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(message);
}

function logSection(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes}분 ${remainingSeconds}초`
    : `${remainingSeconds}초`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logSection("콜드 스타트 배치 처리");

  log(`프리셋: ${preset}`);
  log(`모드: ${isDryRun ? "드라이런" : useMock ? "Mock" : "실제 API"}`);
  log(`DB 저장: ${noSave ? "비활성화" : "활성화"}`);
  if (limit) log(`대상 제한: ${limit}개`);
  log(`요청 간격: ${delayBetweenRequests}ms`);

  // ─────────────────────────────────────────────────────────────────────────
  // 드라이런 모드
  // ─────────────────────────────────────────────────────────────────────────

  if (isDryRun) {
    const { targets, estimatedDurationMinutes } = dryRunBatch(preset);
    const limitedTargets = limit ? targets.slice(0, limit) : targets;

    logSection(`대상 목록 (${limitedTargets.length}개)`);

    limitedTargets.forEach((target, i) => {
      log(`  ${String(i + 1).padStart(3)}. ${targetToString(target)}`);
    });

    logSection("예상 정보");
    log(`총 대상: ${limitedTargets.length}개`);
    log(`예상 소요 시간: 약 ${estimatedDurationMinutes}분`);
    log(`\n실제 실행하려면 --dry-run 옵션을 제거하세요.`);

    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 실제 배치 실행
  // ─────────────────────────────────────────────────────────────────────────

  logSection("배치 실행 시작");

  const onProgress = (progress: BatchProgress): void => {
    const status = `[${String(progress.currentIndex + 1).padStart(3)}/${progress.total}]`;
    const percent = `${progress.percentComplete}%`;
    const target = targetToString(progress.current);
    log(`${status} ${percent} - ${target}`);
  };

  const onError = (error: BatchError): void => {
    const rateLimitTag = error.isRateLimitError ? " [RATE LIMIT]" : "";
    log(`  ❌ 에러${rateLimitTag}: ${error.error}`);
  };

  const onComplete = (result: BatchResult): void => {
    logSection("배치 완료");

    log(`상태: ${result.success ? "✅ 성공" : "⚠️ 일부 실패"}`);
    log(`소요 시간: ${formatDuration(result.totalDurationMs)}`);
    log("");
    log("통계:");
    log(`  - 전체: ${result.stats.total}개`);
    log(`  - 성공: ${result.stats.succeeded}개`);
    log(`  - 실패: ${result.stats.failed}개`);
    log(`  - Fallback 사용: ${result.stats.usedFallback}개`);
    log(`  - 새로 저장: ${result.stats.totalNewlySaved}개`);
    log(`  - 중복 스킵: ${result.stats.totalDuplicatesSkipped}개`);

    if (result.errors.length > 0) {
      logSection(`에러 목록 (${result.errors.length}개)`);
      result.errors.forEach((err, i) => {
        log(`  ${i + 1}. ${targetToString(err.target)}`);
        log(`     에러: ${err.error}`);
        log(`     Rate Limit: ${err.isRateLimitError ? "Yes" : "No"}`);
      });
    }
  };

  try {
    await runColdStartBatch(preset, {
      tenantId: null, // 공유 카탈로그
      saveToDb: !noSave,
      useMock,
      delayBetweenRequests,
      limit,
      onProgress,
      onError,
      onComplete,
    });
  } catch (error) {
    logSection("치명적 에러");
    log(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error("스크립트 실행 실패:", error);
  process.exit(1);
});
