"use server";

/**
 * 콘텐츠 파트너 관리 서버 액션
 *
 * B2B 파트너십 (출판사, 강의 플랫폼) 관리
 */

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { logActionError } from "@/lib/utils/serverActionLogger";

// ============================================
// Types
// ============================================

export interface ContentPartner {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  partner_type: "publisher" | "lecture_platform" | "academy";
  content_type: "book" | "lecture" | "both";
  api_config?: Record<string, unknown>;
  field_mapping?: Record<string, string>;
  is_active: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  last_sync_at?: string;
  sync_status: "pending" | "syncing" | "completed" | "error";
  created_at: string;
  updated_at: string;
}

export interface PartnerSyncLog {
  id: string;
  partner_id: string;
  sync_type: "full" | "incremental";
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "failed";
  items_processed: number;
  items_created: number;
  items_updated: number;
  items_failed: number;
  error_log: unknown[];
  created_at: string;
}

export interface CreatePartnerInput {
  name: string;
  display_name: string;
  partner_type: "publisher" | "lecture_platform" | "academy";
  content_type: "book" | "lecture" | "both";
  contract_start_date?: string;
  contract_end_date?: string;
}

export interface UpdatePartnerInput {
  display_name?: string;
  partner_type?: "publisher" | "lecture_platform" | "academy";
  content_type?: "book" | "lecture" | "both";
  is_active?: boolean;
  contract_start_date?: string;
  contract_end_date?: string;
  api_config?: Record<string, unknown>;
  field_mapping?: Record<string, string>;
}

// ============================================
// Actions
// ============================================

/**
 * 파트너 목록 조회
 */
export async function getPartners(): Promise<{
  success: boolean;
  partners?: ContentPartner[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const { data, error } = await supabase
      .from("content_partners")
      .select("*")
      .eq("tenant_id", tenantContext.tenantId)
      .order("display_name");

    if (error) {
      logActionError("getPartners", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, partners: data as ContentPartner[] };
  } catch (error) {
    logActionError("getPartners", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 중 오류 발생",
    };
  }
}

/**
 * 단일 파트너 조회
 */
export async function getPartner(partnerId: string): Promise<{
  success: boolean;
  partner?: ContentPartner;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_partners")
      .select("*")
      .eq("id", partnerId)
      .single();

    if (error) {
      logActionError("getPartner", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, partner: data as ContentPartner };
  } catch (error) {
    logActionError("getPartner", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 중 오류 발생",
    };
  }
}

/**
 * 파트너 생성
 */
export async function createPartner(input: CreatePartnerInput): Promise<{
  success: boolean;
  partner?: ContentPartner;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const { data, error } = await supabase
      .from("content_partners")
      .insert({
        ...input,
        tenant_id: tenantContext.tenantId,
        is_active: false,
        sync_status: "pending",
      })
      .select()
      .single();

    if (error) {
      logActionError("createPartner", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/content-management/partners");
    return { success: true, partner: data as ContentPartner };
  } catch (error) {
    logActionError("createPartner", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "생성 중 오류 발생",
    };
  }
}

/**
 * 파트너 수정
 */
export async function updatePartner(
  partnerId: string,
  input: UpdatePartnerInput
): Promise<{
  success: boolean;
  partner?: ContentPartner;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_partners")
      .update(input)
      .eq("id", partnerId)
      .select()
      .single();

    if (error) {
      logActionError("updatePartner", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/content-management/partners");
    revalidatePath(`/admin/content-management/partners/${partnerId}`);
    return { success: true, partner: data as ContentPartner };
  } catch (error) {
    logActionError("updatePartner", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "수정 중 오류 발생",
    };
  }
}

/**
 * 파트너 삭제
 */
export async function deletePartner(partnerId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("content_partners")
      .delete()
      .eq("id", partnerId);

    if (error) {
      logActionError("deletePartner", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/content-management/partners");
    return { success: true };
  } catch (error) {
    logActionError("deletePartner", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "삭제 중 오류 발생",
    };
  }
}

/**
 * 파트너 동기화 이력 조회
 */
export async function getPartnerSyncLogs(partnerId: string): Promise<{
  success: boolean;
  logs?: PartnerSyncLog[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_partner_sync_logs")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      logActionError("getPartnerSyncLogs", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, logs: data as PartnerSyncLog[] };
  } catch (error) {
    logActionError("getPartnerSyncLogs", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 중 오류 발생",
    };
  }
}

/**
 * 파트너 활성화/비활성화 토글
 */
export async function togglePartnerActive(partnerId: string): Promise<{
  success: boolean;
  is_active?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 현재 상태 조회
    const { data: current, error: fetchError } = await supabase
      .from("content_partners")
      .select("is_active")
      .eq("id", partnerId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // 토글
    const newStatus = !current.is_active;
    const { error: updateError } = await supabase
      .from("content_partners")
      .update({ is_active: newStatus })
      .eq("id", partnerId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/admin/content-management/partners");
    return { success: true, is_active: newStatus };
  } catch (error) {
    logActionError("togglePartnerActive", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "상태 변경 중 오류 발생",
    };
  }
}
