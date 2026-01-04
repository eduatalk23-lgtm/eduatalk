"use server";

/**
 * Admin 블록셋 조회 Server Action
 *
 * Admin이 특정 학생의 블록셋을 조회할 때 사용합니다.
 *
 * @module lib/domains/admin-plan/actions/blockSets
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
 * 특정 학생의 블록셋 목록을 조회합니다 (Admin용)
 *
 * @param studentId 학생 ID
 * @returns 블록셋 목록
 */
export async function getBlockSetsForStudent(
  studentId: string
): Promise<BlockSetWithBlocks[]> {
  const user = await getCurrentUser();
  if (!user) {
    console.error("[admin-plan/blockSets] 로그인 필요");
    return [];
  }

  // Admin 권한 검증
  if (user.role !== "admin" && user.role !== "consultant") {
    console.error("[admin-plan/blockSets] 권한 없음:", user.role);
    return [];
  }

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
    console.error("[admin-plan/blockSets] 블록 세트 조회 실패:", setsError);
    return [];
  }

  if (blocksError) {
    console.error("[admin-plan/blockSets] 블록 조회 실패:", blocksError);
    // 블록 조회 실패 시 빈 블록 배열로 처리
  }

  if (!blockSetsData || blockSetsData.length === 0) {
    return [];
  }

  // 블록을 block_set_id로 그룹화
  const blocksBySetId = new Map<
    string,
    Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>
  >();

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
