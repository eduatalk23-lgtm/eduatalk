import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 이메일 인증 콜백 라우트
 *
 * 이메일 인증 링크를 클릭한 후 Supabase에서 리다이렉트되는 엔드포인트입니다.
 * Supabase SSR은 쿠키를 통해 자동으로 세션을 관리하므로,
 * 코드가 있으면 리다이렉트만 수행합니다.
 * 첫 로그인 시 레코드 생성은 app/actions/auth.ts의 signIn에서 처리됩니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error"); // Supabase가 전달한 에러 파라미터
  const errorCode = searchParams.get("error_code"); // Supabase가 전달한 에러 코드 (예: otp_expired)
  let next = searchParams.get("next") ?? "/";

  // 상대 경로가 아닌 경우 기본값 사용 (보안)
  if (!next.startsWith("/")) {
    next = "/";
  }

  // 리다이렉트 헬퍼 함수
  const redirectToNext = () => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
      return NextResponse.redirect(`${origin}${next}`);
    }
  };

  // 코드가 있으면 Supabase SSR이 자동으로 세션을 처리하므로 에러 무시하고 리다이렉트
  // 타이밍 문제나 일시적인 에러는 무시 (흐름에 문제 없음)
  if (code) {
    return redirectToNext();
  }

  // 코드가 없어도 특정 에러는 무시 (타이밍 문제나 일시적인 에러)
  // Supabase 문서에 따르면 이메일 인증 콜백에서 access_denied, otp_expired 등은
  // 실제로는 세션이 이미 생성되어 있을 수 있음 (PKCE 플로우, 이메일 링크 만료 등)
  // 참고: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows
  if (error || errorCode) {
    const errorLower = (error || "").toLowerCase();
    const errorCodeLower = (errorCode || "").toLowerCase();

    // Supabase 문서 기반 무시 가능한 에러 목록
    // - access_denied: OAuth 플로우에서 사용자 거부 또는 타이밍 문제
    // - otp_expired: OTP 만료 (하지만 세션이 이미 생성되어 있을 수 있음)
    // - email link is invalid or has expired: 이메일 링크 만료
    const ignorableErrors = [
      "otp_expired",
      "access_denied",
      "인증에 실패했습니다",
      "email link is invalid or has expired",
      "token has expired or is invalid", // Supabase 문서에서 언급된 에러
    ];

    // error 또는 error_code 중 하나라도 무시 가능한 에러인지 확인
    const shouldIgnore =
      ignorableErrors.some((ignorable) =>
        errorLower.includes(ignorable.toLowerCase())
      ) ||
      ignorableErrors.some((ignorable) =>
        errorCodeLower.includes(ignorable.toLowerCase())
      );

    if (shouldIgnore) {
      // 세션 확인: 세션이 있으면 정상 리다이렉트, 없으면 에러 표시
      // Supabase SSR은 쿠키를 통해 자동으로 세션을 관리하므로,
      // getUser()로 세션 존재 여부를 확인할 수 있음
      try {
        const supabase = await createSupabaseServerClient();
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser();

        // 디버깅 로그
        if (process.env.NODE_ENV === "development") {
          console.log("[auth/callback] 세션 확인:", {
            hasUser: !!user,
            userId: user?.id,
            getUserError: getUserError?.message,
            error,
            errorCode,
          });
        }

        // 세션이 있으면 정상 리다이렉트 (에러 무시)
        // Supabase 문서: 세션이 이미 생성되어 있으면 에러를 무시하고 진행 가능
        if (user) {
          if (process.env.NODE_ENV === "development") {
            console.log("[auth/callback] 세션 확인 성공, 리다이렉트:", next);
          }
          return redirectToNext();
        }

        // getUser() 에러가 있지만 세션이 없는 경우
        // refresh token 에러는 세션이 아직 쿠키에 저장되지 않았을 수 있으므로
        // 에러를 무시하고 리다이렉트 (Supabase SSR이 자동으로 처리)
        if (getUserError) {
          const errorMessage = getUserError.message?.toLowerCase() || "";
          const isRefreshTokenError =
            errorMessage.includes("refresh token") ||
            errorMessage.includes("refresh_token") ||
            errorMessage.includes("session") ||
            errorMessage.includes("auth session missing");

          // refresh token 에러는 세션이 아직 쿠키에 저장되지 않았을 수 있으므로
          // 에러를 무시하고 리다이렉트 (Supabase SSR이 자동으로 처리)
          if (isRefreshTokenError) {
            if (process.env.NODE_ENV === "development") {
              console.log(
                "[auth/callback] refresh token 에러 감지, 에러 무시하고 리다이렉트"
              );
            }
            return redirectToNext();
          }

          // 다른 에러인 경우에만 로깅
          if (process.env.NODE_ENV === "development") {
            console.log(
              "[auth/callback] getUser 에러 (세션 없음):",
              getUserError
            );
          }
        }
      } catch (sessionError) {
        // 세션 확인 중 예외 발생 시에도 에러를 무시하고 리다이렉트
        // Supabase SSR이 자동으로 세션을 관리하므로 예외가 발생해도 정상 처리될 수 있음
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[auth/callback] 세션 확인 중 예외 발생, 에러 무시하고 리다이렉트:",
            sessionError
          );
        }
        // 예외가 발생해도 에러를 무시하고 리다이렉트
        return redirectToNext();
      }
    }
  }

  // 코드가 없고 무시할 수 없는 에러인 경우에만 에러 메시지 표시
  const errorMessage = error
    ? encodeURIComponent(error)
    : encodeURIComponent("인증 코드가 없습니다.");
  return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
}
