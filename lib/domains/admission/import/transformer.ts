// ============================================
// 한글 컬럼 → 영문 필드 변환 + JSONB 조립
// Phase 8.1
// ============================================

import type { RawAdmissionRow, AdmissionImportRow, YearMapping, AdmissionResultYear, ImportError } from "../types";
import { cleanValue, isEmptyValue } from "./cleaner";
import { findHeader } from "./header-detector";

/** raw 행 배열 → AdmissionImportRow[] 변환 */
export function transformRows(
  rows: RawAdmissionRow[],
  headers: string[],
  years: YearMapping,
): { transformed: AdmissionImportRow[]; errors: ImportError[] } {
  const transformed: AdmissionImportRow[] = [];
  const errors: ImportError[] = [];

  // 연도별 헤더 매핑
  const compHeaders = [years.year0, years.year1, years.year2].map((y) => ({
    year: y,
    competition: findHeader(headers, "경쟁률", y),
  }));

  const resultHeaders = [years.year0, years.year1].map((y) => ({
    year: y,
    basis: findHeader(headers, "기준", y),
    grade: findHeader(headers, "입결(등급)", y),
    score: findHeader(headers, "입결(환산점수)", y),
    replacement: findHeader(headers, "충원", y),
  }));

  // year2 충원/입결 (단순 형태 — "2023학년도입결", "2023충원")
  const year2ResultHeader = findHeader(headers, "입결", years.year2);
  const year2ReplacementHeader = findHeader(headers, "충원", years.year2);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const univName = cleanValue(row["대학교"]);
    const deptName = cleanValue(row["모집단위명"]);

    if (!univName || !deptName) {
      errors.push({
        row: i + 2,
        universityName: univName ?? "",
        departmentName: deptName ?? "",
        error: "대학교 또는 모집단위명이 비어있습니다.",
      });
      continue;
    }

    // 경쟁률 JSONB
    const competitionRates: Record<string, string> = {};
    for (const ch of compHeaders) {
      if (ch.competition) {
        const val = cleanValue(row[ch.competition]);
        if (val) competitionRates[String(ch.year)] = val;
      }
    }

    // 입결 JSONB
    const admissionResults: Record<string, AdmissionResultYear> = {};
    for (const rh of resultHeaders) {
      const entry: AdmissionResultYear = {};
      if (rh.basis) {
        const bVal = cleanValue(row[rh.basis]);
        if (bVal) entry.basis = bVal;
      }
      if (rh.grade) {
        const gVal = cleanValue(row[rh.grade]);
        if (gVal) entry.grade = gVal;
      }
      if (rh.score) {
        const sVal = cleanValue(row[rh.score]);
        if (sVal) entry.score = sVal;
      }
      if (Object.keys(entry).length > 0) {
        admissionResults[String(rh.year)] = entry;
      }
    }
    // year2 단순 입결 (등급/환산 통합 컬럼인 경우)
    if (year2ResultHeader) {
      const y2Val = cleanValue(row[year2ResultHeader]);
      if (y2Val) {
        admissionResults[String(years.year2)] = {
          ...admissionResults[String(years.year2)],
          grade: y2Val,
        };
      }
    }

    // 충원 JSONB
    const replacements: Record<string, string> = {};
    for (const rh of resultHeaders) {
      if (rh.replacement) {
        const val = cleanValue(row[rh.replacement]);
        if (val) replacements[String(rh.year)] = val;
      }
    }
    if (year2ReplacementHeader) {
      const y2r = cleanValue(row[year2ReplacementHeader]);
      if (y2r) replacements[String(years.year2)] = y2r;
    }

    transformed.push({
      region: cleanValue(row["기초"]),
      university_name: univName,
      department_type: cleanValue(row["계열"]),
      department_name: deptName,
      admission_type: cleanValue(row["전형유형"]),
      admission_name: cleanValue(row["전형명"]),
      eligibility: cleanValue(row["지원자격"]),
      recruitment_count: cleanValue(row["모집인원"]) ?? cleanValue(row["모집\r\n인원"]),
      year_change: cleanValue(row["전년대비"]) ?? cleanValue(row["전년\r\n대비"]),
      change_details: cleanValue(row["전년대비 변경사항"]),
      min_score_criteria: cleanValue(row["최저학력기준"]),
      selection_method: cleanValue(row["전형방법"]),
      required_docs: cleanValue(row["필요서류"]) ?? cleanValue(row["필요\r\n서류"]),
      dual_application: cleanValue(row["복수지원"]) ?? cleanValue(row["복수\r\n지원"]),
      grade_weight: cleanValue(row["학년별반영비율"]),
      subjects_reflected: cleanValue(row["반영과목"]),
      career_subjects: cleanValue(row["진로선택과목"]),
      notes: cleanValue(row["지원시 유의사항"]) ?? cleanValue(row["지원시유의사항"]),
      exam_date: cleanValue(row["대학별고사 실시일"]) ?? cleanValue(row["대학별고사실시일"]),
      competition_rates: competitionRates,
      competition_change: cleanValue(row["경쟁률 증감"]) ?? cleanValue(row["경쟁률증감"]),
      admission_results: admissionResults,
      replacements,
    });
  }

  return { transformed, errors };
}
