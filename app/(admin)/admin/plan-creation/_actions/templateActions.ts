"use server";

/**
 * 플랜 생성 템플릿 Server Actions
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type {
  PlanCreationTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateListFilter,
  TemplateSettings,
} from "../_types/templateTypes";
import type { CreationMethod } from "../_types";

// DB 행을 도메인 타입으로 변환
function mapRowToTemplate(row: Record<string, unknown>): PlanCreationTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: row.description as string | null,
    creationMethod: row.creation_method as CreationMethod,
    isDefault: row.is_default as boolean,
    settings: row.settings as TemplateSettings,
    createdBy: row.created_by as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * 템플릿 목록 조회
 */
export async function getTemplates(
  filter?: TemplateListFilter
): Promise<{ data: PlanCreationTemplate[] | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    let query = supabase
      .from("plan_creation_templates")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (filter?.creationMethod) {
      query = query.eq("creation_method", filter.creationMethod);
    }

    const { data, error } = await query;

    if (error) {
      console.error("템플릿 목록 조회 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: (data ?? []).map(mapRowToTemplate),
      error: null,
    };
  } catch (err) {
    console.error("템플릿 목록 조회 예외:", err);
    return { data: null, error: "템플릿 목록을 불러오는데 실패했습니다" };
  }
}

/**
 * 특정 템플릿 조회
 */
export async function getTemplate(
  id: string
): Promise<{ data: PlanCreationTemplate | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_creation_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("템플릿 조회 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToTemplate(data),
      error: null,
    };
  } catch (err) {
    console.error("템플릿 조회 예외:", err);
    return { data: null, error: "템플릿을 불러오는데 실패했습니다" };
  }
}

/**
 * 기본 템플릿 조회 (메서드별)
 */
export async function getDefaultTemplate(
  creationMethod: CreationMethod
): Promise<{ data: PlanCreationTemplate | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    const { data, error } = await supabase
      .from("plan_creation_templates")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .eq("creation_method", creationMethod)
      .eq("is_default", true)
      .maybeSingle();

    if (error) {
      console.error("기본 템플릿 조회 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: data ? mapRowToTemplate(data) : null,
      error: null,
    };
  } catch (err) {
    console.error("기본 템플릿 조회 예외:", err);
    return { data: null, error: "기본 템플릿을 불러오는데 실패했습니다" };
  }
}

/**
 * 템플릿 생성
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<{ data: PlanCreationTemplate | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: "로그인이 필요합니다" };
    }

    if (!user.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    // 기본 템플릿으로 설정하는 경우, 기존 기본 템플릿 해제
    if (input.isDefault) {
      await supabase
        .from("plan_creation_templates")
        .update({ is_default: false })
        .eq("tenant_id", user.tenantId)
        .eq("creation_method", input.creationMethod)
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("plan_creation_templates")
      .insert({
        tenant_id: user.tenantId,
        name: input.name,
        description: input.description ?? null,
        creation_method: input.creationMethod,
        is_default: input.isDefault ?? false,
        settings: input.settings,
        created_by: user.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("템플릿 생성 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToTemplate(data),
      error: null,
    };
  } catch (err) {
    console.error("템플릿 생성 예외:", err);
    return { data: null, error: "템플릿 생성에 실패했습니다" };
  }
}

/**
 * 템플릿 수정
 */
export async function updateTemplate(
  input: UpdateTemplateInput
): Promise<{ data: PlanCreationTemplate | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    // 기존 템플릿 조회
    const { data: existing, error: fetchError } = await supabase
      .from("plan_creation_templates")
      .select("*")
      .eq("id", input.id)
      .single();

    if (fetchError || !existing) {
      return { data: null, error: "템플릿을 찾을 수 없습니다" };
    }

    // 기본 템플릿으로 설정하는 경우, 기존 기본 템플릿 해제
    if (input.isDefault && !existing.is_default) {
      await supabase
        .from("plan_creation_templates")
        .update({ is_default: false })
        .eq("tenant_id", user.tenantId)
        .eq("creation_method", existing.creation_method)
        .eq("is_default", true);
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isDefault !== undefined) updateData.is_default = input.isDefault;
    if (input.settings !== undefined) {
      updateData.settings = { ...existing.settings, ...input.settings };
    }

    const { data, error } = await supabase
      .from("plan_creation_templates")
      .update(updateData)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error("템플릿 수정 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToTemplate(data),
      error: null,
    };
  } catch (err) {
    console.error("템플릿 수정 예외:", err);
    return { data: null, error: "템플릿 수정에 실패했습니다" };
  }
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplate(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("plan_creation_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("템플릿 삭제 오류:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("템플릿 삭제 예외:", err);
    return { success: false, error: "템플릿 삭제에 실패했습니다" };
  }
}

/**
 * 템플릿을 기본으로 설정
 */
export async function setDefaultTemplate(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    // 템플릿 정보 조회
    const { data: template, error: fetchError } = await supabase
      .from("plan_creation_templates")
      .select("creation_method")
      .eq("id", id)
      .single();

    if (fetchError || !template) {
      return { success: false, error: "템플릿을 찾을 수 없습니다" };
    }

    // 기존 기본 템플릿 해제
    await supabase
      .from("plan_creation_templates")
      .update({ is_default: false })
      .eq("tenant_id", user.tenantId)
      .eq("creation_method", template.creation_method)
      .eq("is_default", true);

    // 새 기본 템플릿 설정
    const { error } = await supabase
      .from("plan_creation_templates")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      console.error("기본 템플릿 설정 오류:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("기본 템플릿 설정 예외:", err);
    return { success: false, error: "기본 템플릿 설정에 실패했습니다" };
  }
}
