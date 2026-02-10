"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { DEFAULT_PROGRAM_CODES } from "../constants";
import type {
  CrmActionResult,
  Program,
  ProgramInsert,
  ProgramUpdate,
} from "../types";

const CRM_PATH = "/admin/crm";

export async function getPrograms(): Promise<CrmActionResult<Program[]>> {
  try {
    const { role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("programs")
      .select("*")
      .order("display_order", { ascending: true });

    if (role !== "superadmin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      logActionError(
        { domain: "crm", action: "getPrograms", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    logActionError({ domain: "crm", action: "getPrograms" }, error);
    return { success: false, error: "프로그램 목록 조회에 실패했습니다." };
  }
}

export async function createProgram(
  input: Omit<ProgramInsert, "tenant_id">
): Promise<CrmActionResult<{ programId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!input.code?.trim()) {
      return { success: false, error: "프로그램 코드를 입력해주세요." };
    }

    if (!input.name?.trim()) {
      return { success: false, error: "프로그램 이름을 입력해주세요." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("programs")
      .insert({ ...input, tenant_id: tenantId })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "이미 동일한 코드의 프로그램이 존재합니다.",
        };
      }
      logActionError(
        { domain: "crm", action: "createProgram", tenantId, userId },
        error
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true, data: { programId: data.id } };
  } catch (error) {
    logActionError({ domain: "crm", action: "createProgram" }, error);
    return { success: false, error: "프로그램 생성에 실패했습니다." };
  }
}

export async function updateProgram(
  programId: string,
  input: Omit<ProgramUpdate, "tenant_id">
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: program, error: fetchError } = await supabase
      .from("programs")
      .select("tenant_id")
      .eq("id", programId)
      .maybeSingle();

    if (fetchError || !program) {
      return { success: false, error: "프로그램을 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && program.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("programs")
      .update(input)
      .eq("id", programId);

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "이미 동일한 코드의 프로그램이 존재합니다.",
        };
      }
      logActionError(
        { domain: "crm", action: "updateProgram", tenantId, userId },
        error,
        { programId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "updateProgram" }, error, {
      programId,
    });
    return { success: false, error: "프로그램 수정에 실패했습니다." };
  }
}

export async function seedDefaultPrograms(): Promise<
  CrmActionResult<{ count: number }>
> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const programs = DEFAULT_PROGRAM_CODES.map((p) => ({
      ...p,
      tenant_id: tenantId,
    }));

    const { data, error } = await supabase
      .from("programs")
      .upsert(programs, { onConflict: "tenant_id,code", ignoreDuplicates: true })
      .select("id");

    if (error) {
      logActionError(
        { domain: "crm", action: "seedDefaultPrograms", tenantId, userId },
        error
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true, data: { count: data?.length ?? 0 } };
  } catch (error) {
    logActionError({ domain: "crm", action: "seedDefaultPrograms" }, error);
    return {
      success: false,
      error: "기본 프로그램 시드에 실패했습니다.",
    };
  }
}
