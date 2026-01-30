/**
 * 콜드 스타트 콘텐츠 중복 검사
 *
 * 동일 제목 + 교과 조합으로 중복을 검사하여
 * 이미 존재하는 콘텐츠의 재등록을 방지합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DuplicateCheckResult,
  BatchDuplicateCheckResult,
  BatchDuplicateCheckResultWithDetails,
  ExistingContentInfo,
} from "./types";
import { calculateQualityScoreFromDbRecord } from "./mappers";

/**
 * 교재 중복 검사
 *
 * @param title - 교재 제목
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkBookDuplicate(
  title: string,
  subjectCategory: string | null,
  tenantId: string | null
): Promise<DuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  let query = supabase
    .from("master_books")
    .select("id")
    .ilike("title", title.trim());

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query.limit(1).single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: no rows returned - not an error for duplicate check
    throw new Error(`교재 중복 검사 실패: ${error.message}`);
  }

  return {
    isDuplicate: !!data,
    existingId: data?.id ?? null,
  };
}

/**
 * 강의 중복 검사
 *
 * @param title - 강의 제목
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkLectureDuplicate(
  title: string,
  subjectCategory: string | null,
  tenantId: string | null
): Promise<DuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  let query = supabase
    .from("master_lectures")
    .select("id")
    .ilike("title", title.trim());

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query.limit(1).single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`강의 중복 검사 실패: ${error.message}`);
  }

  return {
    isDuplicate: !!data,
    existingId: data?.id ?? null,
  };
}

/**
 * 대소문자 무시 ilike 필터 조건 생성
 *
 * 여러 제목에 대해 OR 조건의 ilike 필터를 생성합니다.
 * 특수문자 이스케이핑을 포함합니다.
 *
 * @param titles - 검색할 제목 목록
 * @returns Supabase or() 필터용 문자열
 */
function buildIlikeOrFilter(titles: string[]): string {
  return titles
    .map((title) => {
      // Supabase 필터에서 특수문자 이스케이핑
      // % 와 _ 는 LIKE 와일드카드이므로 이스케이핑
      const escapedTitle = title
        .trim()
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      return `title.ilike.${escapedTitle}`;
    })
    .join(",");
}

/**
 * 공통 배치 중복 검사 (한 번의 쿼리로 여러 제목 검사)
 *
 * 대소문자 무시(ilike)로 검색하여 정확한 중복 검출을 수행합니다.
 *
 * @param tableName - 검사할 테이블 (master_books | master_lectures)
 * @param titles - 검사할 제목 목록
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
async function checkDuplicatesBatchInternal(
  tableName: "master_books" | "master_lectures",
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  if (titles.length === 0) {
    return { existingMap: new Map(), duplicateTitles: [] };
  }

  // 제목 정규화 (trim)
  const trimmedTitles = titles.map((t) => t.trim());

  // 대소문자 무시 검색 (ilike OR 조건)
  let query = supabase
    .from(tableName)
    .select("id, title")
    .or(buildIlikeOrFilter(trimmedTitles));

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query;

  const contentLabel = tableName === "master_books" ? "교재" : "강의";
  if (error) {
    throw new Error(`${contentLabel} 배치 중복 검사 실패: ${error.message}`);
  }

  // 결과를 Map으로 변환
  const existingMap = new Map<string, string>();
  const duplicateTitles: string[] = [];

  if (data) {
    // DB 결과를 lowercase 기준으로 Map 생성
    const dbTitleMap = new Map<string, string>();
    for (const row of data) {
      dbTitleMap.set(row.title.toLowerCase(), row.id);
    }

    // 입력된 제목 중 중복인 것만 추출
    for (const title of titles) {
      const normalizedTitle = title.trim().toLowerCase();
      const existingId = dbTitleMap.get(normalizedTitle);
      if (existingId) {
        existingMap.set(title, existingId);
        duplicateTitles.push(title);
      }
    }
  }

  return { existingMap, duplicateTitles };
}

/**
 * 교재 배치 중복 검사 (한 번의 쿼리로 여러 제목 검사)
 *
 * @param titles - 검사할 제목 목록
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkBookDuplicatesBatch(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResult> {
  return checkDuplicatesBatchInternal("master_books", titles, subjectCategory, tenantId);
}

/**
 * 강의 배치 중복 검사 (한 번의 쿼리로 여러 제목 검사)
 *
 * @param titles - 검사할 제목 목록
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkLectureDuplicatesBatch(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResult> {
  return checkDuplicatesBatchInternal("master_lectures", titles, subjectCategory, tenantId);
}

// ============================================================================
// 확장된 배치 중복 검사 (조건부 업데이트용)
// ============================================================================

/**
 * 교재 확장 배치 중복 검사 (조건부 업데이트용)
 *
 * 기존 콘텐츠의 source, recommendation_metadata 존재 여부, 품질 점수를 함께 조회
 */
export async function checkBookDuplicatesBatchWithDetails(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResultWithDetails> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  if (titles.length === 0) {
    return { existingMap: new Map(), duplicateTitles: [] };
  }

  const trimmedTitles = titles.map((t) => t.trim());

  // 대소문자 무시 검색 (ilike OR 조건)
  let query = supabase
    .from("master_books")
    .select("id, title, source, recommendation_metadata, review_score, review_count, target_students, page_analysis, cold_start_update_count")
    .or(buildIlikeOrFilter(trimmedTitles));

  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`교재 확장 배치 중복 검사 실패: ${error.message}`);
  }

  const existingMap = new Map<string, ExistingContentInfo>();
  const duplicateTitles: string[] = [];

  if (data) {
    const dbTitleMap = new Map<string, ExistingContentInfo>();

    for (const row of data) {
      const qualityScore = calculateQualityScoreFromDbRecord({
        page_analysis: row.page_analysis as { chapters?: unknown[] } | null,
        episode_analysis: null,
        review_score: row.review_score,
        review_count: row.review_count,
        recommendation_metadata: row.recommendation_metadata as {
          recommendation?: { reasons?: unknown[]; targetStudents?: string[] };
          characteristics?: { strengths?: string[] };
        } | null,
        target_students: row.target_students,
      });

      const info: ExistingContentInfo = {
        id: row.id,
        title: row.title,
        source: row.source,
        hasRecommendationMetadata: row.recommendation_metadata !== null,
        qualityScore,
        reviewScore: row.review_score,
        reviewCount: row.review_count ?? 0,
        coldStartUpdateCount: row.cold_start_update_count ?? 0,
      };

      dbTitleMap.set(row.title.toLowerCase(), info);
    }

    for (const title of titles) {
      const normalizedTitle = title.trim().toLowerCase();
      const existingInfo = dbTitleMap.get(normalizedTitle);
      if (existingInfo) {
        existingMap.set(title, existingInfo);
        duplicateTitles.push(title);
      }
    }
  }

  return { existingMap, duplicateTitles };
}

/**
 * 강의 확장 배치 중복 검사 (조건부 업데이트용)
 *
 * 기존 콘텐츠의 recommendation_metadata 존재 여부, 품질 점수를 함께 조회
 * (강의는 source 컬럼 없음)
 */
export async function checkLectureDuplicatesBatchWithDetails(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResultWithDetails> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  if (titles.length === 0) {
    return { existingMap: new Map(), duplicateTitles: [] };
  }

  const trimmedTitles = titles.map((t) => t.trim());

  // 대소문자 무시 검색 (ilike OR 조건)
  let query = supabase
    .from("master_lectures")
    .select("id, title, recommendation_metadata, review_score, review_count, target_students, episode_analysis, cold_start_update_count")
    .or(buildIlikeOrFilter(trimmedTitles));

  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`강의 확장 배치 중복 검사 실패: ${error.message}`);
  }

  const existingMap = new Map<string, ExistingContentInfo>();
  const duplicateTitles: string[] = [];

  if (data) {
    const dbTitleMap = new Map<string, ExistingContentInfo>();

    for (const row of data) {
      const qualityScore = calculateQualityScoreFromDbRecord({
        page_analysis: null,
        episode_analysis: row.episode_analysis as { chapters?: unknown[] } | null,
        review_score: row.review_score,
        review_count: row.review_count,
        recommendation_metadata: row.recommendation_metadata as {
          recommendation?: { reasons?: unknown[]; targetStudents?: string[] };
          characteristics?: { strengths?: string[] };
        } | null,
        target_students: row.target_students,
      });

      const info: ExistingContentInfo = {
        id: row.id,
        title: row.title,
        source: null, // 강의는 source 컬럼 없음
        hasRecommendationMetadata: row.recommendation_metadata !== null,
        qualityScore,
        reviewScore: row.review_score,
        reviewCount: row.review_count ?? 0,
        coldStartUpdateCount: row.cold_start_update_count ?? 0,
      };

      dbTitleMap.set(row.title.toLowerCase(), info);
    }

    for (const title of titles) {
      const normalizedTitle = title.trim().toLowerCase();
      const existingInfo = dbTitleMap.get(normalizedTitle);
      if (existingInfo) {
        existingMap.set(title, existingInfo);
        duplicateTitles.push(title);
      }
    }
  }

  return { existingMap, duplicateTitles };
}
