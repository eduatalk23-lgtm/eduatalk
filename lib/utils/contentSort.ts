/**
 * 콘텐츠 정렬 유틸리티
 * 
 * Supabase 쿼리에 정렬 옵션을 적용하는 공통 함수
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentSortOption } from "@/lib/types/contentFilters";

// PostgrestFilterBuilder 타입 추론
// Supabase 쿼리 빌더의 타입을 추론합니다
type PostgrestFilterBuilder<T extends Record<string, unknown> = Record<string, unknown>> = 
  ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

/**
 * 콘텐츠 쿼리에 정렬 옵션을 적용합니다.
 * 
 * @param query Supabase 쿼리 빌더
 * @param sortBy 정렬 옵션
 * @param defaultSort 기본 정렬 옵션 (기본값: 'updated_at_desc')
 * @returns 정렬이 적용된 쿼리 빌더
 */
export function applyContentSort<T extends Record<string, unknown>>(
  query: PostgrestFilterBuilder<T>,
  sortBy?: ContentSortOption | string,
  defaultSort: ContentSortOption = "updated_at_desc"
): PostgrestFilterBuilder<T> {
  const sort = (sortBy as ContentSortOption) || defaultSort;

  switch (sort) {
    case "title_asc":
      return query.order("title", { ascending: true });
    case "title_desc":
      return query.order("title", { ascending: false });
    case "difficulty_level_asc":
      return query.order("difficulty_level", { ascending: true });
    case "difficulty_level_desc":
      return query.order("difficulty_level", { ascending: false });
    case "created_at_asc":
      return query.order("created_at", { ascending: true });
    case "created_at_desc":
      return query.order("created_at", { ascending: false });
    case "updated_at_asc":
      return query.order("updated_at", { ascending: true });
    case "updated_at_desc":
    default:
      return query.order("updated_at", { ascending: false });
  }
}

