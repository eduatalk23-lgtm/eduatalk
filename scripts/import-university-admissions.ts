/**
 * 대학 입시 참조 데이터 Import 스크립트
 * Phase 8.1 — 추천선택 시트 → university_admissions 테이블
 *
 * 사용법:
 *   npx tsx scripts/import-university-admissions.ts --file="경로" [옵션]
 *
 * 옵션:
 *   --file=PATH       Excel 파일 경로 (필수)
 *   --sheet=NAME      시트명 (기본: "추천선택")
 *   --year=YYYY       데이터 기준년도 (기본: 헤더에서 자동 감지)
 *   --dry-run         파싱만 수행, DB 저장 안 함
 *   --batch-size=N    bulk insert 배치 크기 (기본: 500)
 *   --replace         기존 data_year 데이터 삭제 후 재삽입
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runAdmissionImport } from "../lib/domains/admission/import";

// .env.local 로드
config({ path: resolve(process.cwd(), ".env.local") });

// CLI 인자 파싱
function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      args[key] = rest.length > 0 ? rest.join("=") : true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  const filePath = args["file"] as string;
  if (!filePath) {
    console.error("❌ --file 인자가 필요합니다.");
    console.error("   예: npx tsx scripts/import-university-admissions.ts --file=\"경로/수시Report.xlsx\"");
    process.exit(1);
  }

  const dryRun = args["dry-run"] === true;
  const replace = args["replace"] === true;
  const batchSize = args["batch-size"] ? Number(args["batch-size"]) : 500;
  const sheetName = (args["sheet"] as string) || "추천선택";
  const dataYear = args["year"] ? Number(args["year"]) : undefined;

  // Supabase 클라이언트 (dry-run이 아닌 경우)
  let supabase = null;
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      console.error("❌ 환경 변수가 설정되지 않았습니다.");
      console.error("   .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
      process.exit(1);
    }

    supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  console.log("🏫 대학 입시 데이터 Import");
  console.log(`  파일: ${filePath}`);
  console.log(`  시트: ${sheetName}`);
  console.log(`  모드: ${dryRun ? "DRY RUN" : replace ? "REPLACE" : "UPSERT"}`);

  try {
    const result = await runAdmissionImport(supabase, {
      filePath,
      sheetName,
      dataYear,
      dryRun,
      batchSize,
      replace,
    });

    console.log("\n📋 결과 요약:");
    console.log(`  총 행: ${result.total}`);
    console.log(`  삽입: ${result.inserted}`);
    console.log(`  스킵: ${result.duplicatesSkipped}`);
    console.log(`  에러: ${result.errors.length}`);
    console.log(`  정제: 중복제거 ${result.cleaningStats.exactDuplicatesRemoved}, 오타수정 ${result.cleaningStats.typosNormalized}`);
  } catch (error) {
    console.error("❌ Import 실패:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
