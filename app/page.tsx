
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LandingPage from "./_components/landing/LandingPage";

const META_TITLE = "TimeLevelUp - AI 맞춤형 학습 관리 시스템";
const META_DESCRIPTION =
  "13년 입시 전문 노하우와 AI 기술이 만든 학습 플래너. 학습 플랜 생성부터 성적 분석, 진도 관리까지 한번에 해결하세요.";
const SITE_URL = "https://timelevelup.com";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: META_TITLE,
    description: META_DESCRIPTION,
    openGraph: {
      title: META_TITLE,
      description: META_DESCRIPTION,
      url: SITE_URL,
      siteName: "TimeLevelUp",
      type: "website",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: META_TITLE,
      description: META_DESCRIPTION,
    },
    keywords: [
      "학습 플래너",
      "AI 학습",
      "입시",
      "학습 관리",
      "맞춤형 학습",
      "성적 분석",
      "학습 타이머",
      "TimeLevelUp",
    ],
    robots: { index: true, follow: true },
    alternates: { canonical: SITE_URL },
  };
}

export default async function Home() {
  const { userId, role } = await getCurrentUserRole();

  // 비인증 사용자 → 랜딩 페이지
  if (!userId) {
    return <LandingPage />;
  }

  // 학생인 경우 is_active 확인
  if (role === "student") {
    const supabase = await createSupabaseServerClient();
    const { data: student } = await supabase
      .from("students")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    // 비활성화된 학생인 경우 로그아웃하고 에러 메시지와 함께 로그인 페이지로 리다이렉트
    if (student && student.is_active === false) {
      await supabase.auth.signOut();
      redirect("/login?error=계정이 비활성화되었습니다. 관리자에게 문의하세요.");
    }
  }

  // 역할에 따라 리다이렉트
  if (role === "superadmin") {
    // Super Admin은 Super Admin 대시보드로 리다이렉트
    redirect("/superadmin/dashboard");
  } else if (role === "admin" || role === "consultant") {
    redirect("/admin/dashboard");
  } else if (role === "parent") {
    redirect("/parent/dashboard");
  } else if (role === "student") {
    redirect("/dashboard");
  } else {
    // role이 null이면 user_metadata에서 signup_role 확인하여 초기 설정 페이지로 리다이렉트
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    // refresh token 에러는 조용히 처리 (세션이 없는 것으로 간주)
    if (getUserError) {
      const errorMessage = getUserError.message?.toLowerCase() || "";
      const errorCode = getUserError.code?.toLowerCase() || "";
      
      const isRefreshTokenError = 
        errorMessage.includes("refresh token") ||
        errorMessage.includes("refresh_token") ||
        errorMessage.includes("session") ||
        errorCode === "refresh_token_not_found";
      
      if (!isRefreshTokenError) {
        console.error("[auth] getUser 실패", {
          message: getUserError.message,
          status: getUserError.status,
          code: getUserError.code,
        });
      }
      
      // 세션이 없으면 로그인 페이지로 리다이렉트
      redirect("/login");
    }
    
    if (user?.user_metadata?.signup_role === "parent") {
      // 학부모 초기 설정 페이지로 리다이렉트 (향후 구현)
      redirect("/parent/settings");
    } else {
      // 학생 초기 설정 페이지로 리다이렉트 (기본값)
      redirect("/settings");
    }
  }
}
