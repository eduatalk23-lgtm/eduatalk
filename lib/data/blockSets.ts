/**
 * 블록 세트 데이터 액세스 레이어
 * 
 * 블록 세트와 블록 스케줄을 관리하는 함수들을 제공합니다.
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTypedQuery } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { SupabaseServerClient } from "@/lib/data/core/types";

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

// ============================================
// 블록 세트 CRUD 함수
// ============================================

/**
 * 블록 세트 타입 정의
 */
export type BlockSet = {
  id: string;
  tenant_id: string | null;
  student_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type BlockSchedule = {
  id: string;
  tenant_id: string | null;
  student_id: string;
  block_set_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
};

/**
 * 블록 세트 생성
 */
export async function createBlockSet(data: {
  tenant_id: string | null;
  student_id: string;
  name: string;
  description?: string | null;
  display_order?: number;
}): Promise<{ success: boolean; blockSetId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<{ id: string }>(
    async () => {
      return await supabase
        .from("student_block_sets")
        .insert({
          tenant_id: data.tenant_id,
          student_id: data.student_id,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          display_order: data.display_order ?? 0,
        })
        .select("id")
        .single();
    },
    {
      context: "[data/blockSets] createBlockSet",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      success: false,
      error: "블록 세트 생성에 실패했습니다.",
    };
  }

  return { success: true, blockSetId: result.id };
}

/**
 * 블록 세트 수정
 */
export async function updateBlockSet(
  blockSetId: string,
  studentId: string,
  updates: {
    name?: string;
    description?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_block_sets")
        .update(payload)
        .eq("id", blockSetId)
        .eq("student_id", studentId);
    },
    {
      context: "[data/blockSets] updateBlockSet",
      defaultValue: null,
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  return { success: true };
}

/**
 * 블록 세트 삭제
 */
export async function deleteBlockSet(
  blockSetId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_block_sets")
        .delete()
        .eq("id", blockSetId)
        .eq("student_id", studentId);
    },
    {
      context: "[data/blockSets] deleteBlockSet",
      defaultValue: null,
    }
  );

  // delete 쿼리는 data가 null이어도 성공일 수 있음
  return { success: true };
}

/**
 * 블록 세트 조회
 */
export async function getBlockSetById(
  blockSetId: string,
  studentId: string
): Promise<BlockSet | null> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<BlockSet>(
    async () => {
      return await supabase
        .from("student_block_sets")
        .select("*")
        .eq("id", blockSetId)
        .eq("student_id", studentId)
        .maybeSingle();
    },
    {
      context: "[data/blockSets] getBlockSetById",
      defaultValue: null,
    }
  );

  return result;
}

/**
 * 학생의 블록 세트 개수 조회
 */
export async function getBlockSetCount(studentId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("student_block_sets")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) {
    handleQueryError(error, {
      context: "[data/blockSets] getBlockSetCount",
    });
    return 0;
  }

  return count ?? 0;
}

// ============================================
// 블록 스케줄 CRUD 함수
// ============================================

/**
 * 블록 생성
 */
export async function createBlock(data: {
  tenant_id: string | null;
  student_id: string;
  block_set_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<{ success: boolean; blockId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<{ id: string }>(
    async () => {
      return await supabase
        .from("student_block_schedule")
        .insert({
          tenant_id: data.tenant_id,
          student_id: data.student_id,
          block_set_id: data.block_set_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
        })
        .select("id")
        .single();
    },
    {
      context: "[data/blockSets] createBlock",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      success: false,
      error: "블록 생성에 실패했습니다.",
    };
  }

  return { success: true, blockId: result.id };
}

/**
 * 블록 수정
 */
export async function updateBlock(
  blockId: string,
  studentId: string,
  updates: {
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  if (updates.day_of_week !== undefined) payload.day_of_week = updates.day_of_week;
  if (updates.start_time !== undefined) payload.start_time = updates.start_time;
  if (updates.end_time !== undefined) payload.end_time = updates.end_time;

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_block_schedule")
        .update(payload)
        .eq("id", blockId)
        .eq("student_id", studentId);
    },
    {
      context: "[data/blockSets] updateBlock",
      defaultValue: null,
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  return { success: true };
}

/**
 * 블록 삭제
 */
export async function deleteBlock(
  blockId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_block_schedule")
        .delete()
        .eq("id", blockId)
        .eq("student_id", studentId);
    },
    {
      context: "[data/blockSets] deleteBlock",
      defaultValue: null,
    }
  );

  // delete 쿼리는 data가 null이어도 성공일 수 있음
  return { success: true };
}

/**
 * 블록 조회
 */
export async function getBlockById(
  blockId: string,
  studentId: string
): Promise<BlockSchedule | null> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<BlockSchedule>(
    async () => {
      return await supabase
        .from("student_block_schedule")
        .select("*")
        .eq("id", blockId)
        .eq("student_id", studentId)
        .maybeSingle();
    },
    {
      context: "[data/blockSets] getBlockById",
      defaultValue: null,
    }
  );

  return result;
}

/**
 * 특정 세트의 블록 목록 조회
 */
export async function getBlocksBySetId(
  blockSetId: string,
  studentId: string,
  dayOfWeek?: number
): Promise<BlockSchedule[]> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<BlockSchedule[]>(
    async () => {
      let query = supabase
        .from("student_block_schedule")
        .select("*")
        .eq("block_set_id", blockSetId)
        .eq("student_id", studentId);

      if (dayOfWeek !== undefined) {
        query = query.eq("day_of_week", dayOfWeek);
      }

      return await query.order("day_of_week", { ascending: true }).order("start_time", { ascending: true });
    },
    {
      context: "[data/blockSets] getBlocksBySetId",
      defaultValue: [],
    }
  );

  return result ?? [];
}

