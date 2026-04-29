import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ErrorCode } from "@/lib/errors";

type Caller = {
  role: "admin" | "consultant" | "superadmin" | "parent" | "student" | string;
  tenantId: string | null;
};

/**
 * 리소스 tenant_id가 caller tenant와 일치하는지 검증.
 * - superadmin은 cross-tenant 허용
 * - resource.tenant_id가 NULL(공유 리소스)이면 허용
 * - 그 외에는 caller.tenantId === resource.tenant_id 일치 필요
 *
 * @returns 검증 통과한 리소스의 tenant_id (NULL 가능)
 * @throws AppError 403 if mismatch, 404 if resource not found
 */
async function assertTenantMatch(
  resourceTenantId: string | null,
  caller: Caller,
  resourceLabel: string,
): Promise<void> {
  if (caller.role === "superadmin") return;
  if (resourceTenantId === null) return;
  if (caller.tenantId !== resourceTenantId) {
    throw new AppError(
      `${resourceLabel}에 접근할 권한이 없습니다.`,
      ErrorCode.FORBIDDEN,
      403,
      true,
    );
  }
}

export async function verifyStudentTenantAccess(
  studentId: string,
  caller: Caller,
): Promise<{ tenantId: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new AppError(
      "권한 검증을 수행할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  const { data, error } = await admin
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "학생 조회 중 오류가 발생했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  if (!data) {
    throw new AppError("학생을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  await assertTenantMatch(data.tenant_id ?? null, caller, "해당 학생");
  return { tenantId: data.tenant_id ?? null };
}

export async function verifyGuideTenantAccess(
  guideId: string,
  caller: Caller,
): Promise<{ tenantId: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new AppError(
      "권한 검증을 수행할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  const { data, error } = await admin
    .from("exploration_guides")
    .select("tenant_id")
    .eq("id", guideId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "가이드 조회 중 오류가 발생했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  if (!data) {
    throw new AppError("가이드를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  await assertTenantMatch(data.tenant_id ?? null, caller, "해당 가이드");
  return { tenantId: data.tenant_id ?? null };
}

export async function verifyPipelineTenantAccess(
  pipelineId: string,
  caller: Caller,
): Promise<{ tenantId: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new AppError(
      "권한 검증을 수행할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  // student_record_analysis_pipelines → students.tenant_id 경유
  const { data, error } = await admin
    .from("student_record_analysis_pipelines")
    .select("student_id, students!inner(tenant_id)")
    .eq("id", pipelineId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "파이프라인 조회 중 오류가 발생했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
    );
  }
  if (!data) {
    throw new AppError(
      "파이프라인을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true,
    );
  }

  const students = data.students as unknown as { tenant_id: string | null } | null;
  const tenantId = students?.tenant_id ?? null;
  await assertTenantMatch(tenantId, caller, "해당 파이프라인");
  return { tenantId };
}
