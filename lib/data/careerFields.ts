import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

  const { data, error } = await supabase
    .from("career_fields")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[data/careerFields] 진로 계열 조회 실패", error);
    return [];
  }

  return (data as CareerField[]) ?? [];
}

/**
 * 진로 계열 목록 조회 (모든 항목, 관리자용)
 */
export async function getAllCareerFields(): Promise<CareerField[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("career_fields")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[data/careerFields] 진로 계열 전체 조회 실패", error);
    return [];
  }

  return (data as CareerField[]) ?? [];
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

  const { data, error } = await supabase
    .from("career_fields")
    .insert({
      name: name.trim(),
      display_order: order,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data/careerFields] 진로 계열 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
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

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.display_order !== undefined) payload.display_order = updates.display_order;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error } = await supabase
    .from("career_fields")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("[data/careerFields] 진로 계열 수정 실패", error);
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
    console.error("[data/careerFields] 진로 계열 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}









