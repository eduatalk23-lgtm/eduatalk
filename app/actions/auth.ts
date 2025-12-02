"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { saveUserSession } from "@/lib/auth/sessionManager";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

async function _signIn(formData: FormData): Promise<{ error?: string; needsEmailVerification?: boolean; email?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const rememberMe = formData.get("rememberMe") === "on";

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

  // 로그인 성공 시 세션 정보 저장
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

  // 로그인 성공 시 루트 페이지로 리다이렉트 (역할별 리다이렉트는 루트 페이지에서 처리)
  redirect("/");
}

// 에러 핸들링 래퍼 적용
// _signIn은 이제 객체를 반환할 수 있으므로 직접 export
export const signIn = _signIn;

const signUpSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  displayName: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
  tenantId: z.string().min(1, "기관을 선택해주세요.").optional(),
});

export async function signUp(
  prevState: { error?: string; message?: string } | null,
  formData: FormData
): Promise<{ error?: string; message?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();

  // 입력 검증
  const validation = signUpSchema.safeParse({ email, password, displayName, tenantId });
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { error: firstError?.message || "모든 필드를 올바르게 입력해주세요." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: {
          display_name: validation.data.displayName,
          tenant_id: validation.data.tenantId || null, // 기관 ID를 user_metadata에 저장
        },
      },
    });

    if (error) {
      return { error: error.message || "회원가입에 실패했습니다." };
    }

    // 회원가입 성공 - 이메일 확인 안내와 함께 리다이렉트
    return {
      message:
        "회원가입이 완료되었습니다. 가입하신 이메일 주소로 인증 메일을 발송했습니다. 이메일을 확인하여 계정을 활성화해주세요.",
      redirect: "/login",
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
    
    console.log("[auth] 이메일 재발송 요청:", email);

    // 이메일 재발송 시도
    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email: email,
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
