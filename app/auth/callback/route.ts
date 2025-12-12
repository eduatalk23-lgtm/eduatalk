import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/errors";
import { getAuthErrorMessage } from "@/lib/auth/authErrorMessages";

/**
 * Supabase 이메일 인증 콜백 라우트
 * 
 * 이메일 인증 링크를 클릭한 후 Supabase에서 리다이렉트되는 엔드포인트입니다.
 * Supabase SSR은 쿠키를 통해 자동으로 세션을 관리하므로,
 * 세션이 없어도 Supabase가 자동으로 처리합니다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // "next" 파라미터가 있으면 해당 URL로, 없으면 루트로 리다이렉트
    let next = searchParams.get("next") ?? "/";
    
    // 상대 경로가 아닌 경우 기본값 사용 (보안)
    if (!next.startsWith("/")) {
      next = "/";
    }

    // 코드가 없는 경우
    if (!code) {
      logError(new Error("인증 코드가 없습니다"), {
        route: "/auth/callback",
        url: request.url,
        searchParams: Object.fromEntries(searchParams),
        timestamp: new Date().toISOString(),
      });
      
      const errorMessage = encodeURIComponent("인증 코드가 없습니다.");
      return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
    }

    // Supabase SSR 클라이언트 생성 (쿠키 자동 관리)
    // Supabase SSR은 이메일 인증 링크 클릭 시 자동으로 세션을 생성하므로,
    // 세션이 없어도 Supabase가 자동으로 처리합니다
    const supabase = await createSupabaseServerClient();
    
    // 세션 확인 시도 (에러가 발생해도 무시하고 리다이렉트)
    // Supabase SSR은 이메일 인증 링크 클릭 시 자동으로 처리하므로,
    // 세션이 없어도 Supabase가 자동으로 세션을 생성합니다
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // "Auth session missing" 에러는 무시 (Supabase가 자동으로 처리)
    // 실제로는 인증이 성공했을 수 있으므로 에러 메시지를 표시하지 않음
    const isSessionMissingError = 
      error?.message?.includes("Auth session missing") ||
      error?.name === "AuthSessionMissingError";
    
    // 인증 성공 또는 세션 미싱 에러인 경우 리다이렉트 (에러 메시지 없이)
    if ((!error && user) || isSessionMissingError) {
      // 프로덕션 환경에서 로드 밸런서를 고려한 리다이렉트 처리
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      
      if (isLocalEnv) {
        // 개발 환경: origin 사용
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // 프로덕션 환경: x-forwarded-host 사용 (로드 밸런서 고려)
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // 프로덕션 환경: origin 사용
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    // 세션 미싱 에러가 아닌 다른 에러인 경우에만 에러 처리
    if (error) {
      logError(error, {
        route: "/auth/callback",
        url: request.url,
        searchParams: Object.fromEntries(searchParams),
        errorMessage: error.message,
        errorStatus: error.status,
        errorCode: error.code,
        errorName: error.name,
        timestamp: new Date().toISOString(),
      });

      const userMessage = getAuthErrorMessage(error);
      const encodedMessage = encodeURIComponent(userMessage);
      return NextResponse.redirect(`${origin}/login?error=${encodedMessage}`);
    }

    // 예상치 못한 상황 (에러도 없고 사용자도 없는 경우)
    // 하지만 코드가 있으므로 Supabase가 자동으로 처리할 수 있도록 리다이렉트
    // 에러 메시지 없이 리다이렉트 (Supabase가 자동으로 처리)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    
    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } catch (error) {
    // 예상치 못한 예외 처리
    logError(error, {
      route: "/auth/callback",
      url: request.url,
      errorType: "unexpected_exception",
      timestamp: new Date().toISOString(),
    });

    // 예외가 발생해도 코드가 있으면 Supabase가 처리할 수 있도록 리다이렉트
    // 에러 메시지 없이 리다이렉트
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";
    
    if (code) {
      // 코드가 있으면 Supabase가 자동으로 처리할 수 있도록 리다이렉트
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    // 코드도 없고 예외도 발생한 경우에만 에러 메시지 표시
    const errorMessage = encodeURIComponent("인증 처리 중 오류가 발생했습니다.");
    return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
  }
}

