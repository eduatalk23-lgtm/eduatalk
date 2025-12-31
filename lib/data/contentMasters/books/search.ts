/**
 * 마스터 교재 검색 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MasterBook } from "@/lib/types/plan";
import type { MasterBookFilters } from "@/lib/types/contentFilters";
import { logActionDebug } from "@/lib/logging/actionLogger";
import { buildContentQuery } from "@/lib/data/contentQueryBuilder";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";

/**
 * 교재 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterBooks(
  filters: MasterBookFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterBook[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<
    MasterBook & { difficulty_levels?: Array<{ id: string; name: string }> | null }
  >(queryClient, "master_books", filters);

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterBook;
  });

  logActionDebug(
    { domain: "data", action: "searchMasterBooks" },
    "마스터 교재 조회 완료",
    {
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        publisher_id: filters.publisher_id,
        difficulty: filters.difficulty,
        sort: filters.sort,
        tenantId: filters.tenantId,
        limit: filters.limit,
      },
      result: {
        count: enrichedData.length,
        total: result.total,
        titles: enrichedData.slice(0, 3).map((b) => b.title),
      },
    }
  );

  return {
    data: enrichedData,
    total: result.total,
  };
}

/**
 * 마스터 교재 목록 조회 (드롭다운용)
 * 초기 로드 시 사용 (최대 50개)
 */
export async function getMasterBooksList(): Promise<
  Array<{ id: string; title: string }>
> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<Array<{ id: string; title: string }>>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("is_active", true)
        .order("title", { ascending: true })
        .limit(50);
    },
    {
      context: "[data/contentMasters] getMasterBooksList",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 마스터 교재 검색 (서버 사이드)
 * 검색어로 교재를 검색합니다. 최대 50개 반환.
 */
export async function searchMasterBooksForDropdown(
  searchQuery: string
): Promise<Array<{ id: string; title: string }>> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<Array<{ id: string; title: string }>>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("is_active", true)
        .ilike("title", `%${searchQuery}%`)
        .order("title", { ascending: true })
        .limit(50);
    },
    {
      context: "[data/contentMasters] searchMasterBooksForDropdown",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 마스터 교재 단일 조회 (ID로)
 * 선택된 교재 정보를 조회합니다.
 */
export async function getMasterBookForDropdown(
  bookId: string
): Promise<{ id: string; title: string } | null> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedSingleQuery<{ id: string; title: string }>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("id", bookId);
    },
    {
      context: "[data/contentMasters] getMasterBookForDropdown",
      defaultValue: null,
    }
  );

  return result;
}
