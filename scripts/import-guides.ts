/**
 * 탐구 가이드 Import CLI
 *
 * 사용법:
 *   npx tsx scripts/import-guides.ts --file=data/guides.csv --dry-run
 *   npx tsx scripts/import-guides.ts --file=data/guides.json --limit=100
 *   npx tsx scripts/import-guides.ts --file=data/guides.csv
 *
 * 옵션:
 *   --file=<path>    CSV 또는 JSON 파일 경로 (필수)
 *   --dry-run        실제 DB 변경 없이 매칭 결과만 출력
 *   --limit=<n>      처리할 최대 행 수
 *   --batch-size=<n> 배치 크기 (기본 500)
 */

import { createClient } from "@supabase/supabase-js";
import { parseAccessCSV, parseAccessJSON } from "../lib/domains/guide/import/access-parser";
import { bulkInsertGuides } from "../lib/domains/guide/import/bulk-inserter";

// ============================================================
// 인자 파싱
// ============================================================

function parseArgs(): {
  file: string;
  dryRun: boolean;
  limit: number | undefined;
  batchSize: number;
} {
  const args = process.argv.slice(2);
  let file = "";
  let dryRun = false;
  let limit: number | undefined;
  let batchSize = 500;

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      file = arg.slice("--file=".length);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.slice("--batch-size=".length), 10);
    }
  }

  if (!file) {
    console.error("오류: --file=<path> 인자가 필요합니다.");
    console.error("");
    console.error("사용법:");
    console.error("  npx tsx scripts/import-guides.ts --file=data/guides.csv --dry-run");
    console.error("  npx tsx scripts/import-guides.ts --file=data/guides.json --limit=100");
    process.exit(1);
  }

  return { file, dryRun, limit, batchSize };
}

// ============================================================
// 메인
// ============================================================

async function main() {
  const { file, dryRun, limit, batchSize } = parseArgs();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  탐구 가이드 Import");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  파일: ${file}`);
  console.log(`  모드: ${dryRun ? "DRY-RUN (DB 변경 없음)" : "LIVE"}`);
  if (limit) console.log(`  제한: ${limit}건`);
  console.log(`  배치: ${batchSize}건`);
  console.log("");

  // 1. 파일 파싱
  console.log("[1/3] 파일 파싱 중...");
  let rows;
  if (file.endsWith(".json")) {
    rows = parseAccessJSON(file);
  } else {
    rows = parseAccessCSV(file);
  }
  console.log(`  → ${rows.length}건 로드`);

  if (limit && rows.length > limit) {
    rows = rows.slice(0, limit);
    console.log(`  → ${limit}건으로 제한`);
  }

  // 2. Supabase Admin Client 생성
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("오류: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
    console.error("  .env.local 파일을 확인하세요.");
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Import 실행
  console.log(`[2/3] Import ${dryRun ? "(dry-run)" : ""} 실행 중...`);
  const startTime = Date.now();

  const result = await bulkInsertGuides(adminClient, rows, {
    dryRun,
    batchSize,
    onProgress: (done, total) => {
      const pct = Math.round((done / total) * 100);
      process.stdout.write(`\r  진행: ${done}/${total} (${pct}%)`);
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(""); // 줄바꿈

  // 4. 결과 출력
  console.log("");
  console.log("[3/3] 결과");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  전체:         ${result.total}건`);
  console.log(`  삽입/갱신:    ${result.inserted}건`);
  console.log(`  건너뜀:       ${result.skipped}건`);
  console.log(`  과목 매칭률:  ${result.subjectMatchRate}%`);
  console.log(`  계열 매칭률:  ${result.careerFieldMatchRate}%`);
  console.log(`  소요 시간:    ${elapsed}초`);

  if (result.errors.length > 0) {
    console.log("");
    console.log(`  오류: ${result.errors.length}건`);
    for (const err of result.errors.slice(0, 10)) {
      console.log(`    - legacy_id=${err.legacyId}: ${err.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`    ... 외 ${result.errors.length - 10}건`);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (result.subjectMatchRate < 95) {
    console.warn("");
    console.warn(`⚠ 과목 매칭률이 95% 미만입니다 (${result.subjectMatchRate}%).`);
    console.warn("  subject-matcher.ts의 MANUAL_MAPPINGS를 확인하세요.");
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Import 실패:", err);
  process.exit(1);
});
