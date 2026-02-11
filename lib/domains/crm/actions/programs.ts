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
const PROGRAMS_PATH = "/admin/programs";

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
    revalidatePath(PROGRAMS_PATH);
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
    revalidatePath(PROGRAMS_PATH);
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
    revalidatePath(PROGRAMS_PATH);
    return { success: true, data: { count: data?.length ?? 0 } };
  } catch (error) {
    logActionError({ domain: "crm", action: "seedDefaultPrograms" }, error);
    return {
      success: false,
      error: "기본 프로그램 시드에 실패했습니다.",
    };
  }
}

export async function deleteProgram(
  programId: string
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 소유권 확인
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

    // 활성 수강 등록 참조 체크
    const { count } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("status", "active");

    if (count && count > 0) {
      return {
        success: false,
        error: `현재 ${count}명이 수강중인 프로그램입니다. 먼저 수강을 종료하거나 비활성화를 사용해주세요.`,
      };
    }

    const { error } = await supabase
      .from("programs")
      .delete()
      .eq("id", programId);

    if (error) {
      // FK constraint (enrollments history)
      if (error.code === "23503") {
        return {
          success: false,
          error: "수강 이력이 있는 프로그램은 삭제할 수 없습니다. 비활성화를 사용해주세요.",
        };
      }
      logActionError(
        { domain: "crm", action: "deleteProgram", tenantId, userId },
        error,
        { programId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    revalidatePath(PROGRAMS_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "deleteProgram" }, error, {
      programId,
    });
    return { success: false, error: "프로그램 삭제에 실패했습니다." };
  }
}

export async function reorderPrograms(
  orderedIds: string[]
): Promise<CrmActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 각 프로그램의 display_order를 배열 인덱스로 업데이트
    const updates = orderedIds.map((id, index) =>
      supabase
        .from("programs")
        .update({ display_order: index + 1 })
        .eq("id", id)
        .eq("tenant_id", tenantId)
    );

    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error);

    if (failed.length > 0) {
      logActionError(
        { domain: "crm", action: "reorderPrograms", tenantId, userId },
        failed[0].error
      );
      return { success: false, error: "순서 변경에 실패했습니다." };
    }

    revalidatePath(CRM_PATH);
    revalidatePath(PROGRAMS_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "reorderPrograms" }, error);
    return { success: false, error: "순서 변경에 실패했습니다." };
  }
}

export type ProgramStat = {
  program_id: string;
  active_count: number;
};

export async function getProgramStats(): Promise<
  CrmActionResult<ProgramStat[]>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("enrollments")
      .select("program_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) {
      logActionError(
        { domain: "crm", action: "getProgramStats", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    // 프로그램별 active 수강 수 집계
    const countMap = new Map<string, number>();
    for (const row of data ?? []) {
      countMap.set(row.program_id, (countMap.get(row.program_id) ?? 0) + 1);
    }

    const stats: ProgramStat[] = Array.from(countMap.entries()).map(
      ([program_id, active_count]) => ({ program_id, active_count })
    );

    return { success: true, data: stats };
  } catch (error) {
    logActionError({ domain: "crm", action: "getProgramStats" }, error);
    return { success: false, error: "통계 조회에 실패했습니다." };
  }
}
