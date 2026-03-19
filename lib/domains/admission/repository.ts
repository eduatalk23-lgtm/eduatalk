// ============================================
// 대학 입시 Repository
// Phase 8.1 기본 조회 + Phase 8.2 환산 엔진 조회
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConversionTable, UniversityScoreConfig, RestrictionRule, PercentageTable } from "./calculator/types";
import type {
  AdmissionSearchFilter,
  PaginationParams,
  AdmissionSearchRow,
  AdmissionSearchResult,
  CompetitionRates,
  AdmissionResults,
  Replacements,
  UniversityInfo,
} from "./types";
import { expandAliasNames, type AliasEntry } from "./search/alias-resolver";

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

/** 입결 데이터 행 (배치 분석용) */
export interface AdmissionWithScores {
  university_name: string;
  department_name: string;
  region: string | null;
  department_type: string | null;
  admission_results: AdmissionResults | null;
  replacements: Replacements | null;
  competition_rates: CompetitionRates | null;
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
    .select("university_name, department_name, region, department_type, admission_results, replacements, competition_rates")
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
      replacements: row.replacements as Replacements | null,
      competition_rates: row.competition_rates as CompetitionRates | null,
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

// ── Phase 8.3: 별칭 해석 + 대학 공식 정보 ────────────────

/** 별칭 테이블 전체 조회 → AliasEntry[] */
async function fetchAllAliases(): Promise<AliasEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("university_name_aliases")
    .select("alias_name, canonical_name");

  if (error) throw error;
  return (data ?? []).map((d) => ({
    aliasName: d.alias_name,
    canonicalName: d.canonical_name,
  }));
}

/**
 * 검색어의 별칭을 해석하여 확장된 대학명 배열 반환.
 * 별칭이 없으면 빈 배열.
 */
export async function resolveUniversityAliases(
  searchTerm: string,
): Promise<string[]> {
  const aliases = await fetchAllAliases();
  return expandAliasNames(aliases, searchTerm);
}

/**
 * 대학명 목록의 공식 정보(universities 테이블)를 조회.
 * 별칭 테이블을 통해 alias→canonical→universities 조인.
 * 직접 매칭(universities.name_kor) + 별칭 매칭 모두 수행.
 */
export async function getUniversityInfoMap(
  universityNames: string[],
): Promise<Record<string, UniversityInfo | null>> {
  if (universityNames.length === 0) return {};

  const supabase = await createSupabaseServerClient();
  const result: Record<string, UniversityInfo | null> = {};

  // 1. 직접 매칭: universities.name_kor = 대학명
  const { data: directMatches, error: directError } = await supabase
    .from("universities")
    .select("id, name_kor, name_eng, homepage_url, establishment_type")
    .in("name_kor", universityNames)
    .eq("university_type", "대학교");

  if (directError) throw directError;

  const directMap = new Map<string, UniversityInfo>();
  for (const d of directMatches ?? []) {
    // 중복 name_kor이면 첫 번째만 사용
    if (!directMap.has(d.name_kor)) {
      directMap.set(d.name_kor, {
        id: d.id,
        nameKor: d.name_kor,
        nameEng: d.name_eng,
        homepageUrl: d.homepage_url,
        establishmentType: d.establishment_type,
      });
    }
  }

  // 2. 별칭 매칭: alias_name → canonical_name + university_id → universities
  const unmatchedNames = universityNames.filter((n) => !directMap.has(n));

  if (unmatchedNames.length > 0) {
    const { data: aliasMatches, error: aliasError } = await supabase
      .from("university_name_aliases")
      .select(`
        alias_name,
        canonical_name,
        university_id,
        universities!fk_una_university (
          id, name_kor, name_eng, homepage_url, establishment_type
        )
      `)
      .in("alias_name", unmatchedNames);

    if (aliasError) throw aliasError;

    for (const a of aliasMatches ?? []) {
      // Supabase FK join은 단일 객체 또는 null 반환 (1:N이면 배열)
      const raw = a.universities as unknown;
      const uni = Array.isArray(raw) ? (raw[0] as {
        id: number;
        name_kor: string;
        name_eng: string | null;
        homepage_url: string | null;
        establishment_type: string | null;
      } | undefined) : (raw as {
        id: number;
        name_kor: string;
        name_eng: string | null;
        homepage_url: string | null;
        establishment_type: string | null;
      } | null);

      if (uni) {
        result[a.alias_name] = {
          id: uni.id,
          nameKor: uni.name_kor,
          nameEng: uni.name_eng,
          homepageUrl: uni.homepage_url,
          establishmentType: uni.establishment_type,
        };
      } else {
        // canonical_name은 알지만 universities에 없는 경우 (경국대학교 등)
        result[a.alias_name] = null;
      }
    }
  }

  // 3. 직접 매칭 결과 병합
  for (const name of universityNames) {
    if (!(name in result)) {
      result[name] = directMap.get(name) ?? null;
    }
  }

  return result;
}

// ── Phase 8.6: 졸업생 DB 검색 ────────────────

/** 필터 옵션 상수 (클라이언트 안전 — search/constants.ts에서 re-export) */
export {
  ADMISSION_REGIONS,
  ADMISSION_DEPARTMENT_TYPES,
  ADMISSION_TYPES,
} from "./search/constants";

/** DB 행 → camelCase 매핑 */
function mapRow(row: Record<string, unknown>): AdmissionSearchRow {
  return {
    id: row.id as string,
    dataYear: row.data_year as number,
    region: row.region as string | null,
    universityName: row.university_name as string,
    departmentType: row.department_type as string | null,
    departmentName: row.department_name as string,
    admissionType: row.admission_type as string | null,
    admissionName: row.admission_name as string | null,
    eligibility: row.eligibility as string | null,
    recruitmentCount: row.recruitment_count as string | null,
    yearChange: row.year_change as string | null,
    changeDetails: row.change_details as string | null,
    minScoreCriteria: row.min_score_criteria as string | null,
    selectionMethod: row.selection_method as string | null,
    requiredDocs: row.required_docs as string | null,
    dualApplication: row.dual_application as string | null,
    gradeWeight: row.grade_weight as string | null,
    subjectsReflected: row.subjects_reflected as string | null,
    careerSubjects: row.career_subjects as string | null,
    notes: row.notes as string | null,
    examDate: row.exam_date as string | null,
    competitionRates: (row.competition_rates ?? {}) as CompetitionRates,
    competitionChange: row.competition_change as string | null,
    admissionResults: (row.admission_results ?? {}) as AdmissionResults,
    replacements: (row.replacements ?? {}) as Replacements,
  };
}

/**
 * 입시 데이터 검색 (ilike + eq 필터 + 페이지네이션).
 * 대학명/학과명 중 최소 1개 필수.
 * Phase 8.3: 대학명 검색 시 별칭 해석 수행.
 */
export async function searchAdmissions(
  filter: AdmissionSearchFilter,
  pagination: PaginationParams,
): Promise<AdmissionSearchResult> {
  const supabase = await createSupabaseServerClient();
  const { page, pageSize } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Phase 8.3: 별칭 해석
  let aliasNames: string[] = [];
  if (filter.universityName) {
    aliasNames = await resolveUniversityAliases(filter.universityName);
  }

  // count 쿼리 빌더
  let countBuilder = supabase
    .from("university_admissions")
    .select("*", { count: "exact", head: true });

  // data 쿼리 빌더
  let dataBuilder = supabase
    .from("university_admissions")
    .select("*");

  // 공통 필터 적용 함수
  const applyFilters = (q: typeof countBuilder) => {
    if (filter.universityName) {
      if (aliasNames.length > 0) {
        // 별칭이 있으면: ilike OR in (별칭 이름들)
        const ilikeFilter = `university_name.ilike.%${filter.universityName}%`;
        const inFilter = `university_name.in.(${aliasNames.map((n) => `"${n}"`).join(",")})`;
        q = q.or(`${ilikeFilter},${inFilter}`);
      } else {
        q = q.ilike("university_name", `%${filter.universityName}%`);
      }
    }
    if (filter.departmentName) {
      q = q.ilike("department_name", `%${filter.departmentName}%`);
    }
    if (filter.region) {
      q = q.eq("region", filter.region);
    }
    if (filter.departmentType) {
      q = q.eq("department_type", filter.departmentType);
    }
    if (filter.admissionType) {
      q = q.eq("admission_type", filter.admissionType);
    }
    if (filter.dataYear) {
      q = q.eq("data_year", filter.dataYear);
    }
    return q;
  };

  countBuilder = applyFilters(countBuilder);
  dataBuilder = applyFilters(dataBuilder);

  // 카운트
  const { count, error: countError } = await countBuilder;
  if (countError) throw countError;
  const total = count ?? 0;

  if (total === 0) {
    return { rows: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // 데이터
  const { data, error } = await dataBuilder
    .order("university_name")
    .order("department_name")
    .range(from, to);

  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
