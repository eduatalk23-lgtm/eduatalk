import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 이메일 인증 콜백 라우트
 * 
 * 이메일 인증 링크를 클릭한 후 Supabase에서 리다이렉트되는 엔드포인트입니다.
 * 인증 코드를 세션으로 교환하고 사용자를 적절한 페이지로 리다이렉트합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // "next" 파라미터가 있으면 해당 URL로, 없으면 루트로 리다이렉트
  let next = searchParams.get("next") ?? "/";
  
  // 상대 경로가 아닌 경우 기본값 사용 (보안)
  if (!next.startsWith("/")) {
    next = "/";
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // 인증 성공 시 리다이렉트
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
  }

  // 인증 실패 시 로그인 페이지로 리다이렉트 (에러 메시지 포함)
  return NextResponse.redirect(`${origin}/login?error=인증에 실패했습니다.`);
}

