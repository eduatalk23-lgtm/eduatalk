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
 * 최적화: N+1 문제를 해결하기 위해 블록 세트와 블록을 병렬로 조회한 후 JavaScript에서 그룹화
 * 
 * @param studentId 학생 ID
 * @returns 블록 세트 목록 (각 세트에 블록 정보 포함)
 */
export async function fetchBlockSetsWithBlocks(
  studentId: string
): Promise<BlockSetWithBlocks[]> {
  const supabase = await createSupabaseServerClient();

  // 블록 세트 목록과 모든 블록을 병렬로 조회 (N+1 문제 해결)
  const [blockSetsResult, blocksResult] = await Promise.all([
    supabase
      .from("student_block_sets")
      .select("id, name")
      .eq("student_id", studentId)
      .order("display_order", { ascending: true }),
    supabase
      .from("student_block_schedule")
      .select("id, block_set_id, day_of_week, start_time, end_time")
      .eq("student_id", studentId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  const { data: blockSetsData, error: setsError } = blockSetsResult;
  const { data: allBlocks, error: blocksError } = blocksResult;

  if (setsError) {
    console.error("[blockSets] 블록 세트 조회 실패:", setsError);
    return [];
  }

  if (blocksError) {
    console.error("[blockSets] 블록 조회 실패:", blocksError);
    // 블록 조회 실패 시 빈 블록 배열로 처리
  }

  if (!blockSetsData || blockSetsData.length === 0) {
    return [];
  }

  // 블록을 block_set_id로 그룹화
  const blocksBySetId = new Map<string, Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>>();

  if (allBlocks) {
    for (const block of allBlocks) {
      if (!block.block_set_id) continue;
      
      if (!blocksBySetId.has(block.block_set_id)) {
        blocksBySetId.set(block.block_set_id, []);
      }
      
      blocksBySetId.get(block.block_set_id)!.push({
        id: block.id,
        day_of_week: block.day_of_week,
        start_time: block.start_time,
        end_time: block.end_time,
      });
    }
  }

  // 블록 세트에 블록 정보 매핑
  return blockSetsData.map((set) => ({
    id: set.id,
    name: set.name,
    blocks: blocksBySetId.get(set.id) ?? [],
  }));
}

