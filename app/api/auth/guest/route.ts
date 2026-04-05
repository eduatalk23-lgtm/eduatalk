import { type NextRequest } from "next/server";
import { apiSuccess, apiBadRequest, apiInternalError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

export async function POST(req: NextRequest) {
  const rateLimitResponse = applyRateLimit(req, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiBadRequest("유효한 JSON 본문이 필요합니다.");
  }

  if (!body || typeof body !== "object") {
    return apiBadRequest("email, password, displayName이 필요합니다.");
  }

  const { email, password, displayName } = body as Record<string, unknown>;

  if (typeof email !== "string" || !email.includes("@")) {
    return apiBadRequest("유효한 이메일 주소가 필요합니다.");
  }
  if (typeof password !== "string" || password.length < 6) {
    return apiBadRequest("비밀번호는 6자 이상이어야 합니다.");
  }
  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    return apiBadRequest("이름을 입력해주세요.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return apiInternalError("서버 설정 오류");
  }

  try {
    // 1. Supabase auth 사용자 생성 (이메일 확인 건너뛰기 — 게스트이므로)
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName.trim(),
          signup_role: "student",
          is_guest: true,
        },
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        return apiBadRequest("이미 등록된 이메일입니다.");
      }
      return apiBadRequest(authError.message || "회원가입에 실패했습니다.");
    }

    if (!authData.user) {
      return apiInternalError("사용자 생성에 실패했습니다.");
    }

    const userId = authData.user.id;

    // 2. Default Tenant 조회
    const { data: defaultTenant } = await adminClient
      .from("tenants")
      .select("id")
      .eq("name", "Default Tenant")
      .maybeSingle();

    if (!defaultTenant) {
      return apiInternalError("기본 기관 정보가 설정되지 않았습니다.");
    }

    // 3. Student 레코드 생성
    await adminClient.from("students").insert({
      id: userId,
      tenant_id: defaultTenant.id,
    });

    // 4. user_profiles에 이름 저장 (auth trigger가 레코드 생성)
    await adminClient
      .from("user_profiles")
      .update({ name: displayName.trim() })
      .eq("id", userId);

    return apiSuccess({
      userId,
      email: email.trim(),
      message: "게스트 계정이 생성되었습니다.",
    });
  } catch (error) {
    console.error("[auth/guest]", error);
    return apiInternalError("계정 생성 중 오류가 발생했습니다.");
  }
}
