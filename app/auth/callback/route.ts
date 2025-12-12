import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/errors";
import { getAuthErrorMessage } from "@/lib/auth/authErrorMessages";

/**
 * Supabase 이메일 인증 콜백 라우트
 * 
 * 이메일 인증 링크를 클릭한 후 Supabase에서 리다이렉트되는 엔드포인트입니다.
 * 인증 코드를 세션으로 교환하고 사용자를 적절한 페이지로 리다이렉트합니다.
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

    // 인증 코드를 세션으로 교환
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    // 인증 성공
    if (!error && data?.session) {
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

    // 인증 실패 - 에러 로깅 및 사용자 친화적 메시지 생성
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

    // 예상치 못한 상황 (에러도 없고 세션도 없는 경우)
    logError(new Error("인증 처리 중 예상치 못한 상황 발생"), {
      route: "/auth/callback",
      url: request.url,
      searchParams: Object.fromEntries(searchParams),
      hasData: !!data,
      hasSession: !!data?.session,
      timestamp: new Date().toISOString(),
    });

    const errorMessage = encodeURIComponent("인증 처리 중 오류가 발생했습니다.");
    return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
  } catch (error) {
    // 예상치 못한 예외 처리
    logError(error, {
      route: "/auth/callback",
      url: request.url,
      errorType: "unexpected_exception",
      timestamp: new Date().toISOString(),
    });

    const errorMessage = encodeURIComponent("인증 처리 중 오류가 발생했습니다.");
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
  }
}

