/**
 * 우회학과 데이터 Import CLI
 *
 * 사용법:
 *   npx tsx scripts/import-departments.ts --departments=data/departments.csv --dry-run
 *   npx tsx scripts/import-departments.ts --departments=data/departments.csv --curriculum=data/curriculum.csv --pairs=data/pairs.csv
 *   npx tsx scripts/import-departments.ts --departments=data/departments.csv --classification=data/classification.csv --limit=100
 *
 * 옵션:
 *   --departments=<path>      학과 CSV 파일 (필수)
 *   --curriculum=<path>       교육과정 CSV 파일 (선택)
 *   --classification=<path>   분류 코드 CSV 파일 (선택)
 *   --pairs=<path>            우회학과 페어 CSV 파일 (선택)
 *   --dry-run                 실제 DB 변경 없이 결과만 출력
 *   --limit=<n>               처리할 최대 행 수
 *   --batch-size=<n>          배치 크기 (기본 500)
 */

import { createClient } from "@supabase/supabase-js";
import {
  parseDepartmentCSV,
  parseCurriculumCSV,
  parseBypassPairCSV,
  parseClassificationCSV,
} from "../lib/domains/bypass-major/import/csv-parser";
import {
  bulkInsertDepartments,
  bulkInsertCurriculum,
  bulkInsertClassifications,
  bulkInsertBypassPairs,
  loadLegacyIdMap,
} from "../lib/domains/bypass-major/import/bulk-inserter";

// ============================================================
// 인자 파싱
// ============================================================

interface CLIArgs {
  departments: string;
  curriculum: string | undefined;
  classification: string | undefined;
  pairs: string | undefined;
  dryRun: boolean;
  limit: number | undefined;
  batchSize: number;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let departments = "";
  let curriculum: string | undefined;
  let classification: string | undefined;
  let pairs: string | undefined;
  let dryRun = false;
  let limit: number | undefined;
  let batchSize = 500;

  for (const arg of args) {
    if (arg.startsWith("--departments=")) {
      departments = arg.slice("--departments=".length);
    } else if (arg.startsWith("--curriculum=")) {
      curriculum = arg.slice("--curriculum=".length);
    } else if (arg.startsWith("--classification=")) {
      classification = arg.slice("--classification=".length);
    } else if (arg.startsWith("--pairs=")) {
      pairs = arg.slice("--pairs=".length);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.slice("--batch-size=".length), 10);
    }
  }

  if (!departments) {
    console.error("오류: --departments=<path> 인자가 필요합니다.");
    console.error("");
    console.error("사용법:");
    console.error(
      "  npx tsx scripts/import-departments.ts --departments=data/departments.csv --dry-run",
    );
    console.error(
      "  npx tsx scripts/import-departments.ts --departments=data/departments.csv --curriculum=data/curriculum.csv --pairs=data/pairs.csv",
    );
    process.exit(1);
  }

  return { departments, curriculum, classification, pairs, dryRun, limit, batchSize };
}

// ============================================================
// 결과 출력 헬퍼
// ============================================================

function printResult(label: string, result: { total: number; inserted: number; skipped: number; errors: Array<{ legacyId: number; error: string }> }) {
  console.log(`  [${label}]`);
  console.log(`    전체:      ${result.total}건`);
  console.log(`    삽입/갱신: ${result.inserted}건`);
  console.log(`    건너뜀:    ${result.skipped}건`);

  if (result.errors.length > 0) {
    console.log(`    오류:      ${result.errors.length}건`);
    for (const err of result.errors.slice(0, 5)) {
      console.log(`      - legacy_id=${err.legacyId}: ${err.error}`);
    }
    if (result.errors.length > 5) {
      console.log(`      ... 외 ${result.errors.length - 5}건`);
    }
  }
}

// ============================================================
// 메인
// ============================================================

async function main() {
  const config = parseArgs();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  우회학과 데이터 Import");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  학과:     ${config.departments}`);
  if (config.curriculum) console.log(`  교육과정: ${config.curriculum}`);
  if (config.classification) console.log(`  분류코드: ${config.classification}`);
  if (config.pairs) console.log(`  페어:     ${config.pairs}`);
  console.log(`  모드:     ${config.dryRun ? "DRY-RUN (DB 변경 없음)" : "LIVE"}`);
  if (config.limit) console.log(`  제한:     ${config.limit}건`);
  console.log(`  배치:     ${config.batchSize}건`);
  console.log("");

  // Supabase Admin Client 생성
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "오류: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.",
    );
    console.error("  .env.local 파일을 확인하세요.");
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startTime = Date.now();
  let hasErrors = false;

  // ── Step 1: 학과 Import ──
  console.log("[1] 학과 Import...");
  let deptRows = parseDepartmentCSV(config.departments);
  console.log(`  → ${deptRows.length}건 로드`);

  if (config.limit && deptRows.length > config.limit) {
    deptRows = deptRows.slice(0, config.limit);
    console.log(`  → ${config.limit}건으로 제한`);
  }

  const deptResult = await bulkInsertDepartments(adminClient, deptRows, {
    dryRun: config.dryRun,
    batchSize: config.batchSize,
    onProgress: (done, total) => {
      const pct = Math.round((done / total) * 100);
      process.stdout.write(`\r  진행: ${done}/${total} (${pct}%)`);
    },
  });
  console.log("");
  if (deptResult.errors.length > 0) hasErrors = true;

  // legacy_id → UUID 맵 로드 (교육과정/페어에 필요)
  let legacyIdMap = new Map<string, string>();
  if (!config.dryRun && (config.curriculum || config.pairs)) {
    console.log("  legacy_id 매핑 로드 중...");
    legacyIdMap = await loadLegacyIdMap(adminClient);
    console.log(`  → ${legacyIdMap.size}건 매핑`);
  }

  // ── Step 2: 분류 코드 Import (선택) ──
  let classResult;
  if (config.classification) {
    console.log("[2] 분류 코드 Import...");
    const classRows = parseClassificationCSV(config.classification);
    console.log(`  → ${classRows.length}건 로드`);

    classResult = await bulkInsertClassifications(adminClient, classRows, {
      dryRun: config.dryRun,
    });
    if (classResult.errors.length > 0) hasErrors = true;
  }

  // ── Step 3: 교육과정 Import (선택) ──
  let currResult;
  if (config.curriculum) {
    console.log("[3] 교육과정 Import...");
    const currRows = parseCurriculumCSV(config.curriculum);
    console.log(`  → ${currRows.length}건 로드`);

    currResult = await bulkInsertCurriculum(
      adminClient,
      currRows,
      legacyIdMap,
      {
        dryRun: config.dryRun,
        batchSize: config.batchSize,
        onProgress: (done, total) => {
          const pct = Math.round((done / total) * 100);
          process.stdout.write(`\r  진행: ${done}/${total} (${pct}%)`);
        },
      },
    );
    console.log("");
    if (currResult.errors.length > 0) hasErrors = true;
  }

  // ── Step 4: 우회학과 페어 Import (선택) ──
  let pairResult;
  if (config.pairs) {
    console.log("[4] 우회학과 페어 Import...");
    const pairRows = parseBypassPairCSV(config.pairs);
    console.log(`  → ${pairRows.length}건 로드`);

    pairResult = await bulkInsertBypassPairs(
      adminClient,
      pairRows,
      legacyIdMap,
      {
        dryRun: config.dryRun,
        batchSize: config.batchSize,
        onProgress: (done, total) => {
          const pct = Math.round((done / total) * 100);
          process.stdout.write(`\r  진행: ${done}/${total} (${pct}%)`);
        },
      },
    );
    console.log("");
    if (pairResult.errors.length > 0) hasErrors = true;
  }

  // ── 결과 출력 ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  결과");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  printResult("학과", deptResult);
  if (classResult) printResult("분류코드", classResult);
  if (currResult) printResult("교육과정", currResult);
  if (pairResult) printResult("우회학과 페어", pairResult);

  console.log(`  소요 시간: ${elapsed}초`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Import 실패:", err);
  process.exit(1);
});
