"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type {
  SlotTemplate,
  SlotTemplatePreset,
} from "@/lib/types/content-selection";

/**
 * 슬롯 템플릿 프리셋 목록 조회
 */
export const getSlotTemplatePresets = withErrorHandling(async () => {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(
      "관리자 권한이 필요합니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  const { data, error } = await supabase
    .from("slot_template_presets")
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new AppError(
      "프리셋 목록을 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  return { success: true, presets: data as SlotTemplatePreset[] };
});

/**
 * 슬롯 템플릿 프리셋 생성
 */
export const createSlotTemplatePreset = withErrorHandling(
  async (data: {
    name: string;
    description?: string;
    slot_templates: SlotTemplate[];
  }) => {
    const user = await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 이름 검증
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError(
        "프리셋 이름을 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (data.name.trim().length > 100) {
      throw new AppError(
        "프리셋 이름은 100자 이내로 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 슬롯 템플릿 검증
    if (!Array.isArray(data.slot_templates) || data.slot_templates.length === 0) {
      throw new AppError(
        "슬롯 템플릿이 비어있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (data.slot_templates.length > 9) {
      throw new AppError(
        "슬롯은 최대 9개까지 저장할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const insertData = {
      tenant_id: tenantContext.tenantId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      slot_templates: data.slot_templates,
      is_default: false,
      created_by: user.userId,
    };

    const { data: preset, error } = await supabase
      .from("slot_template_presets")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique_violation
        throw new AppError(
          "동일한 이름의 프리셋이 이미 존재합니다.",
          ErrorCode.DUPLICATE_ENTRY,
          409,
          true
        );
      }
      throw new AppError(
        "프리셋 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    revalidatePath("/admin/camp-templates");
    return { success: true, preset: preset as SlotTemplatePreset };
  }
);

/**
 * 슬롯 템플릿 프리셋 업데이트
 */
export const updateSlotTemplatePreset = withErrorHandling(
  async (
    presetId: string,
    data: {
      name?: string;
      description?: string;
      slot_templates?: SlotTemplate[];
    }
  ) => {
    await requireAdminOrConsultant();

    if (!presetId || typeof presetId !== "string") {
      throw new AppError(
        "프리셋 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 이름 검증 (제공된 경우)
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new AppError(
          "프리셋 이름을 입력해주세요.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
      if (data.name.trim().length > 100) {
        throw new AppError(
          "프리셋 이름은 100자 이내로 입력해주세요.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // 슬롯 템플릿 검증 (제공된 경우)
    if (data.slot_templates !== undefined) {
      if (!Array.isArray(data.slot_templates) || data.slot_templates.length === 0) {
        throw new AppError(
          "슬롯 템플릿이 비어있습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
      if (data.slot_templates.length > 9) {
        throw new AppError(
          "슬롯은 최대 9개까지 저장할 수 있습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.slot_templates !== undefined) {
      updateData.slot_templates = data.slot_templates;
    }

    const { error } = await supabase
      .from("slot_template_presets")
      .update(updateData)
      .eq("id", presetId)
      .eq("tenant_id", tenantContext.tenantId);

    if (error) {
      if (error.code === "23505") {
        throw new AppError(
          "동일한 이름의 프리셋이 이미 존재합니다.",
          ErrorCode.DUPLICATE_ENTRY,
          409,
          true
        );
      }
      throw new AppError(
        "프리셋 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    revalidatePath("/admin/camp-templates");
    return { success: true };
  }
);

/**
 * 슬롯 템플릿 프리셋 삭제
 */
export const deleteSlotTemplatePreset = withErrorHandling(
  async (presetId: string) => {
    await requireAdminOrConsultant();

    if (!presetId || typeof presetId !== "string") {
      throw new AppError(
        "프리셋 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const { error } = await supabase
      .from("slot_template_presets")
      .delete()
      .eq("id", presetId)
      .eq("tenant_id", tenantContext.tenantId);

    if (error) {
      throw new AppError(
        "프리셋 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    revalidatePath("/admin/camp-templates");
    return { success: true };
  }
);

/**
 * 기본 프리셋 설정
 */
export const setDefaultPreset = withErrorHandling(
  async (presetId: string) => {
    await requireAdminOrConsultant();

    if (!presetId || typeof presetId !== "string") {
      throw new AppError(
        "프리셋 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 트랜잭션: 기존 기본 프리셋 해제 후 새 프리셋 설정
    // 1. 기존 기본 프리셋 해제
    const { error: unsetError } = await supabase
      .from("slot_template_presets")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantContext.tenantId)
      .eq("is_default", true);

    if (unsetError) {
      throw new AppError(
        "기본 프리셋 해제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: unsetError.message }
      );
    }

    // 2. 새 프리셋을 기본으로 설정
    const { error: setError } = await supabase
      .from("slot_template_presets")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", presetId)
      .eq("tenant_id", tenantContext.tenantId);

    if (setError) {
      throw new AppError(
        "기본 프리셋 설정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: setError.message }
      );
    }

    revalidatePath("/admin/camp-templates");
    return { success: true };
  }
);
