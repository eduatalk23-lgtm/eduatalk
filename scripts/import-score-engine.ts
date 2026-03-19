/**
 * 정시 환산 엔진 데이터 Import 스크립트
 * Phase 8.2 — COMPUTE/SUBJECT3/RESTRICT → DB 3테이블
 *
 * 사용법:
 *   npx tsx scripts/import-score-engine.ts --file="경로" [옵션]
 *
 * 옵션:
 *   --file=PATH       고속성장분석기 Excel 파일 경로 (필수)
 *   --target=TYPE     import 대상: all | configs | conversions | restrictions (기본: all)
 *   --year=YYYY       데이터 기준년도 (기본: 2026)
 *   --dry-run         파싱만 수행, DB 저장 안 함
 *   --replace         기존 data_year 데이터 삭제 후 재삽입
 *   --batch-size=N    conversions 배치 크기 (기본: 1000)
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { parseComputeSheet } from "../lib/domains/admission/import/score-config-parser";
import { parseSubject3Sheet } from "../lib/domains/admission/import/conversion-parser";
import { parseRestrictSheet } from "../lib/domains/admission/import/restriction-parser";
import { parsePercentageSheet } from "../lib/domains/admission/import/percentage-parser";
import {
  bulkInsertScoreConfigs,
  bulkInsertConversions,
  bulkInsertRestrictions,
  bulkInsertPercentageConversions,
} from "../lib/domains/admission/import/bulk-inserter";

config({ path: resolve(process.cwd(), ".env.local") });

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

type Target = "all" | "configs" | "conversions" | "restrictions" | "percentage";

async function main() {
  const args = parseArgs();
  const filePath = args["file"] as string;
  if (!filePath) {
    console.error("❌ --file 인자가 필요합니다.");
    console.error('   예: npx tsx scripts/import-score-engine.ts --file="경로/고속성장분석기.xlsx"');
    process.exit(1);
  }

  const target = ((args["target"] as string) || "all") as Target;
  const dryRun = args["dry-run"] === true;
  const replace = args["replace"] === true;
  const dataYear = args["year"] ? Number(args["year"]) : 2026;
  const batchSize = args["batch-size"] ? Number(args["batch-size"]) : 1000;

  console.log("🎯 정시 환산 엔진 데이터 Import");
  console.log(`  파일: ${filePath}`);
  console.log(`  대상: ${target}`);
  console.log(`  연도: ${dataYear}`);
  console.log(`  모드: ${dryRun ? "DRY RUN" : replace ? "REPLACE" : "INSERT"}`);
  console.log("");

  // Supabase 클라이언트
  let supabase = null;
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error("❌ 환경 변수 필요 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
      process.exit(1);
    }
    supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ── 1. COMPUTE → university_score_configs ──
  if (target === "all" || target === "configs") {
    console.log("━━━ COMPUTE → university_score_configs ━━━");
    try {
      const { rows, errors } = parseComputeSheet(filePath);
      console.log(`  파싱 완료: ${rows.length}개 대학`);
      if (errors.length > 0) {
        console.log(`  ⚠️ 건너뛴 항목: ${errors.length}개`);
        errors.slice(0, 5).forEach((e) => console.log(`    ${e}`));
      }

      // 샘플 출력
      if (rows.length > 0) {
        const sample = rows[0];
        console.log(`  샘플: ${sample.university_name} — 필수=${sample.mandatory_pattern}, 선택=${sample.optional_pattern ?? "없음"}, 가중택=${sample.weighted_pattern ?? "없음"}`);
      }

      if (!dryRun && supabase) {
        const { inserted, skipped } = await bulkInsertScoreConfigs(supabase, rows, dataYear, { replace });
        console.log(`  ✅ 삽입: ${inserted}건, 스킵: ${skipped}건`);
      } else {
        console.log(`  🔍 [DRY RUN] DB 삽입 건너뜀`);
      }
    } catch (err) {
      console.error("  ❌ COMPUTE 실패:", err instanceof Error ? err.message : err);
    }
    console.log("");
  }

  // ── 2. SUBJECT3 → university_score_conversions ──
  if (target === "all" || target === "conversions") {
    console.log("━━━ SUBJECT3 → university_score_conversions ━━━");
    try {
      const result = parseSubject3Sheet(filePath, "SUBJECT3", {
        onProgress: (current, total) => {
          process.stdout.write(`\r  파싱 진행: ${current}/${total}`);
        },
      });
      console.log(`\r  파싱 완료: ${result.rows.length}행 (대학 ${result.universityCount}개, 0값 스킵 ${result.skippedZeros}건)`);
      console.log("  과목별 행 수:");
      Object.entries(result.subjectStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([subj, count]) => console.log(`    ${subj}: ${count.toLocaleString()}`));

      if (!dryRun && supabase) {
        console.log(`  💾 DB 삽입 시작 (배치: ${batchSize}행)...`);
        const { inserted, skipped } = await bulkInsertConversions(supabase, result.rows, dataYear, { batchSize, replace });
        console.log(`  ✅ 삽입: ${inserted.toLocaleString()}건, 스킵: ${skipped.toLocaleString()}건`);
      } else {
        console.log(`  🔍 [DRY RUN] DB 삽입 건너뜀`);
      }
    } catch (err) {
      console.error("  ❌ SUBJECT3 실패:", err instanceof Error ? err.message : err);
    }
    console.log("");
  }

  // ── 3. RESTRICT → university_score_restrictions ──
  if (target === "all" || target === "restrictions") {
    console.log("━━━ RESTRICT → university_score_restrictions ━━━");
    try {
      const { rows, stats } = parseRestrictSheet(filePath);
      console.log(`  파싱 완료: ${rows.length}건`);
      console.log(`    Section 1 (수탐결격): ${stats.section1}건`);
      console.log(`    Section 2 (등급합/2외): ${stats.section2}건`);
      console.log(`    Section 3 (지정과목): ${stats.section3}건`);

      // 샘플 출력
      rows.slice(0, 3).forEach((r) => {
        console.log(`    ${r.university_name}${r.department_name ? ` ${r.department_name}` : ""} — ${r.restriction_type}: ${r.description}`);
      });

      if (!dryRun && supabase) {
        const { inserted, skipped } = await bulkInsertRestrictions(supabase, rows, dataYear, { replace });
        console.log(`  ✅ 삽입: ${inserted}건, 스킵: ${skipped}건`);
      } else {
        console.log(`  🔍 [DRY RUN] DB 삽입 건너뜀`);
      }
    } catch (err) {
      console.error("  ❌ RESTRICT 실패:", err instanceof Error ? err.message : err);
    }
    console.log("");
  }

  // ── 4. PERCENTAGE → university_percentage_conversions ──
  if (target === "all" || target === "percentage") {
    console.log("━━━ PERCENTAGE → university_percentage_conversions ━━━");
    try {
      const result = parsePercentageSheet(filePath, "PERCENTAGE", {
        onProgress: (current, total) => {
          process.stdout.write(`\r  파싱 진행: ${current}/${total}`);
        },
      });
      console.log(`\r  파싱 완료: ${result.rows.length.toLocaleString()}행 (대학×트랙 ${result.universityTrackCount}개, 0값 스킵 ${result.skippedZeros.toLocaleString()}건)`);

      if (!dryRun && supabase) {
        console.log(`  💾 DB 삽입 시작 (배치: ${batchSize}행)...`);
        const { inserted, skipped } = await bulkInsertPercentageConversions(supabase, result.rows, dataYear, { batchSize, replace });
        console.log(`  ✅ 삽입: ${inserted.toLocaleString()}건, 스킵: ${skipped.toLocaleString()}건`);
      } else {
        console.log(`  🔍 [DRY RUN] DB 삽입 건너뜀`);
      }
    } catch (err) {
      console.error("  ❌ PERCENTAGE 실패:", err instanceof Error ? err.message : err);
    }
    console.log("");
  }

  console.log("🏁 완료");
}

main();
