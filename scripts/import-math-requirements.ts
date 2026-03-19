/**
 * 정시 미적분/기하 지정과목 Import 스크립트
 * Phase 8.1 — 정시_미기 시트 → university_math_requirements 테이블
 *
 * 사용법:
 *   npx tsx scripts/import-math-requirements.ts --file="경로" [옵션]
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { bulkInsertMathRequirements } from "../lib/domains/admission/import/bulk-inserter";
import type { MathRequirementImportRow } from "../lib/domains/admission/types";

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

function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

async function main() {
  const args = parseArgs();
  const filePath = args["file"] as string;
  if (!filePath) {
    console.error("❌ --file 인자가 필요합니다.");
    process.exit(1);
  }

  const dryRun = args["dry-run"] === true;
  const replace = args["replace"] === true;
  const dataYear = args["year"] ? Number(args["year"]) : 2026;
  const sheetName = (args["sheet"] as string) || "정시_미기";

  console.log("📐 미적분/기하 지정과목 Import");
  console.log(`  파일: ${filePath}`);

  // 이 시트는 행0이 타이틀("2026학년도 정시 미적분/기하 필수 지정"),
  // 행1이 실제 헤더("대학명","전형명",...), 행2부터 데이터.
  // xlsx로 직접 읽어 행1을 헤더로 사용.
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`❌ 시트 "${sheetName}"을 찾을 수 없습니다.`);
    process.exit(1);
  }
  const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
  }) as (string | number | null)[][];

  // 행1을 헤더로, 행2부터 데이터
  const headers = (allRows[1] ?? []).map((h) => String(h ?? "").trim());
  const dataRows = allRows.slice(2);

  const transformed: MathRequirementImportRow[] = [];

  for (const rawRow of dataRows) {
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { if (h) row[h] = rawRow[i] ?? null; });

    const univName = clean(row["대학명"]);
    const deptName = clean(row["모집단위"]);
    if (!univName || !deptName) continue;

    transformed.push({
      university_name: univName,
      admission_name: clean(row["전형명"]),
      group_type: clean(row["군"]),
      department_type: clean(row["계열"]),
      department_name: deptName,
      recruitment_count: clean(row["인원"]),
      usage_method: clean(row["활용방법"]),
      reflected_areas: clean(row["반영영역"]),
      korean_req: clean(row["국어"]),
      math_req: clean(row["수학"]),
      science_req: clean(row["탐구"]),
      special_notes: clean(row["특이사항"]),
    });
  }

  console.log(`  파싱 완료: ${transformed.length}행`);

  if (dryRun) {
    console.log(`\n🔍 [DRY RUN] DB 삽입 건너뜀`);
    transformed.slice(0, 5).forEach((r) => {
      console.log(`  ${r.university_name} ${r.department_name} (${r.group_type}군) — 수학: ${r.math_req}`);
    });
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("❌ 환경 변수 필요 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { inserted, skipped } = await bulkInsertMathRequirements(supabase, transformed, dataYear, { replace });
  console.log(`\n✅ 완료: 삽입 ${inserted}건, 스킵 ${skipped}건`);
}

main();
