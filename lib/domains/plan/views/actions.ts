"use server";

/**
 * 플랜 뷰 관련 서버 액션
 *
 * 뷰 설정 저장, 불러오기, 삭제 등을 처리합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";
import type {
  ViewType,
  ViewSettings,
  MatrixTimeSlot,
  PlanView,
} from "@/lib/types/plan/views";

// ============================================
// 시간 슬롯 액션
// ============================================

/**
 * 테넌트의 시간 슬롯 목록을 조회합니다.
 */
export async function getTimeSlots(): Promise<{
  success: boolean;
  data?: MatrixTimeSlot[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || !user.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .eq("is_active", true)
      .order("slot_order", { ascending: true });

    if (error) {
      console.error("Get time slots error:", error);
      return { success: false, error: error.message };
    }

    const slots: MatrixTimeSlot[] = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      order: row.slot_order,
      type: row.slot_type as MatrixTimeSlot["type"],
      color: row.color ?? undefined,
      isDefault: row.is_default ?? false,
      isActive: row.is_active ?? true,
    }));

    return { success: true, data: slots };
  } catch (error) {
    console.error("Get time slots error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 기본 시간 슬롯을 생성합니다. (관리자 전용)
 */
export async function createDefaultTimeSlots(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== "admin" || !user.tenantId) {
    return { success: false, error: "Admin only" };
  }

  try {
    const { error } = await supabase.rpc("create_default_time_slots", {
      p_tenant_id: user.tenantId,
    });

    if (error) {
      console.error("Create default time slots error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/plan");
    return { success: true };
  } catch (error) {
    console.error("Create default time slots error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

// ============================================
// 뷰 설정 액션
// ============================================

/**
 * 학생의 저장된 뷰 목록을 조회합니다.
 */
export async function getSavedViews(): Promise<{
  success: boolean;
  data?: PlanView[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 학생 ID 조회
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", user.userId)
      .single();

    if (!student) {
      return { success: true, data: [] }; // 학생이 아닌 경우 빈 배열
    }

    const { data, error } = await supabase
      .from("plan_views")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get saved views error:", error);
      return { success: false, error: error.message };
    }

    const views: PlanView[] = (data || []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      tenantId: row.tenant_id,
      name: row.name,
      viewType: row.view_type as ViewType,
      settings: (row.settings as ViewSettings) || {},
      isDefault: row.is_default ?? false,
      createdAt: new Date(row.created_at!),
      updatedAt: new Date(row.updated_at!),
    }));

    return { success: true, data: views };
  } catch (error) {
    console.error("Get saved views error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 뷰 설정을 저장합니다.
 */
export async function saveView(input: {
  name: string;
  viewType: ViewType;
  settings: ViewSettings;
  isDefault?: boolean;
}): Promise<{
  success: boolean;
  data?: PlanView;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || !user.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 학생 ID 조회
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", user.userId)
      .single();

    if (!student) {
      return { success: false, error: "Student not found" };
    }

    // 기본 뷰로 설정하는 경우, 기존 기본 뷰 해제
    if (input.isDefault) {
      await supabase
        .from("plan_views")
        .update({ is_default: false })
        .eq("student_id", student.id)
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("plan_views")
      .insert({
        student_id: student.id,
        tenant_id: user.tenantId,
        name: input.name,
        view_type: input.viewType,
        settings: input.settings as unknown as Record<string, unknown>,
        is_default: input.isDefault ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("Save view error:", error);
      return { success: false, error: error.message };
    }

    const view: PlanView = {
      id: data.id,
      studentId: data.student_id,
      tenantId: data.tenant_id,
      name: data.name,
      viewType: data.view_type as ViewType,
      settings: (data.settings as ViewSettings) || {},
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at!),
      updatedAt: new Date(data.updated_at!),
    };

    revalidatePath("/plan");
    return { success: true, data: view };
  } catch (error) {
    console.error("Save view error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 뷰 설정을 업데이트합니다.
 */
export async function updateView(
  viewId: string,
  updates: Partial<{
    name: string;
    settings: ViewSettings;
    isDefault: boolean;
  }>
): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 기본 뷰로 설정하는 경우
    if (updates.isDefault) {
      const { data: view } = await supabase
        .from("plan_views")
        .select("student_id")
        .eq("id", viewId)
        .single();

      if (view) {
        await supabase
          .from("plan_views")
          .update({ is_default: false })
          .eq("student_id", view.student_id)
          .eq("is_default", true);
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.settings !== undefined) updateData.settings = updates.settings;
    if (updates.isDefault !== undefined)
      updateData.is_default = updates.isDefault;

    const { error } = await supabase
      .from("plan_views")
      .update(updateData)
      .eq("id", viewId);

    if (error) {
      console.error("Update view error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/plan");
    return { success: true };
  } catch (error) {
    console.error("Update view error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 뷰를 삭제합니다.
 */
export async function deleteView(viewId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { error } = await supabase
      .from("plan_views")
      .delete()
      .eq("id", viewId);

    if (error) {
      console.error("Delete view error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/plan");
    return { success: true };
  } catch (error) {
    console.error("Delete view error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 기본 뷰를 가져옵니다.
 */
export async function getDefaultView(): Promise<{
  success: boolean;
  data?: PlanView | null;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", user.userId)
      .single();

    if (!student) {
      return { success: true, data: null };
    }

    const { data, error } = await supabase
      .from("plan_views")
      .select("*")
      .eq("student_id", student.id)
      .eq("is_default", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = not found
      console.error("Get default view error:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: true, data: null };
    }

    const view: PlanView = {
      id: data.id,
      studentId: data.student_id,
      tenantId: data.tenant_id,
      name: data.name,
      viewType: data.view_type as ViewType,
      settings: (data.settings as ViewSettings) || {},
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at!),
      updatedAt: new Date(data.updated_at!),
    };

    return { success: true, data: view };
  } catch (error) {
    console.error("Get default view error:", error);
    return { success: false, error: "Unexpected error" };
  }
}
