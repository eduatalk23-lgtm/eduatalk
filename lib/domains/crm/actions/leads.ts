"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { scoreNewLead } from "./scoring";
import { createAutoTask } from "./tasks";
import type {
  CrmActionResult,
  SalesLeadInsert,
  SalesLeadUpdate,
  SalesLead,
} from "../types";

const CRM_PATH = "/admin/crm";

export async function createLead(
  input: Omit<SalesLeadInsert, "tenant_id" | "created_by">
): Promise<CrmActionResult<{ leadId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!input.contact_name?.trim()) {
      return { success: false, error: "문의자 이름을 입력해주세요." };
    }

    if (!input.lead_source?.trim()) {
      return { success: false, error: "유입경로를 선택해주세요." };
    }

    const supabase = await createSupabaseServerClient();

    // 프로그램 코드 조회 (스코어링용)
    let programCode: string | null = null;
    if (input.program_id) {
      const { data: program } = await supabase
        .from("programs")
        .select("code")
        .eq("id", input.program_id)
        .maybeSingle();
      programCode = program?.code ?? null;
    }

    const { data, error } = await supabase
      .from("sales_leads")
      .insert({
        ...input,
        tenant_id: tenantId,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "crm", action: "createLead", tenantId, userId },
        error
      );
      return { success: false, error: error.message };
    }

    // 초기 스코어링 (비동기, 실패해도 리드 생성은 성공)
    scoreNewLead(data.id, {
      lead_source: input.lead_source,
      program_code: programCode,
      student_grade: input.student_grade ?? null,
    }).catch(() => {});

    // 신규 리드 자동 태스크 생성
    createAutoTask(data.id, "new", input.assigned_to ?? null).catch(() => {});

    revalidatePath(CRM_PATH);
    revalidatePath(`${CRM_PATH}/leads`);
    return { success: true, data: { leadId: data.id } };
  } catch (error) {
    logActionError({ domain: "crm", action: "createLead" }, error);
    return { success: false, error: "리드 생성에 실패했습니다." };
  }
}

export async function updateLead(
  leadId: string,
  input: Omit<SalesLeadUpdate, "tenant_id" | "created_by">
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 테넌트 격리 확인
    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("sales_leads")
      .update(input)
      .eq("id", leadId);

    if (error) {
      logActionError(
        { domain: "crm", action: "updateLead", tenantId, userId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    revalidatePath(`${CRM_PATH}/leads`);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "updateLead" }, error, { leadId });
    return { success: false, error: "리드 수정에 실패했습니다." };
  }
}

export async function deleteLead(
  leadId: string
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("sales_leads")
      .delete()
      .eq("id", leadId);

    if (error) {
      logActionError(
        { domain: "crm", action: "deleteLead", tenantId, userId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "deleteLead" }, error, { leadId });
    return { success: false, error: "리드 삭제에 실패했습니다." };
  }
}

export async function getLeadById(
  leadId: string
): Promise<CrmActionResult<SalesLead>> {
  try {
    const { role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("sales_leads")
      .select("*")
      .eq("id", leadId);

    if (role !== "superadmin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logActionError(
        { domain: "crm", action: "getLeadById", tenantId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    return { success: true, data };
  } catch (error) {
    logActionError({ domain: "crm", action: "getLeadById" }, error, {
      leadId,
    });
    return { success: false, error: "리드 조회에 실패했습니다." };
  }
}

export async function markAsSpam(
  leadId: string,
  spamReason?: string
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("sales_leads")
      .update({
        is_spam: true,
        spam_reason: spamReason ?? null,
        pipeline_status: "spam",
      })
      .eq("id", leadId);

    if (error) {
      logActionError(
        { domain: "crm", action: "markAsSpam", tenantId, userId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "markAsSpam" }, error, { leadId });
    return { success: false, error: "스팸 처리에 실패했습니다." };
  }
}
