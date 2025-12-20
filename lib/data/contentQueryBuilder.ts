/**
 * 콘텐츠 쿼리 빌더
 * 
 * 마스터 콘텐츠 테이블(master_books, master_lectures, master_custom_contents)에 대한
 * 공통 쿼리 빌더 패턴을 제공합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyContentFilters } from "@/lib/utils/contentFilters";
import { applyContentSort } from "@/lib/utils/contentSort";
import type {
  BaseContentFilters,
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
} from "@/lib/types/contentFilters";
import { normalizeError, logError } from "@/lib/errors";

/**
 * 콘텐츠 타입별 테이블 이름
 */
export type ContentTableName =
  | "master_books"
  | "master_lectures"
  | "master_custom_contents";

/**
 * 콘텐츠 검색 결과
 */
export type ContentSearchResult<T> = {
  data: T[];
  total: number;
};

/**
 * 콘텐츠 쿼리를 빌드하고 실행합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param tableName 테이블 이름
 * @param filters 필터 옵션
 * @returns 검색 결과
 */
export async function buildContentQuery<T>(
  supabase: SupabaseClient,
  tableName: ContentTableName,
  filters: BaseContentFilters | MasterBookFilters | MasterLectureFilters | MasterCustomContentFilters
): Promise<ContentSearchResult<T>> {
  // JOIN을 포함한 select 문자열 생성 (difficulty_levels JOIN)
  // difficulty_level_id가 있는 경우에만 JOIN 수행
  const selectString = `*, difficulty_levels:difficulty_level_id(id, name)`;
  
  // 기본 쿼리 생성 (count 포함, JOIN 포함)
  let query = supabase.from(tableName).select(selectString, { count: "exact" });

  // 필터 적용
  query = applyContentFilters(query, filters, tableName);

  // 정렬 적용
  query = applyContentSort(query, filters.sort, "updated_at_desc");

  // 페이지네이션 적용
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset !== undefined) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 20) - 1
    );
  }

  // 쿼리 실행
  const { data, error, count } = await query;

  // 에러 처리
  if (error) {
    console.error(`[data/contentQueryBuilder] ${tableName} 검색 실패`, error);

    const normalizedError = normalizeError(error);
    logError(normalizedError, {
      context: `buildContentQuery:${tableName}`,
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        search: filters.search,
        difficulty: filters.difficulty,
        tenantId: filters.tenantId,
        sort: filters.sort,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
    throw normalizedError;
  }

  const result: ContentSearchResult<T> = {
    data: (data as T[] | null) ?? [],
    total: count ?? 0,
  };

  // 로그: 검색 결과 (개발 환경에서만 상세 로깅)
  if (process.env.NODE_ENV === "development") {
    console.log(`[data/contentQueryBuilder] ${tableName} 검색 결과:`, {
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        search: filters.search,
        difficulty: filters.difficulty,
        sort: filters.sort,
        tenantId: filters.tenantId,
        limit: filters.limit,
        offset: filters.offset,
      },
      result: {
        count: result.data.length,
        total: result.total,
        // 처음 3개만 로깅 (성능 고려)
        sample: result.data.slice(0, 3).map((item: any) => ({
          id: item.id,
          title: item.title,
        })),
      },
    });
  }

  return result;
}

