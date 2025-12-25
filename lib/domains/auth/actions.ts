"use server";

/**
 * Auth 도메인 Server Actions
 *
 * 인증 관련 모든 Server Actions:
 * - 로그인/로그아웃
 * - 회원가입
 * - 이메일 확인
 * - 비밀번호 재설정
 * - 사용자 권한 변경
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ErrorCode, withErrorHandling, logError } from "@/lib/errors";
import { saveUserSession } from "@/lib/auth/sessionManager";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getDefaultTenant } from "@/lib/data/tenants";
import { DATABASE_ERROR_CODES } from "@/lib/constants/databaseErrorCodes";
import type { UserWithSignupMetadata } from "@/lib/types/auth";
import { getEmailRedirectUrl } from "@/lib/utils/getEmailRedirectUrl";
import { saveUserConsents } from "@/lib/data/userConsents";
import { StudentError, StudentErrorCodes, toStudentError } from "@/lib/errors/studentErrors";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { signInSchema, signUpSchema, type SignInResult, type AuthResult } from "./types";

// ============================================
// Internal Helpers
// ============================================

/**
 * Admin 클라이언트 생성 및 null 체크 헬퍼
 * 회원가입 시 RLS 우회가 필요한 경우 사용
 */
function getAdminClientOrError():
  | { success: true; client: NonNullable<ReturnType<typeof createSupabaseAdminClient>> }
  | { success: false; error: string } {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.error("[auth] Admin 클라이언트 생성 실패: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
    return {
      success: false,
      error: "서버 설정 오류입니다. 관리자에게 문의하세요.",
    };
  }

  return { success: true, client: supabase };
}

/**
 * 첫 로그인 시 사용자 레코드 확인 및 생성
 */
async function ensureUserRecord(user: UserWithSignupMetadata): Promise<void> {
  try {
    const metadata = user.user_metadata;
    const signupRole = metadata?.signup_role;

    if (!signupRole || (signupRole !== "student" && signupRole !== "parent")) {
      return;
    }

    const supabase = await createSupabaseServerClient();
    const tenantId = metadata?.tenant_id;
    const displayName = metadata?.display_name;

    if (signupRole === "student") {
      const { data: student, error: checkError } = await supabase
        .from("students")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (checkError) {
        console.error("[auth] 학생 레코드 확인 실패", {
          userId: user.id,
          error: checkError.message,
          code: checkError.code,
        });
        return;
      }

      if (!student) {
        const result = await createStudentRecord(user.id, tenantId, displayName);
        if (result.success) {
          console.log("[auth] 첫 로그인 시 학생 레코드 생성 성공", {
            userId: user.id,
            tenantId: tenantId || "기본 tenant",
          });
        } else {
          console.error("[auth] 첫 로그인 시 학생 레코드 생성 실패", {
            userId: user.id,
            error: result.error,
          });
        }
      }
    } else if (signupRole === "parent") {
      const { data: parent, error: checkError } = await supabase
        .from("parent_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (checkError) {
        console.error("[auth] 학부모 레코드 확인 실패", {
          userId: user.id,
          error: checkError.message,
          code: checkError.code,
        });
        return;
      }

      if (!parent) {
        const result = await createParentRecord(user.id, tenantId, displayName);
        if (result.success) {
          console.log("[auth] 첫 로그인 시 학부모 레코드 생성 성공", {
            userId: user.id,
            tenantId: tenantId || "기본 tenant 또는 null",
          });
        } else {
          console.error("[auth] 첫 로그인 시 학부모 레코드 생성 실패", {
            userId: user.id,
            error: result.error,
          });
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] ensureUserRecord 예외", {
      userId: user.id,
      error: errorMessage,
    });
  }
}

/**
 * 연결 코드로 학생 계정 연결
 */
async function linkStudentWithConnectionCode(
  userId: string,
  connectionCode: string
): Promise<AuthResult> {
  try {
    const adminResult = getAdminClientOrError();
    if (!adminResult.success) {
      const studentError = toStudentError(
        new Error(adminResult.error),
        StudentErrorCodes.RLS_POLICY_VIOLATION,
        { userId, connectionCode }
      );
      logError(studentError, {
        function: "linkStudentWithConnectionCode",
        userId,
        connectionCode,
        reason: "Admin client creation failed",
      });
      return { success: false, error: studentError.userMessage };
    }
    const supabase = adminResult.client;

    const { data, error } = await supabase.rpc(
      "link_student_with_connection_code",
      {
        p_user_id: userId,
        p_connection_code: connectionCode,
      }
    );

    if (error) {
      const studentError = toStudentError(
        error,
        StudentErrorCodes.LINK_STUDENT_FAILED,
        { userId, connectionCode }
      );
      logError(studentError, {
        function: "linkStudentWithConnectionCode",
        userId,
        connectionCode,
        supabaseError: error,
      });
      return { success: false, error: studentError.userMessage };
    }

    // RPC 응답을 타입 캐스팅
    const rpcResponse = data as { success?: boolean; error?: string; student_id?: string } | null;
    if (!rpcResponse || !rpcResponse.success) {
      const errorMessage = rpcResponse?.error || "학생 계정 연결에 실패했습니다.";
      const studentError = toStudentError(
        new Error(errorMessage),
        StudentErrorCodes.LINK_STUDENT_FAILED,
        { userId, connectionCode, functionError: errorMessage }
      );
      logError(studentError, {
        function: "linkStudentWithConnectionCode",
        userId,
        connectionCode,
        functionResponse: rpcResponse,
      });
      return { success: false, error: studentError.userMessage };
    }

    console.log("[auth] 연결 코드로 학생 계정 연결 성공", {
      function: "linkStudentWithConnectionCode",
      userId,
      connectionCode,
      result: {
        studentId: rpcResponse.student_id,
        oldStudentId: (rpcResponse as Record<string, unknown>).old_student_id,
      },
    });

    return { success: true };
  } catch (error) {
    const studentError = toStudentError(
      error,
      StudentErrorCodes.UNKNOWN_ERROR,
      { userId, connectionCode }
    );
    logError(studentError, {
      function: "linkStudentWithConnectionCode",
      userId,
      connectionCode,
      exception: true,
    });
    return { success: false, error: studentError.userMessage };
  }
}

/**
 * 회원가입 시 학생 레코드 생성
 */
async function createStudentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null
): Promise<AuthResult> {
  try {
    const adminResult = getAdminClientOrError();
    if (!adminResult.success) {
      return { success: false, error: adminResult.error };
    }
    const supabase = adminResult.client;

    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const defaultTenant = await getDefaultTenant();
      if (!defaultTenant) {
        console.error("[auth] Default Tenant가 존재하지 않습니다. 학생 레코드 생성 실패");
        return { success: false, error: "기본 기관 정보가 설정되지 않았습니다." };
      }
      finalTenantId = defaultTenant.id;
    }

    const { error } = await supabase.from("students").insert({
      id: userId,
      tenant_id: finalTenantId,
      name: displayName || "",
    });

    if (error) {
      if (error.code === DATABASE_ERROR_CODES.UNIQUE_VIOLATION) {
        console.log("[auth] 학생 레코드가 이미 존재합니다.", { userId });
        return { success: true };
      }

      if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
        console.error("[auth] 학생 레코드 생성 실패 - RLS 정책 위반", {
          userId,
          tenantId: finalTenantId,
          error: error.message,
          code: error.code,
        });
        return { success: false, error: "레코드 생성 권한이 없습니다. RLS 정책을 확인하세요." };
      }

      console.error("[auth] 학생 레코드 생성 실패", {
        userId,
        tenantId: finalTenantId,
        error: error.message,
        code: error.code,
      });
      return { success: false, error: error.message || "학생 레코드 생성에 실패했습니다." };
    }

    console.log("[auth] 학생 레코드 생성 성공", { userId, tenantId: finalTenantId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] createStudentRecord 예외", { userId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * 회원가입 시 학부모 레코드 생성
 */
async function createParentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null
): Promise<AuthResult> {
  try {
    const adminResult = getAdminClientOrError();
    if (!adminResult.success) {
      return { success: false, error: adminResult.error };
    }
    const supabase = adminResult.client;

    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const defaultTenant = await getDefaultTenant();
      if (defaultTenant) {
        finalTenantId = defaultTenant.id;
      }
    }

    // tenant_id는 필수 값이므로 없으면 에러 반환
    if (!finalTenantId) {
      console.error("[auth] 학부모 레코드 생성 실패 - 테넌트 없음", { userId });
      return { success: false, error: "기관 정보가 없어 가입할 수 없습니다." };
    }

    const { error } = await supabase.from("parent_users").insert({
      id: userId,
      tenant_id: finalTenantId,
      name: displayName || "",
    });

    if (error) {
      if (error.code === DATABASE_ERROR_CODES.UNIQUE_VIOLATION) {
        console.log("[auth] 학부모 레코드가 이미 존재합니다.", { userId });
        return { success: true };
      }

      if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
        console.error("[auth] 학부모 레코드 생성 실패 - RLS 정책 위반", {
          userId,
          tenantId: finalTenantId,
          error: error.message,
          code: error.code,
        });
        return { success: false, error: "레코드 생성 권한이 없습니다. RLS 정책을 확인하세요." };
      }

      console.error("[auth] 학부모 레코드 생성 실패", {
        userId,
        tenantId: finalTenantId,
        error: error.message,
        code: error.code,
      });
      return { success: false, error: error.message || "학부모 레코드 생성에 실패했습니다." };
    }

    console.log("[auth] 학부모 레코드 생성 성공", { userId, tenantId: finalTenantId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] createParentRecord 예외", { userId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Public Actions
// ============================================

/**
 * 로그인
 */
export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const rememberMe = formData.get("rememberMe") === "on";
  const returnUrl = String(formData.get("returnUrl") ?? "").trim();

  const validation = signInSchema.safeParse({ email, password });
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new AppError(
      firstError?.message || "이메일과 비밀번호를 모두 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient(undefined, { rememberMe });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  });

  if (data?.session && data.user) {
    const expiresAt = data.session.expires_at
      ? new Date(data.session.expires_at * 1000)
      : undefined;

    saveUserSession(data.user.id, data.session.access_token, expiresAt).catch((err) => {
      console.error("[auth] 세션 저장 실패 (무시됨):", err);
    });

    ensureUserRecord(data.user).catch((err) => {
      console.error("[auth] 레코드 확인/생성 실패 (무시됨):", err);
    });
  }

  if (error) {
    const errorMessage = error.message?.toLowerCase() || "";
    const emailNotConfirmedMessages = [
      "email not confirmed",
      "email not verified",
      "email address not confirmed",
      "user email not confirmed",
    ];

    const isEmailNotConfirmed = emailNotConfirmedMessages.some((msg) =>
      errorMessage.includes(msg)
    );

    if (isEmailNotConfirmed) {
      console.log("[auth] 이메일 미인증 감지:", {
        email: validation.data.email,
        errorMessage: error.message,
        errorStatus: error.status,
      });

      return {
        error: "이메일 인증이 완료되지 않았습니다. 이메일을 확인하여 인증을 완료해주세요.",
        needsEmailVerification: true,
        email: validation.data.email,
      };
    }

    console.log("[auth] 로그인 실패:", {
      email: validation.data.email,
      errorMessage: error.message,
      errorStatus: error.status,
    });

    throw new AppError(
      error.message || "로그인에 실패했습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (returnUrl) {
    redirect(decodeURIComponent(returnUrl));
  } else {
    redirect("/");
  }
}

/**
 * 회원가입
 */
export async function signUp(
  prevState: ActionResponse<{ redirect: string }> | null,
  formData: FormData
): Promise<ActionResponse<{ redirect: string }>> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "student" | "parent" | "";
  const connectionCode = String(formData.get("connection_code") ?? "").trim();

  const consentTerms = formData.get("consent_terms") === "on";
  const consentPrivacy = formData.get("consent_privacy") === "on";
  const consentMarketing = formData.get("consent_marketing") === "on";

  if (!consentTerms || !consentPrivacy) {
    return createErrorResponse("필수 약관에 동의해주세요.");
  }

  const validation = signUpSchema.safeParse({
    email,
    password,
    displayName,
    tenantId,
    role: role || undefined,
  });
  if (!validation.success) {
    const fieldErrors: Record<string, string[]> = {};
    validation.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    });
    return createErrorResponse("입력값 검증에 실패했습니다.", fieldErrors);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = await getEmailRedirectUrl();
    const { data: authData, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        emailRedirectTo: emailRedirectTo,
        data: {
          display_name: validation.data.displayName,
          tenant_id: validation.data.tenantId || null,
          signup_role: validation.data.role || null,
        },
      },
    });

    if (error) {
      return createErrorResponse(error.message || "회원가입에 실패했습니다.");
    }

    if (authData.user) {
      const userRole = validation.data.role;
      const userTenantId = validation.data.tenantId || null;
      const userDisplayName = validation.data.displayName;

      if (userRole === "student") {
        if (connectionCode) {
          const linkResult = await linkStudentWithConnectionCode(
            authData.user.id,
            connectionCode
          );
          if (linkResult.success) {
            console.log("[auth] 연결 코드로 학생 계정 연결 성공", {
              userId: authData.user.id,
              connectionCode,
            });
          } else {
            console.error("[auth] 연결 코드 검증 실패:", linkResult.error);
            const result = await createStudentRecord(authData.user.id, userTenantId, userDisplayName);
            if (!result.success) {
              console.error("[auth] 학생 레코드 생성 실패:", result.error);
            }
          }
        } else {
          const result = await createStudentRecord(authData.user.id, userTenantId, userDisplayName);
          if (!result.success) {
            console.error("[auth] 학생 레코드 생성 실패:", result.error);
          }
        }
      } else if (userRole === "parent") {
        const result = await createParentRecord(authData.user.id, userTenantId, userDisplayName);
        if (!result.success) {
          console.error("[auth] 학부모 레코드 생성 실패:", result.error);
        }
      }

      const consentResult = await saveUserConsents(
        authData.user.id,
        {
          terms: consentTerms,
          privacy: consentPrivacy,
          marketing: consentMarketing,
        },
        undefined,
        true
      );

      if (!consentResult.success) {
        console.error("[auth] 약관 동의 저장 실패:", consentResult.error);
      }
    }

    return createSuccessResponse(
      { redirect: `/signup/verify-email?email=${encodeURIComponent(validation.data.email)}` },
      "회원가입이 완료되었습니다."
    );
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "회원가입에 실패했습니다."
    );
  }
}

/**
 * 로그아웃
 */
async function _signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AppError(
      error.message || "로그아웃에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  redirect("/login");
}

export const signOut = withErrorHandling(_signOut);

/**
 * 이메일 확인 메일 재발송
 */
export async function resendConfirmationEmail(email: string): Promise<ActionResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = await getEmailRedirectUrl();

    if (process.env.NODE_ENV === "development") {
      console.log("[auth] 이메일 재발송 요청");
    }

    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: emailRedirectTo,
      },
    });

    if (error) {
      if (
        error.message?.toLowerCase().includes("already confirmed") ||
        error.message?.toLowerCase().includes("already verified") ||
        error.message?.toLowerCase().includes("user already registered")
      ) {
        return createErrorResponse("이 계정은 이미 인증되었습니다. 로그인을 시도해주세요.");
      }

      console.error("[auth] 이메일 재발송 실패:", error);
      return createErrorResponse(error.message || "이메일 재발송에 실패했습니다.");
    }

    return createSuccessResponse(
      undefined,
      "인증 메일을 재발송했습니다. 이메일을 확인해주세요. (스팸 메일함도 확인해주세요)"
    );
  } catch (error) {
    console.error("[auth] 이메일 재발송 예외:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "이메일 재발송에 실패했습니다."
    );
  }
}

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = await getEmailRedirectUrl();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectTo,
    });

    if (error) {
      console.error("[auth] 비밀번호 재설정 이메일 발송 실패:", error);
      return {
        success: false,
        error: error.message || "비밀번호 재설정 이메일 발송에 실패했습니다.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[auth] 비밀번호 재설정 이메일 발송 성공");
    }
    return { success: true };
  } catch (error) {
    console.error("[auth] 비밀번호 재설정 이메일 발송 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "비밀번호 재설정 이메일 발송에 실패했습니다.",
    };
  }
}

/**
 * 비밀번호 업데이트 (비밀번호 재설정 플로우 - 이메일 링크 클릭 후)
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("[auth] 비밀번호 업데이트 실패:", error);
      return {
        success: false,
        error: error.message || "비밀번호 변경에 실패했습니다.",
      };
    }

    await supabase.auth.signOut();

    if (process.env.NODE_ENV === "development") {
      console.log("[auth] 비밀번호 업데이트 성공");
    }
    return { success: true };
  } catch (error) {
    console.error("[auth] 비밀번호 업데이트 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.",
    };
  }
}

/**
 * 비밀번호 변경 (마이페이지 - 현재 비밀번호 확인 후)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 현재 비밀번호 확인
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: "현재 비밀번호가 올바르지 않습니다." };
  }

  // 새 비밀번호로 변경
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("[auth] 비밀번호 변경 실패:", updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

/**
 * 사용자 권한 변경 (학생 ↔ 학부모)
 */
export async function changeUserRole(newRole: "student" | "parent"): Promise<ActionResponse> {
  const { userId } = await getCurrentUserRole();

  if (!userId) {
    return createErrorResponse("로그인이 필요합니다.");
  }

  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse("사용자 정보를 찾을 수 없습니다.");
    }

    let tenantId = (user.user_metadata?.tenant_id as string) || null;

    if (!tenantId) {
      const { data: defaultTenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("name", "Default Tenant")
        .maybeSingle();

      if (tenantError) {
        console.error("[userRole] Default Tenant 조회 실패:", tenantError);
        return createErrorResponse("기본 기관 정보를 조회할 수 없습니다.");
      }

      if (!defaultTenant) {
        console.error("[userRole] Default Tenant가 존재하지 않습니다.");
        return createErrorResponse("기본 기관 정보가 설정되지 않았습니다. 관리자에게 문의하세요.");
      }

      tenantId = defaultTenant.id;
    }

    if (newRole === "student") {
      const { error: deleteParentError } = await supabase
        .from("parent_users")
        .delete()
        .eq("id", userId);

      if (deleteParentError && deleteParentError.code !== "PGRST116") {
        console.error("[userRole] 학부모 레코드 삭제 실패:", deleteParentError);
      }

      const displayName = (user.user_metadata?.display_name as string) || "이름 없음";
      const { error: createStudentError } = await supabase.from("students").upsert({
        id: userId,
        user_id: userId,
        tenant_id: tenantId,
        name: displayName,
        grade: null,
        school_id: null,
        school_type: null,
      });

      if (createStudentError) {
        console.error("[userRole] 학생 레코드 생성 실패:", createStudentError);
        return createErrorResponse(createStudentError.message || "학생 권한 변경에 실패했습니다.");
      }

      await supabase.auth.updateUser({
        data: { signup_role: "student" },
      });
    } else {
      let deleteStudentError = null;

      const { error: error1 } = await supabase.from("students").delete().eq("id", userId);

      if (error1) {
        const { error: error2 } = await supabase.from("students").delete().eq("user_id", userId);
        deleteStudentError = error2;
      }

      if (deleteStudentError && deleteStudentError.code !== "PGRST116") {
        console.error("[userRole] 학생 레코드 삭제 실패:", deleteStudentError);
      }

      const { error: createParentError } = await supabase.from("parent_users").upsert({
        id: userId,
        tenant_id: tenantId,
        relationship: null,
        occupation: null,
      });

      if (createParentError) {
        console.error("[userRole] 학부모 레코드 생성 실패:", createParentError);
        return createErrorResponse(createParentError.message || "학부모 권한 변경에 실패했습니다.");
      }

      await supabase.auth.updateUser({
        data: { signup_role: "parent" },
      });
    }

    revalidatePath("/settings");
    revalidatePath("/parent/settings");

    return createSuccessResponse();
  } catch (error) {
    console.error("[userRole] 권한 변경 중 오류:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "권한 변경 중 오류가 발생했습니다."
    );
  }
}
