#!/usr/bin/env npx tsx
// ============================================
// 합격 생기부 배치 Import 스크립트
//
// Usage:
//   npx tsx scripts/exemplar-import.ts --dry-run              # 파일 목록만 확인
//   npx tsx scripts/exemplar-import.ts --limit=3              # 3건만 처리
//   npx tsx scripts/exemplar-import.ts --folder=2015          # 2015 폴더만
//   npx tsx scripts/exemplar-import.ts --file="김의진"         # 특정 파일만
//   npx tsx scripts/exemplar-import.ts                        # 전체 처리
//   npx tsx scripts/exemplar-import.ts --overwrite            # 기존 레코드 덮어쓰기
// ============================================

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { parseExemplarPdf } from "../lib/domains/exemplar/import/parser";
import {
  extractFileMetadata,
  mergeMetadata,
} from "../lib/domains/exemplar/import/metadata-extractor";
import { importExemplarToDb } from "../lib/domains/exemplar/import/importer";
import type { ExemplarImportFileResult } from "../lib/domains/exemplar/types";

// ============================================
// 설정
// ============================================

const BASE_DIR =
  "/Users/johyeon-u/Library/CloudStorage/GoogleDrive-eduatalk23@gmail.com/" +
  "내 드라이브/에듀엣톡(주)★/4. 웹앱개발업무/" +
  "4. 라이선스 개발(DB)_생기부레벨업(가이드)/# 합격생기부모음";

/** 우선 처리 대상 폴더 (대학 정보가 있는 폴더) */
const PRIORITY_FOLDERS = [
  "2015 합격 학생부 13",
  "2019 합격 학생부",
  "2020년 이후 합격 학생부",
];

/** 제외 파일 패턴 */
const EXCLUDE_PATTERNS = [
  /자기소개서/,
  /자소서/,
  /합격증/,
  /합격통지/,
  /신청서/,
  /교육청성적표/,
  /설계로드맵/,
  /신현지신청서/,
];

/** 지원 확장자 */
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".PDF"]);

// TODO: 실제 tenant_id로 교체
const TENANT_ID = process.env.EXEMPLAR_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";

// ============================================
// CLI 인자 파싱
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const folderArg = args.find((a) => a.startsWith("--folder="));
const folderFilter = folderArg ? folderArg.split("=")[1] : null;
const fileArg = args.find((a) => a.startsWith("--file="));
const fileFilter = fileArg ? fileArg.split("=")[1] : null;

// ============================================
// 파일 탐색
// ============================================

function findPdfFiles(baseDir: string): string[] {
  const files: string[] = [];

  const folders = folderFilter
    ? PRIORITY_FOLDERS.filter((f) => f.includes(folderFilter))
    : PRIORITY_FOLDERS;

  for (const folder of folders) {
    const folderPath = join(baseDir, folder);
    try {
      collectFiles(folderPath, files);
    } catch {
      console.warn(`⚠ 폴더 접근 실패: ${folder}`);
    }
  }

  // 파일 필터
  let filtered = files;
  if (fileFilter) {
    filtered = files.filter((f) => f.includes(fileFilter));
  }

  return filtered.slice(0, limit);
}

function collectFiles(dir: string, results: string[]) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    // macOS NFD → NFC 정규화 (한글 분리형 → 조합형)
    const normalizedEntry = entry.normalize("NFC");

    if (stat.isDirectory()) {
      collectFiles(fullPath, results);
    } else if (
      SUPPORTED_EXTENSIONS.has(extname(normalizedEntry)) &&
      !EXCLUDE_PATTERNS.some((p) => p.test(normalizedEntry))
    ) {
      results.push(fullPath);
    }
  }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log("========================================");
  console.log("합격 생기부 배치 Import");
  console.log("========================================");
  console.log(`Base: ${BASE_DIR}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "IMPORT"}`);
  console.log(`Overwrite: ${overwrite}`);
  console.log(`Limit: ${limit === Infinity ? "없음" : limit}`);
  if (folderFilter) console.log(`Folder filter: ${folderFilter}`);
  if (fileFilter) console.log(`File filter: ${fileFilter}`);
  console.log();

  // 1. 파일 목록 수집
  const files = findPdfFiles(BASE_DIR);
  console.log(`📁 대상 파일: ${files.length}건`);
  console.log();

  // 파일 목록 출력
  for (let i = 0; i < files.length; i++) {
    const meta = extractFileMetadata(files[i]);
    const uniStr = meta.universities.map((u) => u.name + (u.department ? `(${u.department})` : "")).join(", ");
    console.log(
      `  ${String(i + 1).padStart(3)}. ${meta.studentName ?? "??"} | ${meta.schoolName ?? ""} | ${uniStr || "대학정보없음"} | ${meta.admissionYear ?? "?"}`
    );
  }
  console.log();

  if (isDryRun) {
    console.log("✅ DRY RUN 완료. --dry-run 제거 후 실행하세요.");
    return;
  }

  // 2. 순차 파싱 + 저장
  const results: ExemplarImportFileResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = filePath.split("/").pop() ?? "";
    console.log(`[${i + 1}/${files.length}] 파싱 중: ${fileName}`);

    try {
      // 2a. 파일 메타데이터 추출
      const fileMeta = extractFileMetadata(filePath);

      // 2b. PDF 파싱 (Claude API)
      const parsed = await parseExemplarPdf(filePath);

      // 2c. 메타데이터 병합
      const merged = mergeMetadata(parsed, fileMeta);

      // 2d. DB 저장
      const result = await importExemplarToDb(merged, TENANT_ID, {
        overwriteExisting: overwrite,
      });

      results.push(result);

      if (result.success) {
        successCount++;
        console.log(
          `  ✅ 성공 (품질: ${result.parseQualityScore}) — ` +
          `세특 ${result.counts.seteks}, 성적 ${result.counts.grades}, ` +
          `창체 ${result.counts.creativeActivities}, 행특 ${result.counts.haengteuk}`
        );
      } else {
        failCount++;
        console.log(`  ❌ 실패: ${result.error}`);
      }

      // API Rate Limit 대비 딜레이
      if (i < files.length - 1) {
        await sleep(2000);
      }
    } catch (error) {
      failCount++;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ 에러: ${msg}`);
      results.push({
        filePath,
        success: false,
        error: msg,
        counts: {
          admissions: 0, enrollment: 0, attendance: 0, awards: 0,
          certifications: 0, careerAspirations: 0, creativeActivities: 0,
          volunteerRecords: 0, grades: 0, seteks: 0, peArtGrades: 0,
          reading: 0, haengteuk: 0,
        },
      });
    }
  }

  // 3. 결과 요약
  console.log();
  console.log("========================================");
  console.log("결과 요약");
  console.log("========================================");
  console.log(`전체: ${files.length}건`);
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${failCount}건`);

  if (failCount > 0) {
    console.log();
    console.log("실패 파일 목록:");
    for (const r of results.filter((r) => !r.success)) {
      console.log(`  - ${r.filePath.split("/").pop()}: ${r.error}`);
    }
  }

  // 전체 건수 합산
  const totalCounts = results.reduce(
    (acc, r) => {
      for (const key of Object.keys(acc) as (keyof typeof acc)[]) {
        acc[key] += r.counts[key];
      }
      return acc;
    },
    {
      admissions: 0, enrollment: 0, attendance: 0, awards: 0,
      certifications: 0, careerAspirations: 0, creativeActivities: 0,
      volunteerRecords: 0, grades: 0, seteks: 0, peArtGrades: 0,
      reading: 0, haengteuk: 0,
    }
  );

  console.log();
  console.log("저장 건수:");
  for (const [key, count] of Object.entries(totalCounts)) {
    if (count > 0) console.log(`  ${key}: ${count}건`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
