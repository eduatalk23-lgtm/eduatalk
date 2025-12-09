/**
 * 논리 플랜 아이템 데이터 액세스 레이어
 * @module lib/data/planGroupItems
 * @see docs/refactoring/03_phase_todo_list.md [P2-4]
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanGroupItem, PlanGroupItemInput } from "@/lib/types/plan";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// ============================================
// CRUD 함수
// ============================================

/**
 * 플랜 그룹의 논리 플랜 아이템 목록 조회
 */
export async function getPlanGroupItems(
  planGroupId: string,
  tenantId?: string | null
): Promise<PlanGroupItem[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_group_items")
    .select(
      "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,target_start_page_or_time,target_end_page_or_time,repeat_count,split_strategy,is_review,is_required,priority,display_order,metadata,created_at,updated_at"
    )
    .eq("plan_group_id", planGroupId)
    .order("display_order", { ascending: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[data/planGroupItems] 조회 실패", {
      planGroupId,
      tenantId,
      error,
    });
    return [];
  }

  return (data as PlanGroupItem[]) ?? [];
}

/**
 * 단일 논리 플랜 아이템 조회
 */
export async function getPlanGroupItemById(
  itemId: string,
  tenantId?: string | null
): Promise<PlanGroupItem | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_group_items")
    .select(
      "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,target_start_page_or_time,target_end_page_or_time,repeat_count,split_strategy,is_review,is_required,priority,display_order,metadata,created_at,updated_at"
    )
    .eq("id", itemId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[data/planGroupItems] 단일 조회 실패", {
      itemId,
      tenantId,
      error,
    });
    return null;
  }

  return (data as PlanGroupItem | null) ?? null;
}

/**
 * 논리 플랜 아이템 생성
 */
export async function createPlanGroupItem(
  planGroupId: string,
  tenantId: string,
  input: PlanGroupItemInput
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: tenantId,
    plan_group_id: planGroupId,
    content_type: input.content_type,
    content_id: input.content_id,
    master_content_id: input.master_content_id ?? null,
    target_start_page_or_time: input.target_start_page_or_time,
    target_end_page_or_time: input.target_end_page_or_time,
    repeat_count: input.repeat_count ?? 1,
    split_strategy: input.split_strategy ?? "equal",
    is_review: input.is_review ?? false,
    is_required: input.is_required ?? true,
    priority: input.priority ?? 0,
    display_order: input.display_order ?? 0,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("plan_group_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[data/planGroupItems] 생성 실패", {
      planGroupId,
      tenantId,
      error,
    });
    return { success: false, error: error.message };
  }

  return { success: true, itemId: data?.id };
}

/**
 * 논리 플랜 아이템 일괄 생성
 */
export async function createPlanGroupItems(
  planGroupId: string,
  tenantId: string,
  inputs: PlanGroupItemInput[]
): Promise<{ success: boolean; itemIds?: string[]; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (inputs.length === 0) {
    return { success: true, itemIds: [] };
  }

  const payloads = inputs.map((input, index) => ({
    tenant_id: tenantId,
    plan_group_id: planGroupId,
    content_type: input.content_type,
    content_id: input.content_id,
    master_content_id: input.master_content_id ?? null,
    target_start_page_or_time: input.target_start_page_or_time,
    target_end_page_or_time: input.target_end_page_or_time,
    repeat_count: input.repeat_count ?? 1,
    split_strategy: input.split_strategy ?? "equal",
    is_review: input.is_review ?? false,
    is_required: input.is_required ?? true,
    priority: input.priority ?? 0,
    display_order: input.display_order ?? index,
    metadata: input.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from("plan_group_items")
    .insert(payloads)
    .select("id");

  if (error) {
    console.error("[data/planGroupItems] 일괄 생성 실패", {
      planGroupId,
      tenantId,
      count: inputs.length,
      error,
    });
    return { success: false, error: error.message };
  }

  return { success: true, itemIds: data?.map((d) => d.id) ?? [] };
}

/**
 * 논리 플랜 아이템 업데이트
 */
export async function updatePlanGroupItem(
  itemId: string,
  updates: Partial<PlanGroupItemInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  if (updates.content_type !== undefined)
    payload.content_type = updates.content_type;
  if (updates.content_id !== undefined) payload.content_id = updates.content_id;
  if (updates.master_content_id !== undefined)
    payload.master_content_id = updates.master_content_id;
  if (updates.target_start_page_or_time !== undefined)
    payload.target_start_page_or_time = updates.target_start_page_or_time;
  if (updates.target_end_page_or_time !== undefined)
    payload.target_end_page_or_time = updates.target_end_page_or_time;
  if (updates.repeat_count !== undefined)
    payload.repeat_count = updates.repeat_count;
  if (updates.split_strategy !== undefined)
    payload.split_strategy = updates.split_strategy;
  if (updates.is_review !== undefined) payload.is_review = updates.is_review;
  if (updates.is_required !== undefined)
    payload.is_required = updates.is_required;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.display_order !== undefined)
    payload.display_order = updates.display_order;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  if (Object.keys(payload).length === 0) {
    return { success: true }; // 업데이트할 내용 없음
  }

  const { error } = await supabase
    .from("plan_group_items")
    .update(payload)
    .eq("id", itemId);

  if (error) {
    console.error("[data/planGroupItems] 업데이트 실패", {
      itemId,
      updates: Object.keys(payload),
      error,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 논리 플랜 아이템 삭제
 */
export async function deletePlanGroupItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_group_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("[data/planGroupItems] 삭제 실패", {
      itemId,
      error,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹의 모든 논리 플랜 아이템 삭제
 */
export async function deletePlanGroupItemsByGroupId(
  planGroupId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 삭제 전 카운트 조회
  const { count } = await supabase
    .from("plan_group_items")
    .select("id", { count: "exact", head: true })
    .eq("plan_group_id", planGroupId);

  const { error } = await supabase
    .from("plan_group_items")
    .delete()
    .eq("plan_group_id", planGroupId);

  if (error) {
    console.error("[data/planGroupItems] 그룹별 삭제 실패", {
      planGroupId,
      error,
    });
    return { success: false, error: error.message };
  }

  return { success: true, deletedCount: count ?? 0 };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * plan_contents를 plan_group_items로 변환 (마이그레이션 용도)
 * 기존 plan_contents 데이터를 plan_group_items 형식으로 변환
 */
export function convertPlanContentToGroupItem(
  planContent: {
    content_type: string;
    content_id: string;
    master_content_id?: string | null;
    start_range: number;
    end_range: number;
    display_order?: number;
  },
  options?: {
    repeat_count?: number;
    is_review?: boolean;
    priority?: number;
  }
): PlanGroupItemInput {
  return {
    content_type: planContent.content_type as "book" | "lecture" | "custom",
    content_id: planContent.content_id,
    master_content_id: planContent.master_content_id,
    target_start_page_or_time: planContent.start_range,
    target_end_page_or_time: planContent.end_range,
    repeat_count: options?.repeat_count ?? 1,
    split_strategy: "equal",
    is_review: options?.is_review ?? false,
    is_required: true,
    priority: options?.priority ?? 0,
    display_order: planContent.display_order ?? 0,
  };
}

