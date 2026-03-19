// ============================================
// 대학 입시 Repository
// Phase 8.1 기본 조회 + Phase 8.2 환산 엔진 조회
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConversionTable, UniversityScoreConfig, RestrictionRule, PercentageTable } from "./calculator/types";

/** 대학명으로 입시 데이터 검색 */
export async function findAdmissionsByUniversity(
  universityName: string,
  dataYear?: number,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_admissions")
    .select("*")
    .ilike("university_name", `%${universityName}%`)
    .order("department_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** 학과명으로 입시 데이터 검색 */
export async function findAdmissionsByDepartment(
  departmentName: string,
  dataYear?: number,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_admissions")
    .select("*")
    .ilike("department_name", `%${departmentName}%`)
    .order("university_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** 미적분/기하 지정과목 조회 */
export async function findMathRequirements(dataYear?: number) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_math_requirements")
    .select("*")
    .order("university_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Phase 8.2: 환산 엔진 조회 ────────────────

/** DB math/inquiry selection → Calculator 타입 매핑 */
const MATH_MAP: Record<string, UniversityScoreConfig["mathSelection"]> = {
  "가": "ga", "나": "na", "가나": "gana",
};
const INQUIRY_MAP: Record<string, UniversityScoreConfig["inquirySelection"]> = {
  "사과": "sagwa", "과": "gwa", "사": "sa",
};
const HISTORY_MAP: Record<string, UniversityScoreConfig["historySubstitute"]> = {
  "한→탐대체": "to_inquiry", "한→영대체": "to_english",
};
const FOREIGN_MAP: Record<string, UniversityScoreConfig["foreignSubstitute"]> = {
  "외→탐대체": "to_inquiry",
};

/** 대학별 환산 설정 조회 → Calculator UniversityScoreConfig */
export async function getScoreConfig(
  universityName: string,
  dataYear = 2026,
): Promise<UniversityScoreConfig | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("university_score_configs")
    .select("*")
    .eq("data_year", dataYear)
    .eq("university_name", universityName)
    .single();

  if (error || !data) return null;

  return {
    universityName: data.university_name,
    mandatoryPattern: data.mandatory_pattern,
    optionalPattern: data.optional_pattern,
    weightedPattern: data.weighted_pattern,
    inquiryCount: data.inquiry_count,
    mathSelection: MATH_MAP[data.math_selection] ?? "gana",
    inquirySelection: INQUIRY_MAP[data.inquiry_selection] ?? "sagwa",
    historySubstitute: HISTORY_MAP[data.history_substitute] ?? null,
    foreignSubstitute: FOREIGN_MAP[data.foreign_substitute] ?? null,
    bonusRules: data.bonus_rules ?? {},
    conversionType: data.conversion_type,
    scoringPath: data.scoring_path ?? "subject",
  };
}

/** 대학별 환산 설정 일괄 조회 */
export async function getScoreConfigs(
  dataYear = 2026,
): Promise<UniversityScoreConfig[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("university_score_configs")
    .select("*")
    .eq("data_year", dataYear)
    .order("university_name");

  if (error) throw error;

  return (data ?? []).map((d) => ({
    universityName: d.university_name,
    mandatoryPattern: d.mandatory_pattern,
    optionalPattern: d.optional_pattern,
    weightedPattern: d.weighted_pattern,
    inquiryCount: d.inquiry_count,
    mathSelection: MATH_MAP[d.math_selection] ?? "gana",
    inquirySelection: INQUIRY_MAP[d.inquiry_selection] ?? "sagwa",
    historySubstitute: HISTORY_MAP[d.history_substitute] ?? null,
    foreignSubstitute: FOREIGN_MAP[d.foreign_substitute] ?? null,
    bonusRules: d.bonus_rules ?? {},
    conversionType: d.conversion_type,
    scoringPath: d.scoring_path ?? "subject",
  }));
}

/** 대학별 변환 테이블 조회 → Calculator ConversionTable (Map) */
export async function getConversionTable(
  universityName: string,
  dataYear = 2026,
): Promise<ConversionTable> {
  const supabase = await createSupabaseServerClient();
  // 대학당 ~1000행 이상 가능 → 페이지네이션
  const allRows: { subject: string; raw_score: number; converted_score: number }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("university_score_conversions")
      .select("subject, raw_score, converted_score")
      .eq("data_year", dataYear)
      .eq("university_name", universityName)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const table: ConversionTable = new Map();
  for (const row of allRows) {
    table.set(`${row.subject}-${row.raw_score}`, Number(row.converted_score));
  }
  return table;
}

/** 대학별 결격사유 조회 → Calculator RestrictionRule[] */
export async function getRestrictions(
  universityName: string,
  dataYear = 2026,
): Promise<RestrictionRule[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("university_score_restrictions")
    .select("*")
    .eq("data_year", dataYear)
    .eq("university_name", universityName);

  if (error) throw error;

  return (data ?? []).map((d) => ({
    universityName: d.university_name,
    departmentName: d.department_name,
    restrictionType: d.restriction_type,
    ruleConfig: d.rule_config ?? {},
    description: d.description,
  }));
}

/** 대학별 PERCENTAGE 테이블 조회 → Calculator PercentageTable (Map) */
export async function getPercentageTable(
  universityName: string,
  dataYear = 2026,
): Promise<PercentageTable> {
  const supabase = await createSupabaseServerClient();

  const allRows: { track: string; percentile: number; converted_score: number }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("university_percentage_conversions")
      .select("track, percentile, converted_score")
      .eq("data_year", dataYear)
      .eq("university_name", universityName)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const table: PercentageTable = new Map();
  for (const row of allRows) {
    table.set(`${row.track}-${row.percentile}`, Number(row.converted_score));
  }
  return table;
}

// ── Phase 8.5a: 배치 분석 일괄 조회 ────────────────

import type { AdmissionResults } from "./types";

/** 입결 데이터 행 (배치 분석용) */
export interface AdmissionWithScores {
  university_name: string;
  department_name: string;
  region: string | null;
  department_type: string | null;
  admission_results: AdmissionResults | null;
}

/** score_configs에 등록된 대학의 입결 데이터 일괄 조회 */
export async function findAdmissionsWithScores(
  dataYear = 2026,
): Promise<AdmissionWithScores[]> {
  const supabase = await createSupabaseServerClient();

  // score_configs에서 대학명 목록 가져오기
  const { data: configData, error: configError } = await supabase
    .from("university_score_configs")
    .select("university_name")
    .eq("data_year", dataYear);

  if (configError) throw configError;
  const univNames = (configData ?? []).map((d) => d.university_name);
  if (univNames.length === 0) return [];

  // 입결 데이터 일괄 조회 (대학명 IN 필터)
  const allRows: AdmissionWithScores[] = [];
  // Supabase IN 필터는 한 번에 처리 가능
  const { data, error } = await supabase
    .from("university_admissions")
    .select("university_name, department_name, region, department_type, admission_results")
    .eq("data_year", dataYear)
    .in("university_name", univNames)
    .order("university_name");

  if (error) throw error;

  for (const row of data ?? []) {
    allRows.push({
      university_name: row.university_name,
      department_name: row.department_name,
      region: row.region,
      department_type: row.department_type,
      admission_results: row.admission_results as AdmissionResults | null,
    });
  }

  return allRows;
}

/** 전 대학 변환 테이블 일괄 조회 → Map<대학명, ConversionTable> */
export async function getAllConversionTables(
  dataYear = 2026,
): Promise<Map<string, ConversionTable>> {
  const supabase = await createSupabaseServerClient();
  const result = new Map<string, ConversionTable>();

  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("university_score_conversions")
      .select("university_name, subject, raw_score, converted_score")
      .eq("data_year", dataYear)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      let table = result.get(row.university_name);
      if (!table) {
        table = new Map();
        result.set(row.university_name, table);
      }
      table.set(`${row.subject}-${row.raw_score}`, Number(row.converted_score));
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return result;
}

/** 전 대학 결격사유 일괄 조회 → Map<대학명, RestrictionRule[]> */
export async function getAllRestrictions(
  dataYear = 2026,
): Promise<Map<string, RestrictionRule[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("university_score_restrictions")
    .select("*")
    .eq("data_year", dataYear);

  if (error) throw error;

  const result = new Map<string, RestrictionRule[]>();
  for (const d of data ?? []) {
    const rule: RestrictionRule = {
      universityName: d.university_name,
      departmentName: d.department_name,
      restrictionType: d.restriction_type,
      ruleConfig: d.rule_config ?? {},
      description: d.description,
    };
    const existing = result.get(d.university_name);
    if (existing) {
      existing.push(rule);
    } else {
      result.set(d.university_name, [rule]);
    }
  }

  return result;
}

/** 전 대학 PERCENTAGE 테이블 일괄 조회 → Map<대학명, PercentageTable> */
export async function getAllPercentageTables(
  dataYear = 2026,
): Promise<Map<string, PercentageTable>> {
  const supabase = await createSupabaseServerClient();
  const result = new Map<string, PercentageTable>();

  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("university_percentage_conversions")
      .select("university_name, track, percentile, converted_score")
      .eq("data_year", dataYear)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      let table = result.get(row.university_name);
      if (!table) {
        table = new Map();
        result.set(row.university_name, table);
      }
      table.set(`${row.track}-${row.percentile}`, Number(row.converted_score));
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return result;
}
