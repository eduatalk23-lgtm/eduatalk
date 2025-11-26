/**
 * 블록 세트 데이터 액세스 레이어
 * 서버 컴포넌트에서 사용하는 블록 세트 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type BlockSetWithBlocks = {
  id: string;
  name: string;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

/**
 * 학생의 블록 세트 목록을 조회하고 각 세트의 블록 정보를 포함하여 반환
 * 
 * @param studentId 학생 ID
 * @returns 블록 세트 목록 (각 세트에 블록 정보 포함)
 */
export async function fetchBlockSetsWithBlocks(
  studentId: string
): Promise<BlockSetWithBlocks[]> {
  const supabase = await createSupabaseServerClient();

  // 블록 세트 목록 조회
  const { data: blockSetsData, error: setsError } = await supabase
    .from("student_block_sets")
    .select("id, name")
    .eq("student_id", studentId)
    .order("display_order", { ascending: true });

  if (setsError) {
    console.error("[blockSets] 블록 세트 조회 실패:", setsError);
    return [];
  }

  if (!blockSetsData || blockSetsData.length === 0) {
    return [];
  }

  // 각 블록 세트의 시간 블록 조회
  const blockSets = await Promise.all(
    blockSetsData.map(async (set) => {
      const { data: blocks, error: blocksError } = await supabase
        .from("student_block_schedule")
        .select("id, day_of_week, start_time, end_time")
        .eq("block_set_id", set.id)
        .eq("student_id", studentId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error(`[blockSets] 블록 조회 실패 (세트 ${set.id}):`, blocksError);
        return {
          ...set,
          blocks: [],
        };
      }

      return {
        ...set,
        blocks:
          (blocks as Array<{
            id: string;
            day_of_week: number;
            start_time: string;
            end_time: string;
          }>) ?? [],
      };
    })
  );

  return blockSets;
}

