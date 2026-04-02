#!/usr/bin/env npx tsx
// ============================================
// 파싱된 JSON 파일 → DB 저장
//
// Usage:
//   npx tsx scripts/exemplar-json-import.ts                          # data/exemplar-parsed/ 전체
//   npx tsx scripts/exemplar-json-import.ts --file=강채아             # 특정 파일만
//   npx tsx scripts/exemplar-json-import.ts --dry-run                # DB 저장 없이 검증만
//   npx tsx scripts/exemplar-json-import.ts --overwrite              # 기존 레코드 덮어쓰기
// ============================================

import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { importExemplarToDb } from "../lib/domains/exemplar/import/importer";
import type { ExemplarParsedData } from "../lib/domains/exemplar/types";

const JSON_DIR = join(process.cwd(), "data/exemplar-parsed");

// TODO: 실제 tenant_id로 교체
const TENANT_ID = process.env.EXEMPLAR_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const fileArg = args.find((a) => a.startsWith("--file="));
const fileFilter = fileArg ? fileArg.split("=")[1] : null;

async function main() {
  // JSON 파일 목록
  let files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(JSON_DIR, f));

  if (fileFilter) {
    files = files.filter((f) => f.includes(fileFilter));
  }

  console.log(`📁 JSON 파일: ${files.length}건`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (검증만)" : "IMPORT"}`);
  console.log();

  let success = 0;
  let fail = 0;

  for (const filePath of files) {
    const fileName = filePath.split("/").pop()!;
    const raw = readFileSync(filePath, "utf-8");
    const data: ExemplarParsedData = JSON.parse(raw);

    console.log(`[${fileName}]`);
    console.log(`  학생: ${data.studentInfo.name} | 학교: ${data.studentInfo.schoolName}`);
    console.log(`  합격: ${data.admissions?.map((a) => a.universityName).join(", ") || "없음"}`);
    console.log(`  품질: ${data.metadata.parseQualityScore}`);
    console.log(
      `  건수: 성적${data.grades?.length ?? 0} 세특${data.seteks?.length ?? 0} ` +
      `창체${data.creativeActivities?.length ?? 0} 행특${data.haengteuk?.length ?? 0} ` +
      `수상${data.awards?.length ?? 0} 봉사${data.volunteerRecords?.length ?? 0} ` +
      `독서${data.reading?.length ?? 0}`
    );

    if (isDryRun) {
      console.log(`  ✅ 검증 통과`);
      success++;
      continue;
    }

    const result = await importExemplarToDb(data, TENANT_ID, {
      overwriteExisting: overwrite,
    });

    if (result.success) {
      success++;
      console.log(`  ✅ DB 저장 완료 (id: ${result.exemplarId?.slice(0, 8)}...)`);
    } else {
      fail++;
      console.log(`  ❌ 실패: ${result.error}`);
    }
  }

  console.log();
  console.log(`완료: 성공 ${success} / 실패 ${fail} / 전체 ${files.length}`);
}

main().catch(console.error);
