"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { saveUserSession } from "@/lib/auth/sessionManager";
import { getDefaultTenant } from "@/lib/data/tenants";
import { DATABASE_ERROR_CODES } from "@/lib/constants/databaseErrorCodes";
import type { UserWithSignupMetadata } from "@/lib/types/auth";
import { z } from "zod";
import { getEmailRedirectUrl } from "@/lib/utils/getEmailRedirectUrl";
import { saveUserConsents } from "@/lib/data/userConsents";

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

const signInSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

async function _signIn(formData: FormData): Promise<{ error?: string; needsEmailVerification?: boolean; email?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const rememberMe = formData.get("rememberMe") === "on";
  const returnUrl = String(formData.get("returnUrl") ?? "").trim();

  // 입력 검증
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

  // 로그인 성공 시 세션 정보 저장 및 레코드 확인
  if (data?.session && data.user) {
    const expiresAt = data.session.expires_at
      ? new Date(data.session.expires_at * 1000)
      : undefined;

    // 세션 정보 저장 (비동기, 실패해도 로그인은 계속 진행)
    saveUserSession(
      data.user.id,
      data.session.access_token,
      expiresAt
    ).catch((err) => {
      console.error("[auth] 세션 저장 실패 (무시됨):", err);
    });

    // 첫 로그인 시 레코드 확인 및 생성 (완전한 인증 상태이므로 RLS 정책 정상 작동)
    // 실패해도 로그인은 계속 진행
    ensureUserRecord(data.user).catch((err) => {
      console.error("[auth] 레코드 확인/생성 실패 (무시됨):", err);
    });
  }

  if (error) {
    // 이메일 미인증 오류인지 정확하게 확인
    // Supabase의 이메일 미인증 에러는 특정 메시지를 포함합니다
    const errorMessage = error.message?.toLowerCase() || "";
    const emailNotConfirmedMessages = [
      "email not confirmed",
      "email not verified",
      "email address not confirmed",
      "user email not confirmed",
    ];

    const isEmailNotConfirmed = emailNotConfirmedMessages.some(
      (msg) => errorMessage.includes(msg)
    );

    // 정확한 이메일 미인증 에러인 경우에만 처리
    // error.status === 400만으로는 판단하지 않음 (비밀번호 오류도 400일 수 있음)
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

    // 이메일 미인증이 아닌 다른 에러인 경우 로깅
    console.log("[auth] 로그인 실패:", {
      email: validation.data.email,
      errorMessage: error.message,
      errorStatus: error.status,
    });

    // 인증 실패는 사용자에게 보여줄 수 있는 에러
    throw new AppError(
      error.message || "로그인에 실패했습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // 로그인 성공 시 returnUrl이 있으면 해당 URL로, 없으면 루트 페이지로 리다이렉트
  if (returnUrl) {
    redirect(decodeURIComponent(returnUrl));
  } else {
    // 루트 페이지로 리다이렉트 (역할별 리다이렉트는 루트 페이지에서 처리)
    redirect("/");
  }
}

// 에러 핸들링 래퍼 적용
// _signIn은 이제 객체를 반환할 수 있으므로 직접 export
export const signIn = _signIn;

/**
 * 첫 로그인 시 사용자 레코드 확인 및 생성
 * 이메일 인증 완료 후 첫 로그인 시점에 호출되며, 완전한 인증 상태이므로 RLS 정책이 정상 작동합니다.
 */
async function ensureUserRecord(
  user: UserWithSignupMetadata
): Promise<void> {
  try {
    const metadata = user.user_metadata;
    const signupRole = metadata?.signup_role;

    // signup_role이 없으면 레코드 생성 시도하지 않음
    if (!signupRole || (signupRole !== "student" && signupRole !== "parent")) {
      return;
    }

    const supabase = await createSupabaseServerClient();
    const tenantId = metadata?.tenant_id;
    const displayName = metadata?.display_name;

    if (signupRole === "student") {
      // students 테이블에 레코드 존재 여부 확인
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

      // 레코드가 없으면 생성 시도
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
      } else {
        console.log("[auth] 학생 레코드가 이미 존재합니다.", { userId: user.id });
      }
    } else if (signupRole === "parent") {
      // parent_users 테이블에 레코드 존재 여부 확인
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

      // 레코드가 없으면 생성 시도
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
      } else {
        console.log("[auth] 학부모 레코드가 이미 존재합니다.", { userId: user.id });
      }
    }
  } catch (error) {
    // 레코드 생성 실패는 로그인 성공에 영향 없음
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] ensureUserRecord 예외", {
      userId: user.id,
      error: errorMessage,
    });
  }
}

/**
 * 회원가입 시 학생 레코드 생성
 */
async function createStudentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // 회원가입 시에는 세션이 없으므로 Admin 클라이언트 사용 (RLS 우회)
    const adminResult = getAdminClientOrError();
    if (!adminResult.success) {
      return { success: false, error: adminResult.error };
    }
    const supabase = adminResult.client;

    // tenant_id가 없으면 기본 tenant 조회
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const defaultTenant = await getDefaultTenant();
      if (!defaultTenant) {
        console.error("[auth] Default Tenant가 존재하지 않습니다. 학생 레코드 생성 실패");
        return {
          success: false,
          error: "기본 기관 정보가 설정되지 않았습니다.",
        };
      }
      finalTenantId = defaultTenant.id;
    }

    // students 테이블에 최소 필드로 레코드 생성
    // name 필드는 NOT NULL 제약조건이 있으므로 displayName을 포함
    // displayName이 없으면 빈 문자열 사용 (NOT NULL 제약조건 충족)
    const { error } = await supabase.from("students").insert({
      id: userId,
      tenant_id: finalTenantId,
      name: displayName || "",
    });

    if (error) {
      // UNIQUE constraint violation (이미 존재하는 경우)는 성공으로 처리
      if (error.code === DATABASE_ERROR_CODES.UNIQUE_VIOLATION) {
        console.log("[auth] 학생 레코드가 이미 존재합니다.", { userId });
        return { success: true };
      }

      // RLS 정책 위반 에러 명시적 처리
      if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
        console.error("[auth] 학생 레코드 생성 실패 - RLS 정책 위반", {
          userId,
          tenantId: finalTenantId,
          error: error.message,
          code: error.code,
        });
        return {
          success: false,
          error: "레코드 생성 권한이 없습니다. RLS 정책을 확인하세요.",
        };
      }

      console.error("[auth] 학생 레코드 생성 실패", {
        userId,
        tenantId: finalTenantId,
        error: error.message,
        code: error.code,
      });
      return {
        success: false,
        error: error.message || "학생 레코드 생성에 실패했습니다.",
      };
    }

    console.log("[auth] 학생 레코드 생성 성공", { userId, tenantId: finalTenantId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] createStudentRecord 예외", {
      userId,
      error: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 회원가입 시 학부모 레코드 생성
 */
async function createParentRecord(
  userId: string,
  tenantId: string | null | undefined,
  displayName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // 회원가입 시에는 세션이 없으므로 Admin 클라이언트 사용 (RLS 우회)
    const adminResult = getAdminClientOrError();
    if (!adminResult.success) {
      return { success: false, error: adminResult.error };
    }
    const supabase = adminResult.client;

    // tenant_id가 없으면 기본 tenant 조회 (nullable이므로 선택사항)
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const defaultTenant = await getDefaultTenant();
      if (defaultTenant) {
        finalTenantId = defaultTenant.id;
      }
      // defaultTenant가 없어도 parent_users는 nullable이므로 계속 진행
    }

    // parent_users 테이블에 최소 필드로 레코드 생성
    // name 필드는 NOT NULL 제약조건이 있으므로 displayName을 포함
    // displayName이 없으면 빈 문자열 사용 (NOT NULL 제약조건 충족)
    const { error } = await supabase.from("parent_users").insert({
      id: userId,
      tenant_id: finalTenantId ?? null,
      name: displayName || "",
    });

    if (error) {
      // UNIQUE constraint violation (이미 존재하는 경우)는 성공으로 처리
      if (error.code === DATABASE_ERROR_CODES.UNIQUE_VIOLATION) {
        console.log("[auth] 학부모 레코드가 이미 존재합니다.", { userId });
        return { success: true };
      }

      // RLS 정책 위반 에러 명시적 처리
      if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
        console.error("[auth] 학부모 레코드 생성 실패 - RLS 정책 위반", {
          userId,
          tenantId: finalTenantId,
          error: error.message,
          code: error.code,
        });
        return {
          success: false,
          error: "레코드 생성 권한이 없습니다. RLS 정책을 확인하세요.",
        };
      }

      console.error("[auth] 학부모 레코드 생성 실패", {
        userId,
        tenantId: finalTenantId,
        error: error.message,
        code: error.code,
      });
      return {
        success: false,
        error: error.message || "학부모 레코드 생성에 실패했습니다.",
      };
    }

    console.log("[auth] 학부모 레코드 생성 성공", { userId, tenantId: finalTenantId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] createParentRecord 예외", {
      userId,
      error: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

const signUpSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
  displayName: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
  tenantId: z.string().min(1, "기관을 선택해주세요.").optional(),
  role: z.enum(["student", "parent"]).optional(),
});

export async function signUp(
  prevState: { error?: string; message?: string } | null,
  formData: FormData
): Promise<{ error?: string; message?: string; redirect?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as "student" | "parent" | "";

  // 약관 동의 정보 추출
  const consentTerms = formData.get("consent_terms") === "on";
  const consentPrivacy = formData.get("consent_privacy") === "on";
  const consentMarketing = formData.get("consent_marketing") === "on";

  // 필수 약관 체크
  if (!consentTerms || !consentPrivacy) {
    return { error: "필수 약관에 동의해주세요." };
  }

  // 입력 검증
  const validation = signUpSchema.safeParse({ email, password, displayName, tenantId, role: role || undefined });
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { error: firstError?.message || "모든 필드를 올바르게 입력해주세요." };
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
          tenant_id: validation.data.tenantId || null, // 기관 ID를 user_metadata에 저장
          signup_role: validation.data.role || null, // 회원가입 시 선택한 권한 저장
        },
      },
    });

    if (error) {
      return { error: error.message || "회원가입에 실패했습니다." };
    }

    // 회원가입 성공 시 레코드 생성 시도
    if (authData.user) {
      const role = validation.data.role;
      const tenantId = validation.data.tenantId || null;
      const displayName = validation.data.displayName;

      if (role === "student") {
        const result = await createStudentRecord(authData.user.id, tenantId, displayName);
        if (!result.success) {
          // 레코드 생성 실패는 로깅만 하고 회원가입은 성공으로 처리
          console.error("[auth] 학생 레코드 생성 실패:", result.error);
        }
      } else if (role === "parent") {
        const result = await createParentRecord(authData.user.id, tenantId, displayName);
        if (!result.success) {
          // 레코드 생성 실패는 로깅만 하고 회원가입은 성공으로 처리
          console.error("[auth] 학부모 레코드 생성 실패:", result.error);
        }
      }

      // 약관 동의 정보 저장 (회원가입 시에는 세션이 없으므로 Admin 클라이언트 사용)
      const consentResult = await saveUserConsents(
        authData.user.id,
        {
          terms: consentTerms,
          privacy: consentPrivacy,
          marketing: consentMarketing,
        },
        undefined, // metadata
        true // useAdmin - 회원가입 시 RLS 우회
      );

      if (!consentResult.success) {
        // 약관 동의 저장 실패는 로깅만 하고 회원가입은 성공으로 처리
        console.error("[auth] 약관 동의 저장 실패:", consentResult.error);
      }
    }

    // 회원가입 성공 - 이메일 확인 대기 페이지로 리다이렉트
    return {
      message: "회원가입이 완료되었습니다.",
      redirect: `/signup/verify-email?email=${encodeURIComponent(validation.data.email)}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "회원가입에 실패했습니다.",
    };
  }
}

/**
 * 이메일 확인 메일 재발송
 */
export async function resendConfirmationEmail(
  email: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = await getEmailRedirectUrl();

    if (process.env.NODE_ENV === "development") {
      console.log("[auth] 이메일 재발송 요청");
    }

    // 이메일 재발송 시도
    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: emailRedirectTo,
      },
    });

    if (error) {
      // 이미 인증된 사용자인 경우
      if (
        error.message?.toLowerCase().includes("already confirmed") ||
        error.message?.toLowerCase().includes("already verified") ||
        error.message?.toLowerCase().includes("user already registered")
      ) {
        return {
          success: false,
          error: "이 계정은 이미 인증되었습니다. 로그인을 시도해주세요.",
        };
      }

      // 다른 에러
      console.error("[auth] 이메일 재발송 실패:", error);
      return {
        success: false,
        error: error.message || "이메일 재발송에 실패했습니다.",
      };
    }

    return {
      success: true,
      message: "인증 메일을 재발송했습니다. 이메일을 확인해주세요. (스팸 메일함도 확인해주세요)",
    };
  } catch (error) {
    console.error("[auth] 이메일 재발송 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "이메일 재발송에 실패했습니다.",
    };
  }
}

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

// 에러 핸들링 래퍼 적용
export const signOut = withErrorHandling(_signOut);

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function sendPasswordResetEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
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
 * 비밀번호 업데이트 (비밀번호 재설정 플로우에서 사용)
 */
export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
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

    // 비밀번호 변경 후 로그아웃 (새 비밀번호로 다시 로그인하도록)
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
