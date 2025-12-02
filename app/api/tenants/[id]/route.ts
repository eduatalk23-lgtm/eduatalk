import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiNoContent,
  apiForbidden,
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
    const { data, error } = await supabase
      .from("tenants")
      .update({
        name: name.trim(),
        type: type || "academy",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "[api/tenants] 수정 실패");
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
