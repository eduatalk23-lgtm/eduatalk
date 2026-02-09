import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 초대 토큰을 처리하여 팀에 합류시키는 헬퍼 함수
 * OAuth 콜백에서 invite_token이 있을 때 호출됨
 */
async function processInviteToken(
  token: string,
  user: { id: string; email?: string; user_metadata?: Record<string, string> }
): Promise<boolean> {
  try {
    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 유효하지 않은 초대 토큰 형식:", token);
      }
      return false;
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return false;

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await adminClient
      .from("team_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (fetchError || !invitation) {
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 초대 조회 실패:", fetchError?.message);
      }
      return false;
    }

    // 만료 확인
    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from("team_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 초대 만료됨");
      }
      return false;
    }

    // 이미 해당 테넌트의 팀원인지 확인
    const { data: existingMember } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .eq("tenant_id", invitation.tenant_id)
      .maybeSingle();

    if (existingMember) {
      // 이미 팀원이면 초대만 수락 처리
      await adminClient
        .from("team_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invitation.id);
      return true;
    }

    // 사용자 이름 결정
    const userName =
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "사용자";

    // admin_users에 역할 부여
    const { error: insertError } = await adminClient.from("admin_users").insert({
      id: user.id,
      role: invitation.role,
      tenant_id: invitation.tenant_id,
      name: userName,
    });

    if (insertError) {
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] admin_users INSERT 실패:", insertError.message);
      }
      return false;
    }

    // 초대 상태 업데이트
    await adminClient
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invitation.id);

    if (process.env.NODE_ENV === "development") {
      console.log("[auth/callback] 초대 수락 성공:", {
        userId: user.id,
        tenantId: invitation.tenant_id,
        role: invitation.role,
      });
    }

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/callback] 초대 처리 중 에러:", error);
    }
    return false;
  }
}

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
  const type = searchParams.get("type"); // 인증 타입 (recovery, signup 등)
  const connectionCode = searchParams.get("connection_code"); // 회원가입 시 연결 코드
  const inviteToken = searchParams.get("invite_token"); // 팀 초대 토큰
  let next = searchParams.get("next") ?? "/";

  // 상대 경로가 아닌 경우 기본값 사용 (보안)
  if (!next.startsWith("/")) {
    next = "/";
  }

  // 비밀번호 리셋 플로우: recovery 타입인 경우 비밀번호 변경 페이지로 리다이렉트
  if (type === "recovery") {
    next = "/reset-password?from_callback=true";
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

  // 코드가 있으면 세션으로 교환 후 리다이렉트
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      // 개발 환경에서 디버깅용 로그
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 코드 교환 실패:", {
          error: exchangeError.message,
          code: exchangeError.name,
        });
      }

      // PKCE code_verifier 누락 에러인 경우 (다른 브라우저에서 이메일 링크 클릭)
      const isPKCEError = exchangeError.message?.includes("code verifier") ||
        exchangeError.message?.includes("code_verifier");

      if (isPKCEError) {
        // 비밀번호 재설정 플로우인 경우: 다시 요청하도록 안내
        if (type === "recovery") {
          const errorMessage = encodeURIComponent("링크가 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.");
          next = `/forgot-password?error=${errorMessage}`;
          return redirectToNext();
        }

        // 일반 이메일 인증: 로그인 페이지로 리다이렉트
        const successMessage = encodeURIComponent("이메일 인증이 완료되었습니다. 로그인해주세요.");
        next = `/login?message=${successMessage}`;
        return redirectToNext();
      }

      // 다른 에러의 경우 세션이 이미 있을 수 있으므로 리다이렉트 시도
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 코드 교환 성공, 세션 생성됨");
      }

      // 세션 정보를 확인하여 recovery 여부 판단
      const session = data?.session;
      const user = session?.user;

      // OAuth 로그인인 경우 역할 확인
      if (user) {
        const provider = user.app_metadata?.provider;
        const isOAuth = provider && provider !== "email";

        if (isOAuth) {
          // 역할 테이블에서 사용자 확인
          const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          const { data: parent } = await supabase
            .from("parent_users")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          const { data: admin } = await supabase
            .from("admin_users")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          // 역할이 없으면 초대 토큰 확인 후 역할 선택 페이지로 리다이렉트
          if (!student && !parent && !admin) {
            // 초대 토큰이 있으면 초대 수락 처리
            if (inviteToken) {
              const accepted = await processInviteToken(inviteToken, user);
              if (accepted) {
                next = "/admin/dashboard";
                return redirectToNext();
              }
              // 실패 시 초대 페이지로 리다이렉트 (로그인된 상태이므로 수동 수락 가능)
              next = `/invite/${inviteToken}`;
              return redirectToNext();
            }

            if (process.env.NODE_ENV === "development") {
              console.log("[auth/callback] OAuth 사용자 역할 없음, 역할 선택 페이지로 리다이렉트");
            }
            // 연결 코드가 있으면 함께 전달
            next = connectionCode
              ? `/onboarding/select-role?code=${encodeURIComponent(connectionCode)}`
              : "/onboarding/select-role";
            return redirectToNext();
          }

          // 이미 역할이 있지만 초대 토큰도 있는 경우 (기존 계정으로 다른 팀 초대 수락)
          if (inviteToken) {
            const accepted = await processInviteToken(inviteToken, user);
            if (accepted) {
              next = "/admin/dashboard";
              return redirectToNext();
            }
            next = `/invite/${inviteToken}`;
            return redirectToNext();
          }
        }
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] 세션 정보:", {
          user_id: session?.user?.id,
          user_amr: (session?.user as { amr?: unknown } | undefined)?.amr,
          session_amr: (session as { amr?: unknown })?.amr,
          aal: (session as { aal?: unknown })?.aal,
          app_metadata: session?.user?.app_metadata,
          user_metadata: session?.user?.user_metadata,
        });
      }

      // Supabase는 password recovery 시 user.app_metadata.provider = 'email'
      // 그리고 user.recovery_sent_at이 최근인지 확인
      // 또는 session.amr 배열에 recovery 메서드가 있는지 확인
      const sessionAny = session as { amr?: Array<{ method: string }> };
      const userAny = session?.user as { amr?: Array<{ method: string }> };

      const amr = sessionAny?.amr || userAny?.amr;
      const isRecoveryAmr = amr?.some(
        (method) => method.method === "recovery" || method.method === "otp"
      );

      // recovery_sent_at이 최근 10분 이내인지 확인 (fallback)
      const recoverySentAt = session?.user?.recovery_sent_at;
      const isRecentRecovery = recoverySentAt &&
        (Date.now() - new Date(recoverySentAt).getTime()) < 10 * 60 * 1000;

      if (process.env.NODE_ENV === "development") {
        console.log("[auth/callback] Recovery 확인:", {
          amr,
          isRecoveryAmr,
          recoverySentAt,
          isRecentRecovery
        });
      }

      // recovery 플로우인 경우 비밀번호 변경 페이지로 리다이렉트
      if (isRecoveryAmr || isRecentRecovery) {
        next = "/reset-password";
      }
    }

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
