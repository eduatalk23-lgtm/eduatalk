import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiCreated,
  apiForbidden,
  apiValidationError,
  handleApiError,
} from "@/lib/api";

type Tenant = {
  id: string;
  name: string;
  type: string;
  status?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 테넌트 목록 조회 API
 * GET /api/tenants
 *
 * @returns
 * 성공: { success: true, data: Tenant[] }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET() {
  try {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin만 접근 가능
    if (!userId || role !== "superadmin") {
      return apiForbidden("Super Admin만 기관 목록을 조회할 수 있습니다.");
    }

    // Super Admin은 Admin Client 사용 (RLS 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return handleApiError(
        new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."),
        "[api/tenants] Admin 클라이언트 생성 실패"
      );
    }

    // status 컬럼이 없을 수 있으므로 안전하게 처리
    let selectQuery = adminClient
      .from("tenants")
      .select("id, name, type, created_at, updated_at");

    // status 컬럼이 있는지 확인 후 추가
    try {
      const { error: testError } = await adminClient
        .from("tenants")
        .select("status")
        .limit(1);
      
      if (!testError) {
        selectQuery = adminClient
          .from("tenants")
          .select("id, name, type, status, created_at, updated_at");
      }
    } catch (e) {
      // status 컬럼이 없으면 무시
    }

    const { data, error } = await selectQuery.order("created_at", { ascending: false });

    if (error) {
      return handleApiError(error, "[api/tenants] 목록 조회 실패");
    }

    return apiSuccess((data as Tenant[]) ?? []);
  } catch (error) {
    return handleApiError(error, "[api/tenants] 목록 조회 오류");
  }
}

/**
 * 테넌트 생성 API
 * POST /api/tenants
 *
 * @body { name: string, type?: string }
 * @returns
 * 성공: { success: true, data: Tenant }
 * 에러: { success: false, error: { code, message } }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin만 접근 가능
    if (!userId || role !== "superadmin") {
      return apiForbidden("Super Admin만 기관을 생성할 수 있습니다.");
    }

    const body = await request.json();
    const { name, type } = body;

    // 입력 검증
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return apiValidationError("입력값이 올바르지 않습니다.", {
        name: ["기관명은 필수입니다."],
      });
    }

    // Super Admin은 Admin Client 사용 (RLS 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return handleApiError(
        new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."),
        "[api/tenants] Admin 클라이언트 생성 실패"
      );
    }

    // status 컬럼이 있는지 확인
    let insertData: { name: string; type: string; status?: string } = {
      name: name.trim(),
      type: type || "academy",
    };

    try {
      const { error: testError } = await adminClient
        .from("tenants")
        .select("status")
        .limit(1);
      
      if (!testError) {
        insertData.status = "active"; // 기본값: active
      }
    } catch (e) {
      // status 컬럼이 없으면 무시
    }

    const { data, error } = await adminClient
      .from("tenants")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "[api/tenants] 생성 실패");
    }

    return apiCreated(data as Tenant);
  } catch (error) {
    return handleApiError(error, "[api/tenants] 생성 오류");
  }
}
