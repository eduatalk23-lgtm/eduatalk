/**
 * 마스터 강의 검색 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MasterLecture } from "@/lib/types/plan";
import type { MasterLectureFilters } from "@/lib/types/contentFilters";
import { logActionDebug } from "@/lib/logging/actionLogger";
import { buildContentQuery } from "@/lib/data/contentQueryBuilder";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";

/**
 * 강의 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterLectures(
  filters: MasterLectureFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterLecture[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<
    MasterLecture & { difficulty_levels?: Array<{ id: string; name: string }> | null }
  >(queryClient, "master_lectures", filters);

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterLecture;
  });

  logActionDebug(
    { domain: "data", action: "searchMasterLectures" },
    "마스터 강의 조회 완료",
    {
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        platform_id: filters.platform_id,
        difficulty: filters.difficulty,
        sort: filters.sort,
        tenantId: filters.tenantId,
        limit: filters.limit,
      },
      result: {
        count: enrichedData.length,
        total: result.total,
        titles: enrichedData.slice(0, 3).map((l) => l.title),
      },
    }
  );

  return {
    data: enrichedData,
    total: result.total,
  };
}
