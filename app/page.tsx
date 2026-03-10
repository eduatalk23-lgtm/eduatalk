import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/constants/routes";

const META_TITLE = "TimeLevelUp - AI 맞춤형 학습 관리 시스템";
const META_DESCRIPTION =
  "13년 입시 전문 노하우와 AI 기술이 만든 학습 플래너. 학습 플랜 생성부터 성적 분석, 진도 관리까지 한번에 해결하세요.";

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

  // 비인증 사용자 → 로그인 페이지
  if (!userId) {
    redirect("/login");
  }

  // 역할별 is_active 확인 (superadmin은 시스템 계정이므로 제외)
  if (role === "superadmin") {
    redirect("/superadmin/dashboard");
  }

  const supabaseForCheck = await createSupabaseServerClient();

  if (role === "student") {
    const { data: student } = await supabaseForCheck
      .from("students")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    if (student && student.is_active === false) {
      await supabaseForCheck.auth.signOut().catch(() => {});
      redirect("/login?error=account_deactivated");
    }
  } else if (role === "parent") {
    const { data: parent } = await supabaseForCheck
      .from("parent_users")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    if (parent && parent.is_active === false) {
      await supabaseForCheck.auth.signOut().catch(() => {});
      redirect("/login?error=account_deactivated");
    }
  } else if (role === "admin" || role === "consultant") {
    const { data: adminUser } = await supabaseForCheck
      .from("admin_users")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    if (adminUser && adminUser.is_active === false) {
      await supabaseForCheck.auth.signOut().catch(() => {});
      redirect("/login?error=account_deactivated");
    }
  }

  // 역할에 따라 리다이렉트 (superadmin은 위에서 이미 처리)
  if (role === "admin" || role === "consultant") {
    redirect("/admin/dashboard");
  } else if (role === "parent") {
    redirect("/parent/dashboard");
  } else if (role === "student") {
    redirect("/plan/calendar");
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
