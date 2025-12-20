import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";

export type CareerField = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 진로 계열 목록 조회 (활성화된 항목만, display_order 순)
 */
export async function getCareerFields(): Promise<CareerField[]> {
  const supabase = await createSupabaseServerClient();

  return await createTypedQuery<CareerField[]>(
    async () => {
      const queryResult = await supabase
        .from("career_fields")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      return {
        data: queryResult.data as CareerField[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/careerFields] getCareerFields",
      defaultValue: [],
    }
  ) ?? [];
}

/**
 * 진로 계열 목록 조회 (모든 항목, 관리자용)
 */
export async function getAllCareerFields(): Promise<CareerField[]> {
  const supabase = await createSupabaseServerClient();

  return await createTypedQuery<CareerField[]>(
    async () => {
      const queryResult = await supabase
        .from("career_fields")
        .select("*")
        .order("display_order", { ascending: true });

      return {
        data: queryResult.data as CareerField[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/careerFields] getAllCareerFields",
      defaultValue: [],
    }
  ) ?? [];
}

/**
 * 진로 계열 생성
 */
export async function createCareerField(
  name: string,
  displayOrder?: number
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // display_order가 없으면 기존 최대값 + 1
  let order = displayOrder;
  if (order === undefined) {
    const existing = await getAllCareerFields();
    order = existing.length > 0
      ? Math.max(...existing.map(f => f.display_order)) + 1
      : 0;
  }

  const result = await createTypedSingleQuery<{ id: string }>(
    async () => {
      const queryResult = await supabase
        .from("career_fields")
        .insert({
          name: name.trim(),
          display_order: order,
          is_active: true,
        })
        .select("id")
        .single();

      return {
        data: queryResult.data ? [queryResult.data] : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/careerFields] createCareerField",
      defaultValue: null,
    }
  );

  if (!result) {
    return { success: false, error: "진로 계열 생성 실패" };
  }

  return { success: true, id: result.id };
}

/**
 * 진로 계열 수정
 */
export async function updateCareerField(
  id: string,
  updates: Partial<{
    name: string;
    display_order: number;
    is_active: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, string | number | boolean> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.display_order !== undefined) payload.display_order = updates.display_order;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error } = await supabase
    .from("career_fields")
    .update(payload)
    .eq("id", id);

  if (error) {
    handleQueryError(error, {
      context: "[data/careerFields] updateCareerField",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 진로 계열 삭제
 */
export async function deleteCareerField(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 실제 삭제 대신 is_active = false로 설정 (소프트 삭제)
  const { error } = await supabase
    .from("career_fields")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    handleQueryError(error, {
      context: "[data/careerFields] deleteCareerField",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}









