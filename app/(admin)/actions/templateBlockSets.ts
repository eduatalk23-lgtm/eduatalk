"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { blockSchema, validateFormData } from "@/lib/validation/schemas";

/**
 * 템플릿 블록 세트 생성
 */
async function _createTemplateBlockSet(formData: FormData): Promise<{ blockSetId: string; name: string }> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const templateId = formData.get("template_id");
  const name = formData.get("name");
  const description = formData.get("description");

  // template_id는 선택적 (템플릿 없이도 생성 가능)
  const templateIdValue = templateId && typeof templateId === "string" ? templateId : null;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 템플릿이 제공된 경우 존재 및 권한 확인
  if (templateIdValue) {
    const { data: template } = await supabase
      .from("camp_templates")
      .select("id, tenant_id")
      .eq("id", templateIdValue)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (!template) {
      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }
  }

  // 중복 이름 확인 (같은 템플릿 내에서만, 템플릿이 없으면 tenant_id 기준)
  const existingSetQuery = supabase
    .from("template_block_sets")
    .select("id")
    .eq("name", name.trim())
    .eq("tenant_id", tenantContext.tenantId);

  if (templateIdValue) {
    existingSetQuery.eq("template_id", templateIdValue);
  } else {
    existingSetQuery.is("template_id", null);
  }

  const { data: existingSet } = await existingSetQuery.maybeSingle();

  if (existingSet) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const { data: newSet, error } = await supabase
    .from("template_block_sets")
    .insert({
      template_id: templateIdValue,
      tenant_id: tenantContext.tenantId,
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
    })
    .select("id, name")
    .single();

  if (error) {
    throw new AppError(
      "블록 세트 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (!newSet) {
    throw new AppError("블록 세트 생성에 실패했습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 템플릿이 있는 경우에만 템플릿 편집 페이지 revalidate
  if (templateIdValue) {
    revalidatePath(`/admin/camp-templates/${templateIdValue}/edit`);
  }
  revalidatePath("/admin/time-management");
  return { blockSetId: newSet.id, name: newSet.name };
}

/**
 * 템플릿 블록 세트 수정
 */
async function _updateTemplateBlockSet(formData: FormData): Promise<void> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const setId = formData.get("id");
  const name = formData.get("name");
  const description = formData.get("description");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 세트 존재 및 권한 확인
  const { data: existingSet } = await supabase
    .from("template_block_sets")
    .select("id, template_id, name")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 이름 변경 시 중복 확인 (자기 자신 제외)
  if (existingSet.name !== name.trim()) {
    const { data: duplicateSet } = await supabase
      .from("template_block_sets")
      .select("id")
      .eq("template_id", existingSet.template_id)
      .eq("name", name.trim())
      .neq("id", setId)
      .maybeSingle();

    if (duplicateSet) {
      throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  const { error } = await supabase
    .from("template_block_sets")
    .update({
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
    })
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    throw new AppError(
      "블록 세트 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (existingSet.template_id) {
    revalidatePath(`/admin/camp-templates/${existingSet.template_id}/edit`);
  }
  revalidatePath("/admin/time-management");
}

/**
 * 템플릿 블록 세트 삭제
 */
async function _deleteTemplateBlockSet(formData: FormData): Promise<void> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const setId = formData.get("id");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 세트 존재 및 권한 확인
  const { data: existingSet } = await supabase
    .from("template_block_sets")
    .select("id, template_id")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // CASCADE로 블록도 함께 삭제됨
  const { error } = await supabase
    .from("template_block_sets")
    .delete()
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    throw new AppError(
      "블록 세트 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (existingSet.template_id) {
    revalidatePath(`/admin/camp-templates/${existingSet.template_id}/edit`);
  }
  revalidatePath("/admin/time-management");
}

/**
 * 템플릿 블록 세트 목록 조회
 * templateId가 null이면 템플릿에 연결되지 않은 블록 세트만 조회
 */
async function _getTemplateBlockSets(templateId: string | null = null): Promise<
  Array<{
    id: string;
    name: string;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }>
> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // templateId가 제공된 경우 템플릿 존재 및 권한 확인
  if (templateId) {
    const { data: template } = await supabase
      .from("camp_templates")
      .select("id")
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (!template) {
      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }
  }

  // templateId가 있으면 해당 템플릿의 블록 세트, 없으면 템플릿에 연결되지 않은 블록 세트 조회
  const blockSetsQuery = supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: true });

  if (templateId) {
    blockSetsQuery.eq("template_id", templateId);
  } else {
    blockSetsQuery.is("template_id", null);
  }

  const { data: blockSets, error: setsError } = await blockSetsQuery;

  if (setsError) {
    throw new AppError(
      "블록 세트 목록을 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: setsError.message }
    );
  }

  if (!blockSets || blockSets.length === 0) {
    return [];
  }

  // 각 블록 세트의 시간 블록 조회
  const blockSetsWithBlocks = await Promise.all(
    blockSets.map(async (set) => {
      const { data: blocks, error: blocksError } = await supabase
        .from("template_blocks")
        .select("id, day_of_week, start_time, end_time")
        .eq("template_block_set_id", set.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error(`[templateBlockSets] 블록 조회 실패 (세트 ${set.id}):`, blocksError);
        return { ...set, blocks: [] };
      }

      return {
        ...set,
        blocks:
          (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
      };
    })
  );

  return blockSetsWithBlocks;
}

/**
 * 템플릿 블록 추가
 */
async function _addTemplateBlock(formData: FormData): Promise<void> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, blockSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message || "입력값이 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { day, start_time: startTime, end_time: endTime } = validation.data;
  const blockSetId = formData.get("block_set_id");

  if (!blockSetId || typeof blockSetId !== "string") {
    throw new AppError("블록 세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("template_block_sets")
    .select("id, template_id")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 중복 블록 확인
  const { data: existingBlock } = await supabase
    .from("template_blocks")
    .select("id")
    .eq("template_block_set_id", blockSetId)
    .eq("day_of_week", day)
    .eq("start_time", startTime)
    .eq("end_time", endTime)
    .maybeSingle();

  if (existingBlock) {
    throw new AppError("이미 같은 시간 블록이 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const { error } = await supabase.from("template_blocks").insert({
    template_block_set_id: blockSetId,
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    throw new AppError(
      "블록 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  revalidatePath(`/admin/camp-templates/${blockSet.template_id}/edit`);
}

/**
 * 템플릿 블록 삭제
 */
async function _deleteTemplateBlock(formData: FormData): Promise<void> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const blockId = formData.get("id");

  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 블록 존재 확인
  const { data: block } = await supabase
    .from("template_blocks")
    .select("id, template_block_set_id")
    .eq("id", blockId)
    .single();

  if (!block) {
    throw new AppError("블록을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("template_block_sets")
    .select("template_id, tenant_id")
    .eq("id", block.template_block_set_id)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  if (blockSet.tenant_id !== tenantContext.tenantId) {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const { error } = await supabase.from("template_blocks").delete().eq("id", blockId);

  if (error) {
    throw new AppError(
      "블록 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (blockSet.template_id) {
    revalidatePath(`/admin/camp-templates/${blockSet.template_id}/edit`);
  }
  revalidatePath("/admin/time-management");
}

/**
 * 템플릿에 연결되지 않은 블록 세트 목록 조회 (전체 조회)
 */
async function _getAllTemplateBlockSets(): Promise<
  Array<{
    id: string;
    name: string;
    template_id: string | null;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }>
> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  const { data: blockSets, error: setsError } = await supabase
    .from("template_block_sets")
    .select("id, name, template_id")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: true });

  if (setsError) {
    throw new AppError(
      "블록 세트 목록을 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: setsError.message }
    );
  }

  if (!blockSets || blockSets.length === 0) {
    return [];
  }

  // 각 블록 세트의 시간 블록 조회
  const blockSetsWithBlocks = await Promise.all(
    blockSets.map(async (set) => {
      const { data: blocks, error: blocksError } = await supabase
        .from("template_blocks")
        .select("id, day_of_week, start_time, end_time")
        .eq("template_block_set_id", set.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error(`[templateBlockSets] 블록 조회 실패 (세트 ${set.id}):`, blocksError);
        return { ...set, blocks: [] };
      }

      return {
        ...set,
        blocks:
          (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
      };
    })
  );

  return blockSetsWithBlocks;
}

// 에러 핸들링 래퍼 적용
export const createTemplateBlockSet = withErrorHandling(_createTemplateBlockSet);
export const updateTemplateBlockSet = withErrorHandling(_updateTemplateBlockSet);
export const deleteTemplateBlockSet = withErrorHandling(_deleteTemplateBlockSet);
export const getTemplateBlockSets = withErrorHandling(_getTemplateBlockSets);
export const getAllTemplateBlockSets = withErrorHandling(_getAllTemplateBlockSets);
export const addTemplateBlock = withErrorHandling(_addTemplateBlock);
export const deleteTemplateBlock = withErrorHandling(_deleteTemplateBlock);

