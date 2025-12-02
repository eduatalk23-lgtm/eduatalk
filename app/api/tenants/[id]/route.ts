import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiNoContent,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  handleApiError,
} from "@/lib/api";

type Tenant = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

/**
 * 테넌트 수정 API
 * PUT /api/tenants/[id]
 *
 * @body { name: string, type?: string }
 * @returns
 * 성공: { success: true, data: Tenant }
 * 에러: { success: false, error: { code, message } }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role } = await getCurrentUserRole();

    console.log("[api/tenants] 수정 요청:", { id, userId, role });

    // Super Admin만 접근 가능
    if (!userId || role !== "superadmin") {
      return apiForbidden("Super Admin만 기관을 수정할 수 있습니다.");
    }

    const body = await request.json();
    const { name, type } = body;

    // 입력 검증
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return apiValidationError("입력값이 올바르지 않습니다.", {
        name: ["기관명은 필수입니다."],
      });
    }

    const supabase = await createSupabaseServerClient();

    // 먼저 테넌트 존재 여부 확인
    const { data: existingTenant, error: checkError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    console.log("[api/tenants] 테넌트 확인 결과:", {
      id,
      existingTenant,
      checkError: checkError ? {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details,
      } : null,
    });

    if (checkError) {
      console.error("[api/tenants] 테넌트 확인 에러:", checkError);
      return handleApiError(checkError, "[api/tenants] 테넌트 확인 실패");
    }

    if (!existingTenant) {
      // 모든 테넌트 ID 확인 (디버깅용)
      const { data: allTenants } = await supabase
        .from("tenants")
        .select("id, name");
      console.log("[api/tenants] 현재 존재하는 테넌트:", allTenants);
      return apiNotFound("해당 기관을 찾을 수 없습니다.");
    }

    // 테넌트 업데이트
    const { data, error } = await supabase
      .from("tenants")
      .update({
        name: name.trim(),
        type: type || "academy",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // PGRST116 에러 처리: 결과가 0개 행일 때
      if (error.code === "PGRST116") {
        return apiNotFound("해당 기관을 찾을 수 없습니다.");
      }
      return handleApiError(error, "[api/tenants] 수정 실패");
    }

    if (!data) {
      return apiNotFound("기관 정보를 가져올 수 없습니다.");
    }

    return apiSuccess(data as Tenant);
  } catch (error) {
    return handleApiError(error, "[api/tenants] 수정 오류");
  }
}

/**
 * 테넌트 삭제 API
 * DELETE /api/tenants/[id]
 *
 * @returns
 * 성공: { success: true, data: null }
 * 에러: { success: false, error: { code, message } }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role } = await getCurrentUserRole();

    // Super Admin만 접근 가능
    if (!userId || role !== "superadmin") {
      return apiForbidden("Super Admin만 기관을 삭제할 수 있습니다.");
    }

    const supabase = await createSupabaseServerClient();

    // 먼저 테넌트 존재 여부 확인
    const { data: existingTenant, error: checkError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      return handleApiError(checkError, "[api/tenants] 테넌트 확인 실패");
    }

    if (!existingTenant) {
      return apiNotFound("해당 기관을 찾을 수 없습니다.");
    }

    // 테넌트 삭제
    const { error } = await supabase
      .from("tenants")
      .delete()
      .eq("id", id);

    if (error) {
      return handleApiError(error, "[api/tenants] 삭제 실패");
    }

    return apiNoContent();
  } catch (error) {
    return handleApiError(error, "[api/tenants] 삭제 오류");
  }
}
