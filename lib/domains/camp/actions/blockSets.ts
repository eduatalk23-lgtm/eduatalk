"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 템플릿에 블록 세트 연결 (기존 연결이 있으면 업데이트)
 */
async function _linkBlockSetToTemplate(
  templateId: string,
  blockSetId: string
): Promise<void> {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 템플릿 존재 및 권한 확인
  const { data: template } = await supabase
    .from("camp_templates")
    .select("id, tenant_id")
    .eq("id", templateId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!template) {
    throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // UPSERT: 기존 연결이 있으면 업데이트, 없으면 생성
  const { error } = await supabase
    .from("camp_template_block_sets")
    .upsert(
      {
        camp_template_id: templateId,
        tenant_block_set_id: blockSetId,
      },
      {
        onConflict: "camp_template_id",
      }
    );

  if (error) {
    throw new AppError(
      "블록 세트 연결에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  revalidatePath(`/admin/camp-templates/${templateId}/edit`);
  revalidatePath(`/admin/camp-templates/${templateId}`);
}

/**
 * 템플릿에서 블록 세트 연결 해제
 */
async function _unlinkBlockSetFromTemplate(templateId: string): Promise<void> {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 템플릿 존재 및 권한 확인
  const { data: template } = await supabase
    .from("camp_templates")
    .select("id, tenant_id")
    .eq("id", templateId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!template) {
    throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 연결 해제
  const { error } = await supabase
    .from("camp_template_block_sets")
    .delete()
    .eq("camp_template_id", templateId);

  if (error) {
    throw new AppError(
      "블록 세트 연결 해제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  revalidatePath(`/admin/camp-templates/${templateId}/edit`);
  revalidatePath(`/admin/camp-templates/${templateId}`);
}

/**
 * 특정 템플릿에 연결된 블록 세트 조회 (1개만 반환)
 */
async function _getTemplateBlockSet(templateId: string): Promise<{
  id: string;
  name: string;
  blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
} | null> {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 템플릿 존재 및 권한 확인
  const { data: template } = await supabase
    .from("camp_templates")
    .select("id, tenant_id")
    .eq("id", templateId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!template) {
    throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 연결된 블록 세트 조회
  const { data: link, error: linkError } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", templateId)
    .maybeSingle();

  if (linkError) {
    throw new AppError(
      "블록 세트 연결 정보를 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: linkError.message }
    );
  }

  if (!link) {
    return null;
  }

  // 블록 세트 정보 조회
  const { data: blockSet, error: blockSetError } = await supabase
    .from("tenant_block_sets")
    .select("id, name")
    .eq("id", link.tenant_block_set_id)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (blockSetError || !blockSet) {
    return null;
  }

  // 블록 조회
  const { data: blocks, error: blocksError } = await supabase
    .from("tenant_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("tenant_block_set_id", blockSet.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    logActionError(
      { domain: "camp", action: "getTemplateBlockSet" },
      blocksError,
      { blockSetId: blockSet.id }
    );
    return {
      id: blockSet.id,
      name: blockSet.name,
      blocks: [],
    };
  }

  return {
    id: blockSet.id,
    name: blockSet.name,
    blocks:
      (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
  };
}

/**
 * 특정 블록 세트를 사용하는 템플릿 목록 조회 (1:N 관계에서 N 방향)
 */
async function _getBlockSetTemplates(blockSetId: string): Promise<
  Array<{
    id: string;
    name: string;
    program_type: string;
  }>
> {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 연결된 템플릿 조회
  const { data: links, error: linksError } = await supabase
    .from("camp_template_block_sets")
    .select("camp_template_id")
    .eq("tenant_block_set_id", blockSetId);

  if (linksError) {
    throw new AppError(
      "템플릿 연결 정보를 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: linksError.message }
    );
  }

  if (!links || links.length === 0) {
    return [];
  }

  // 템플릿 정보 조회
  const templateIds = links.map((link) => link.camp_template_id);
  const { data: templates, error: templatesError } = await supabase
    .from("camp_templates")
    .select("id, name, program_type")
    .in("id", templateIds)
    .eq("tenant_id", tenantContext.tenantId);

  if (templatesError) {
    throw new AppError(
      "템플릿 정보를 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: templatesError.message }
    );
  }

  return (
    templates?.map((t) => ({
      id: t.id,
      name: t.name,
      program_type: t.program_type,
    })) ?? []
  );
}

// 에러 핸들링 래퍼 적용
export const linkBlockSetToTemplate = withErrorHandling(_linkBlockSetToTemplate);
export const unlinkBlockSetFromTemplate = withErrorHandling(_unlinkBlockSetFromTemplate);
export const getTemplateBlockSet = withErrorHandling(_getTemplateBlockSet);
export const getBlockSetTemplates = withErrorHandling(_getBlockSetTemplates);

