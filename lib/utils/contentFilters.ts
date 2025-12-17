/**
 * 콘텐츠 필터링 유틸리티
 * 
 * Supabase 쿼리에 필터 옵션을 적용하는 공통 함수
 */

import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import type {
  BaseContentFilters,
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
} from "@/lib/types/contentFilters";

/**
 * 콘텐츠 쿼리에 필터를 적용합니다.
 * 
 * 필터 적용 순서:
 * 1. 인덱스가 있는 컬럼 우선 (curriculum_revision_id, subject_id, subject_group_id)
 * 2. 텍스트 검색 (search)
 * 3. 난이도 필터
 * 4. 테넌트 필터 (tenantId)
 * 5. 콘텐츠 타입별 필터 (publisher_id, platform_id, content_type)
 * 
 * @param query Supabase 쿼리 빌더
 * @param filters 필터 옵션
 * @param tableName 테이블 이름 (디버깅용)
 * @returns 필터가 적용된 쿼리 빌더
 */
export function applyContentFilters<T extends Record<string, unknown>>(
  query: PostgrestFilterBuilder<any, any, T, any, any, any, any>,
  filters: BaseContentFilters | MasterBookFilters | MasterLectureFilters | MasterCustomContentFilters,
  tableName: string
): PostgrestFilterBuilder<any, any, T, any, any, any, any> {
  let filteredQuery = query;

  // 1. 인덱스가 있는 컬럼 우선 필터링
  if (filters.curriculum_revision_id) {
    filteredQuery = filteredQuery.eq("curriculum_revision_id", filters.curriculum_revision_id);
  }
  if (filters.subject_group_id) {
    filteredQuery = filteredQuery.eq("subject_group_id", filters.subject_group_id);
  }
  if (filters.subject_id) {
    filteredQuery = filteredQuery.eq("subject_id", filters.subject_id);
  }

  // 2. 텍스트 검색
  if (filters.search) {
    filteredQuery = filteredQuery.ilike("title", `%${filters.search}%`);
  }

  // 3. 난이도 필터
  if (filters.difficulty) {
    filteredQuery = filteredQuery.eq("difficulty_level", filters.difficulty as any);
  }

  // 4. 테넌트 필터
  if (filters.tenantId) {
    filteredQuery = filteredQuery.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
  } else {
    // 기본적으로 공개 콘텐츠만
    filteredQuery = filteredQuery.is("tenant_id", null);
  }

  // 5. 콘텐츠 타입별 필터
  if ("publisher_id" in filters && filters.publisher_id) {
    filteredQuery = filteredQuery.eq("publisher_id", filters.publisher_id as any);
  }
  if ("platform_id" in filters && filters.platform_id) {
    filteredQuery = filteredQuery.eq("platform_id", filters.platform_id as any);
  }
  if ("content_type" in filters && filters.content_type) {
    filteredQuery = filteredQuery.eq("content_type", filters.content_type as any);
  }

  return filteredQuery;
}

