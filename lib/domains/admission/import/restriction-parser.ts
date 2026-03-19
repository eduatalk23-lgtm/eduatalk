// ============================================
// RESTRICT 시트 파서
// Phase 8.2 — 3섹션 병렬 → RestrictionImportRow[]
// ============================================

import * as XLSX from "xlsx";
import type { RestrictionImportRow } from "../types";

/**
 * RESTRICT 시트 구조 (3개 섹션 병렬):
 *
 * Section 1 (col 0-3): 수학/탐구 결격
 *   - col 0: 응시제한 대학명 (비어있으면 결격 없음)
 *   - col 1: 대학 상세명 (=COMPUTE Row1 코드)
 *   - col 2: 결격 설명 — "제외(수탐결격)" → no_show
 *
 * Section 2 (col 4-7): 영어/한국사/등급합/제2외국어 결격
 *   - col 4/5: 대학명/코드
 *   - col 6: 결격 설명 — "제외(등급합)" → grade_sum, "제외(2외누락)" → no_show
 *
 * Section 3 (col 8-11): 과학탐구 지정과목 미응시
 *   - col 9: 대학교, col 10: 전공(모집단위), col 11: 결격 설명
 *   - "제외(물화누락)", "제외(생화누락)", "제외(생과누락)" → subject_req
 */

/** 데이터 시작 행 (행0=타이틀, 행1=헤더) */
const DATA_ROW_START = 2;

function cleanStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

/**
 * 결격 설명 문자열 → restriction_type + rule_config 매핑
 */
function parseRestrictionDescription(
  desc: string,
  section: 1 | 2 | 3,
): { type: RestrictionImportRow["restriction_type"]; config: Record<string, unknown> } | null {
  const trimmed = desc.trim();

  if (section === 1) {
    // Section 1: 수탐결격
    if (trimmed.includes("수탐결격")) {
      return { type: "no_show", config: { areas: ["수학", "탐구"] } };
    }
    return null;
  }

  if (section === 2) {
    // Section 2: 등급합 / 2외누락
    if (trimmed.includes("등급합")) {
      return { type: "grade_sum", config: {} };
    }
    if (trimmed.includes("2외누락")) {
      return { type: "no_show", config: { areas: ["제2외국어"] } };
    }
    return null;
  }

  // Section 3: 지정과목 미응시
  // "제외(물화누락)" → 물리+화학 필수
  // "제외(생화누락)" → 생명과학+화학 필수
  // "제외(생과누락)" → 생명과학+과학 필수
  const match = trimmed.match(/제외\((.+?)누락\)/);
  if (match) {
    const code = match[1];
    const requiredSubjects = parseSubjectCode(code);
    return {
      type: "subject_req",
      config: { required_subjects: requiredSubjects },
    };
  }

  return null;
}

/** 약어 코드 → 과목명 배열 */
function parseSubjectCode(code: string): string[] {
  const map: Record<string, string[]> = {
    "물화": ["물리학", "화학"],
    "생화": ["생명과학", "화학"],
    "생과": ["생명과학", "과학"],
    "물생": ["물리학", "생명과학"],
    "화생": ["화학", "생명과학"],
  };
  return map[code] ?? [code];
}

export function parseRestrictSheet(
  filePath: string,
  sheetName = "RESTRICT",
): { rows: RestrictionImportRow[]; stats: { section1: number; section2: number; section3: number } } {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`시트 "${sheetName}"을 찾을 수 없습니다.`);
  }

  const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  const rows: RestrictionImportRow[] = [];
  const stats = { section1: 0, section2: 0, section3: 0 };

  for (let i = DATA_ROW_START; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;

    // Section 1: 수학/탐구 결격
    const s1Name = cleanStr(row[0]);
    const s1Desc = cleanStr(row[2]);
    if (s1Name && s1Desc) {
      const parsed = parseRestrictionDescription(s1Desc, 1);
      if (parsed) {
        rows.push({
          university_name: s1Name,
          department_name: null,
          restriction_type: parsed.type,
          rule_config: parsed.config,
          description: s1Desc,
        });
        stats.section1++;
      }
    }

    // Section 2: 영어/한국사/등급합/제2외국어 결격
    const s2Name = cleanStr(row[4]);
    const s2Desc = cleanStr(row[6]);
    if (s2Name && s2Desc) {
      const parsed = parseRestrictionDescription(s2Desc, 2);
      if (parsed) {
        rows.push({
          university_name: s2Name,
          department_name: null,
          restriction_type: parsed.type,
          rule_config: parsed.config,
          description: s2Desc,
        });
        stats.section2++;
      }
    }

    // Section 3: 과학탐구 지정과목
    const s3Univ = cleanStr(row[9]);
    const s3Dept = cleanStr(row[10]);
    const s3Desc = cleanStr(row[11]);
    if (s3Univ && s3Desc) {
      const parsed = parseRestrictionDescription(s3Desc, 3);
      if (parsed) {
        rows.push({
          university_name: s3Univ,
          department_name: s3Dept,
          restriction_type: parsed.type,
          rule_config: parsed.config,
          description: s3Desc,
        });
        stats.section3++;
      }
    }
  }

  return { rows, stats };
}
