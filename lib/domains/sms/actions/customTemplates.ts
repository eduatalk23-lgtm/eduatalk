"use server";

/**
 * 커스텀 SMS 템플릿 CRUD 액션
 */

import { requireAdmin as requireAdminAuth } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import { extractTemplateVariables } from "../utils/templateSubstitution";
import type {
  SMSCustomTemplate,
  CreateCustomTemplateInput,
  UpdateCustomTemplateInput,
  SMSLogEntry,
} from "../types";

// ── 커스텀 템플릿 CRUD ──

async function _listCustomTemplates(options?: {
  category?: string;
  activeOnly?: boolean;
}): Promise<SMSCustomTemplate[]> {
  await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("sms_custom_templates")
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("템플릿 목록 조회 실패", ErrorCode.DATABASE_ERROR, 500, true);
  }

  return (data ?? []) as SMSCustomTemplate[];
}

export const listCustomTemplates = withActionResponse(_listCustomTemplates);

async function _createCustomTemplate(
  input: CreateCustomTemplateInput
): Promise<SMSCustomTemplate> {
  const { userId } = await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  if (!input.name.trim()) {
    throw new AppError("템플릿 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }
  if (!input.content.trim()) {
    throw new AppError("템플릿 내용을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const variables = extractTemplateVariables(input.content);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sms_custom_templates")
    .insert({
      tenant_id: tenantContext.tenantId,
      name: input.name.trim(),
      content: input.content,
      category: input.category ?? "general",
      variables,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new AppError("템플릿 생성 실패", ErrorCode.DATABASE_ERROR, 500, true);
  }

  return data as SMSCustomTemplate;
}

export const createCustomTemplate = withActionResponse(_createCustomTemplate);

async function _updateCustomTemplate(
  id: string,
  input: UpdateCustomTemplateInput
): Promise<SMSCustomTemplate> {
  await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const updatePayload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new AppError("템플릿 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
    updatePayload.name = input.name.trim();
  }

  if (input.content !== undefined) {
    if (!input.content.trim()) {
      throw new AppError("템플릿 내용을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
    updatePayload.content = input.content;
    updatePayload.variables = extractTemplateVariables(input.content);
  }

  if (input.category !== undefined) {
    updatePayload.category = input.category;
  }

  if (input.is_active !== undefined) {
    updatePayload.is_active = input.is_active;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sms_custom_templates")
    .update(updatePayload)
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .select()
    .single();

  if (error) {
    throw new AppError("템플릿 수정 실패", ErrorCode.DATABASE_ERROR, 500, true);
  }

  return data as SMSCustomTemplate;
}

export const updateCustomTemplate = withActionResponse(_updateCustomTemplate);

async function _deleteCustomTemplate(id: string): Promise<void> {
  await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // soft delete
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("sms_custom_templates")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    throw new AppError("템플릿 삭제 실패", ErrorCode.DATABASE_ERROR, 500, true);
  }
}

export const deleteCustomTemplate = withActionResponse(_deleteCustomTemplate);

// ── 학생 SMS 발송 이력 조회 ──

async function _getStudentSMSHistory(
  studentId: string,
  limit = 20
): Promise<SMSLogEntry[]> {
  await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sms_logs")
    .select("id, recipient_phone, message_content, status, channel, created_at, sent_at")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("recipient_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError("발송 이력 조회 실패", ErrorCode.DATABASE_ERROR, 500, true);
  }

  return (data ?? []) as SMSLogEntry[];
}

export const getStudentSMSHistory = withActionResponse(_getStudentSMSHistory);
