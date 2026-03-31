#!/usr/bin/env npx tsx
/**
 * 코호트 벤치마크 갱신 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/cohort-benchmark-refresh.ts [options]
 *
 * 옵션:
 *   --dry-run        실제 저장 없이 계산 결과만 확인
 *   --tenant=<uuid>  특정 tenant만 처리 (없으면 전체)
 *   --major=<name>   특정 target_major만 처리
 *   --year=<number>  특정 school_year만 처리
 *
 * 예시:
 *   npx tsx scripts/cohort-benchmark-refresh.ts --dry-run
 *   npx tsx scripts/cohort-benchmark-refresh.ts --tenant=xxx
 *   npx tsx scripts/cohort-benchmark-refresh.ts --tenant=xxx --major=컴퓨터공학
 */

import {
  computeCohortBenchmark,
  saveCohortBenchmark,
  type CohortBenchmark,
} from "../lib/domains/student-record/cohort/benchmark";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const isDryRun = args.includes("--dry-run");

const tenantArg = args.find((a) => a.startsWith("--tenant="));
const targetTenantId = tenantArg ? tenantArg.split("=")[1] : undefined;

const majorArg = args.find((a) => a.startsWith("--major="));
const targetMajor = majorArg ? majorArg.split("=")[1] : undefined;

const yearArg = args.find((a) => a.startsWith("--year="));
const targetYear = yearArg ? parseInt(yearArg.split("=")[1], 10) : undefined;

// ─────────────────────────────────────────────────────────────────────────────
// 콘솔 유틸
// ─────────────────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(msg);
}

function logSection(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  return min > 0 ? `${min}분 ${sec % 60}초` : `${sec}초`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logSection("코호트 벤치마크 갱신");
  log(`모드: ${isDryRun ? "드라이런 (저장 없음)" : "실제 저장"}`);
  if (targetTenantId) log(`Tenant: ${targetTenantId}`);
  if (targetMajor) log(`Major: ${targetMajor}`);
  if (targetYear) log(`Year: ${targetYear}`);

  const supabase = createSupabaseAdminClient();
  const startedAt = Date.now();

  // 1. Tenant 목록
  let tenantsQuery = supabase.from("tenants").select("id, name");
  if (targetTenantId) {
    tenantsQuery = tenantsQuery.eq("id", targetTenantId);
  }
  const { data: tenants, error: tenantsError } = await tenantsQuery;
  if (tenantsError || !tenants) {
    log(`ERROR tenant 조회 실패: ${tenantsError?.message ?? "unknown"}`);
    process.exit(1);
  }

  log(`\nTenant 수: ${tenants.length}`);

  let totalProcessed = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const tenant of tenants as Array<{ id: string; name: string }>) {
    logSection(`Tenant: ${tenant.name} (${tenant.id})`);

    // 2. 이 tenant 내 unique target_major 목록
    let majorQuery = supabase
      .from("students")
      .select("target_major, grade")
      .eq("tenant_id", tenant.id)
      .not("target_major", "is", null);

    if (targetMajor) {
      majorQuery = majorQuery.eq("target_major", targetMajor);
    }

    const { data: studentsMajorRaw } = await majorQuery;
    if (!studentsMajorRaw || studentsMajorRaw.length === 0) {
      log("  학생 없음, 건너뜀");
      continue;
    }

    // unique (target_major, school_year) 조합 구성
    const currentYear = new Date().getFullYear();
    const uniqueMajors = new Set(
      (studentsMajorRaw as Array<{ target_major: string; grade: number | null }>)
        .map((s) => s.target_major)
        .filter(Boolean),
    );

    // school_year: 현재 년도 기준 ±1
    const schoolYears = targetYear
      ? [targetYear]
      : [currentYear - 1, currentYear];

    for (const major of uniqueMajors) {
      for (const year of schoolYears) {
        totalProcessed++;
        const key = `${major} / ${year}`;

        try {
          const benchmark = await computeCohortBenchmark(tenant.id, major, year);

          if (benchmark.cohortSize < 5) {
            log(`  SKIP  ${key} — 코호트 ${benchmark.cohortSize}명 (5명 미만)`);
            totalSkipped++;
            continue;
          }

          if (isDryRun) {
            log(
              `  DRY   ${key} — cohortSize=${benchmark.cohortSize}, avgGpa=${benchmark.avgGpa ?? "-"}, academic=${benchmark.avgAcademic ?? "-"}`,
            );
            totalSaved++;
          } else {
            await saveCohortBenchmark(benchmark);
            log(
              `  SAVED ${key} — cohortSize=${benchmark.cohortSize}, avgGpa=${benchmark.avgGpa ?? "-"}`,
            );
            totalSaved++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(JSON.stringify({
            level: "ERROR",
            key,
            tenant: tenant.id,
            tenantName: tenant.name,
            major,
            year,
            error: errMsg,
            timestamp: new Date().toISOString(),
          }));
          log(`  ERROR ${key} — ${errMsg}`);
          totalErrors++;
        }
      }
    }
  }

  // 요약
  logSection("완료 요약");
  log(`소요 시간: ${formatDuration(Date.now() - startedAt)}`);
  log(`처리: ${totalProcessed}개`);
  log(`저장${isDryRun ? "(드라이런)": ""}: ${totalSaved}개`);
  log(`건너뜀 (코호트 부족): ${totalSkipped}개`);
  log(`오류: ${totalErrors}개`);

  // 감사 로그 (JSON 구조로 출력 — CI 로그 파싱 및 모니터링 시스템 연동용)
  console.log(JSON.stringify({
    event: "cohort_benchmark_refresh",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    tenantCount: (tenants as Array<{ id: string; name: string }>).length,
    processed: totalProcessed,
    saved: totalSaved,
    skipped: totalSkipped,
    errors: totalErrors,
    dryRun: isDryRun,
  }));

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("스크립트 실행 실패:", err);
  process.exit(1);
});
