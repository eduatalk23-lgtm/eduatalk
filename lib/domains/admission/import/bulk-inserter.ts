// ============================================
// 배치 DB 삽입
// Phase 8.1 — service key로 RLS 우회, ON CONFLICT 멱등
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdmissionImportRow,
  MathRequirementImportRow,
  ScoreConfigImportRow,
  ConversionImportRow,
  RestrictionImportRow,
  PercentageConversionImportRow,
} from "../types";

/** 추천선택 데이터 배치 삽입 */
export async function bulkInsertAdmissions(
  supabase: SupabaseClient,
  rows: AdmissionImportRow[],
  dataYear: number,
  options: { batchSize?: number; replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  const batchSize = options.batchSize ?? 500;

  // --replace: 기존 data_year 데이터 삭제 후 재삽입
  if (options.replace) {
    const { error } = await supabase
      .from("university_admissions")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
    console.log(`  기존 data_year=${dataYear} 데이터 삭제 완료`);
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const dbRows = batch.map((row) => ({
      data_year: dataYear,
      region: row.region,
      university_name: row.university_name,
      department_type: row.department_type,
      department_name: row.department_name,
      admission_type: row.admission_type,
      admission_name: row.admission_name,
      eligibility: row.eligibility,
      recruitment_count: row.recruitment_count,
      year_change: row.year_change,
      change_details: row.change_details,
      min_score_criteria: row.min_score_criteria,
      selection_method: row.selection_method,
      required_docs: row.required_docs,
      dual_application: row.dual_application,
      grade_weight: row.grade_weight,
      subjects_reflected: row.subjects_reflected,
      career_subjects: row.career_subjects,
      notes: row.notes,
      exam_date: row.exam_date,
      competition_rates: row.competition_rates,
      competition_change: row.competition_change,
      admission_results: row.admission_results,
      replacements: row.replacements,
    }));

    // COALESCE 기반 UNIQUE INDEX는 Supabase JS onConflict와 호환 불가 → 단순 INSERT
    const { error } = await supabase
      .from("university_admissions")
      .insert(dbRows);

    if (error) {
      // UNIQUE 위반 시 개별 삽입으로 폴백
      if (error.code === "23505") {
        let batchInserted = 0;
        for (const row of dbRows) {
          const { error: singleErr } = await supabase.from("university_admissions").insert(row);
          if (singleErr) { skipped++; } else { batchInserted++; }
        }
        inserted += batchInserted;
      } else {
        throw new Error(`배치 ${Math.floor(i / batchSize) + 1} 삽입 실패: ${error.message}`);
      }
    } else {
      inserted += batch.length;
    }

    const progress = Math.min(i + batchSize, rows.length);
    process.stdout.write(`\r  진행: ${progress}/${rows.length} (삽입: ${inserted}, 스킵: ${skipped})`);
  }

  console.log(""); // 줄바꿈
  return { inserted, skipped };
}

/** 미적분기하 지정 배치 삽입 */
export async function bulkInsertMathRequirements(
  supabase: SupabaseClient,
  rows: MathRequirementImportRow[],
  dataYear: number,
  options: { replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  if (options.replace) {
    const { error } = await supabase
      .from("university_math_requirements")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
  }

  const dbRows = rows.map((row) => ({
    data_year: dataYear,
    ...row,
  }));

  const { error } = await supabase
    .from("university_math_requirements")
    .insert(dbRows);

  if (error) {
    if (error.code === "23505") {
      // UNIQUE 위반 시 개별 삽입 폴백
      let inserted = 0;
      let skipped = 0;
      for (const row of dbRows) {
        const { error: sErr } = await supabase.from("university_math_requirements").insert(row);
        if (sErr) { skipped++; } else { inserted++; }
      }
      return { inserted, skipped };
    }
    throw new Error(`삽입 실패: ${error.message}`);
  }

  return { inserted: rows.length, skipped: 0 };
}

// ── Phase 8.2: Score Engine 배치 삽입 ─────────

/** 환산 설정 배치 삽입 */
export async function bulkInsertScoreConfigs(
  supabase: SupabaseClient,
  rows: ScoreConfigImportRow[],
  dataYear: number,
  options: { replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  if (options.replace) {
    const { error } = await supabase
      .from("university_score_configs")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
  }

  const dbRows = rows.map((r) => ({
    data_year: dataYear,
    university_name: r.university_name,
    mandatory_pattern: r.mandatory_pattern,
    optional_pattern: r.optional_pattern,
    weighted_pattern: r.weighted_pattern,
    inquiry_count: r.inquiry_count,
    math_selection: r.math_selection,
    inquiry_selection: r.inquiry_selection,
    history_substitute: r.history_substitute,
    foreign_substitute: r.foreign_substitute,
    bonus_rules: r.bonus_rules,
    conversion_type: r.conversion_type,
    scoring_path: r.scoring_path,
  }));

  const { error } = await supabase
    .from("university_score_configs")
    .insert(dbRows);

  if (error) {
    if (error.code === "23505") {
      let inserted = 0;
      let skipped = 0;
      for (const row of dbRows) {
        const { error: sErr } = await supabase.from("university_score_configs").insert(row);
        if (sErr) { skipped++; } else { inserted++; }
      }
      return { inserted, skipped };
    }
    throw new Error(`삽입 실패: ${error.message}`);
  }

  return { inserted: rows.length, skipped: 0 };
}

/** 환산점수 변환 대량 배치 삽입 (628K행 처리) */
export async function bulkInsertConversions(
  supabase: SupabaseClient,
  rows: ConversionImportRow[],
  dataYear: number,
  options: { batchSize?: number; replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  const batchSize = options.batchSize ?? 1000;

  if (options.replace) {
    const { error } = await supabase
      .from("university_score_conversions")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
    console.log(`  기존 data_year=${dataYear} conversions 삭제 완료`);
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const dbRows = batch.map((r) => ({
      data_year: dataYear,
      university_name: r.university_name,
      subject: r.subject,
      raw_score: r.raw_score,
      converted_score: r.converted_score,
    }));

    const { error } = await supabase
      .from("university_score_conversions")
      .insert(dbRows);

    if (error) {
      if (error.code === "23505") {
        let batchInserted = 0;
        for (const row of dbRows) {
          const { error: sErr } = await supabase.from("university_score_conversions").insert(row);
          if (sErr) { skipped++; } else { batchInserted++; }
        }
        inserted += batchInserted;
      } else {
        throw new Error(`배치 ${Math.floor(i / batchSize) + 1} 삽입 실패: ${error.message}`);
      }
    } else {
      inserted += batch.length;
    }

    const progress = Math.min(i + batchSize, rows.length);
    process.stdout.write(`\r  진행: ${progress}/${rows.length} (삽입: ${inserted}, 스킵: ${skipped})`);
  }

  console.log(""); // 줄바꿈
  return { inserted, skipped };
}

/** 결격사유 배치 삽입 */
export async function bulkInsertRestrictions(
  supabase: SupabaseClient,
  rows: RestrictionImportRow[],
  dataYear: number,
  options: { replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  if (options.replace) {
    const { error } = await supabase
      .from("university_score_restrictions")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
  }

  const dbRows = rows.map((r) => ({
    data_year: dataYear,
    university_name: r.university_name,
    department_name: r.department_name,
    restriction_type: r.restriction_type,
    rule_config: r.rule_config,
    description: r.description,
  }));

  const { error } = await supabase
    .from("university_score_restrictions")
    .insert(dbRows);

  if (error) {
    if (error.code === "23505") {
      let inserted = 0;
      let skipped = 0;
      for (const row of dbRows) {
        const { error: sErr } = await supabase.from("university_score_restrictions").insert(row);
        if (sErr) { skipped++; } else { inserted++; }
      }
      return { inserted, skipped };
    }
    throw new Error(`restrictions 삽입 실패: ${error.message}`);
  }

  return { inserted: rows.length, skipped: 0 };
}

// ── Phase 8.2b: PERCENTAGE 배치 삽입 ─────────

/** PERCENTAGE 변환 대량 배치 삽입 (883K행) */
export async function bulkInsertPercentageConversions(
  supabase: SupabaseClient,
  rows: PercentageConversionImportRow[],
  dataYear: number,
  options: { batchSize?: number; replace?: boolean } = {},
): Promise<{ inserted: number; skipped: number }> {
  const batchSize = options.batchSize ?? 1000;

  if (options.replace) {
    const { error } = await supabase
      .from("university_percentage_conversions")
      .delete()
      .eq("data_year", dataYear);
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
    console.log(`  기존 data_year=${dataYear} percentage 삭제 완료`);
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const dbRows = batch.map((r) => ({
      data_year: dataYear,
      university_name: r.university_name,
      track: r.track,
      percentile: r.percentile,
      converted_score: r.converted_score,
    }));

    const { error } = await supabase
      .from("university_percentage_conversions")
      .insert(dbRows);

    if (error) {
      if (error.code === "23505") {
        let batchInserted = 0;
        for (const row of dbRows) {
          const { error: sErr } = await supabase.from("university_percentage_conversions").insert(row);
          if (sErr) { skipped++; } else { batchInserted++; }
        }
        inserted += batchInserted;
      } else {
        throw new Error(`percentage 배치 ${Math.floor(i / batchSize) + 1} 실패: ${error.message}`);
      }
    } else {
      inserted += batch.length;
    }

    const progress = Math.min(i + batchSize, rows.length);
    process.stdout.write(`\r  진행: ${progress}/${rows.length} (삽입: ${inserted}, 스킵: ${skipped})`);
  }

  console.log("");
  return { inserted, skipped };
}
