import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams: Promise<{ returnUrl?: string; error?: string; message?: string }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const returnUrl = params.returnUrl;
  // getCurrentUserRole을 안전하게 호출 (에러 발생 시 null 반환)
  let userRole: { userId: string | null; role: string | null; tenantId: string | null } = {
    userId: null,
    role: null,
    tenantId: null,
  };

  try {
    userRole = await getCurrentUserRole();
  } catch (error) {
    // getCurrentUserRole 실패 시 조용히 처리 (로그인 페이지 표시)
    const errorMessage = error instanceof Error ? error.message : String(error);
    // 개발 환경에서만 로깅
    if (process.env.NODE_ENV === "development") {
      console.error("[LoginPage] 인증 확인 중 에러 (무시됨)", {
        message: errorMessage,
      });
    }
    // 에러가 있어도 로그인 페이지를 표시하기 위해 계속 진행
  }

  // 이미 인증된 사용자는 적절한 페이지로 리다이렉트
  if (userRole.userId && userRole.role) {
    // 학생인 경우 is_active 확인
    if (userRole.role === "student") {
      try {
        const supabase = await createSupabaseServerClient();
        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("is_active")
          .eq("id", userRole.userId)
          .maybeSingle();

        // 쿼리 에러가 발생한 경우에도 계속 진행 (로그인 페이지 표시)
        if (studentError) {
          if (process.env.NODE_ENV === "development") {
            console.error("[LoginPage] 학생 정보 조회 실패 (무시됨)", {
              message: studentError.message,
              code: studentError.code,
            });
          }
          // 에러가 있어도 로그인 페이지를 표시
        } else if (student && student.is_active === false) {
          // 비활성화된 학생인 경우 로그아웃
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            // 로그아웃 실패는 무시
          }
          // 로그인 페이지에 에러 메시지와 함께 표시
        } else if (student) {
          // 활성화된 학생은 대시보드로 (redirect는 try-catch 밖에서 호출)
          redirect("/dashboard");
        }
      } catch (queryError) {
        // redirect 에러인지 확인
        if (
          queryError &&
          typeof queryError === "object" &&
          "digest" in queryError &&
          typeof (queryError as { digest: string }).digest === "string"
        ) {
          const digest = (queryError as { digest: string }).digest;
          // Next.js의 리다이렉트 에러는 재throw
          if (digest.startsWith("NEXT_REDIRECT")) {
            throw queryError;
          }
        }
        // 쿼리 중 에러 발생 시 로그인 페이지 표시
        if (process.env.NODE_ENV === "development") {
          console.error("[LoginPage] 학생 정보 조회 중 예외 (무시됨)", queryError);
        }
      }
    } else if (userRole.role === "superadmin") {
      // Super Admin은 Super Admin 대시보드로 리다이렉트
      redirect("/superadmin/dashboard");
    } else if (userRole.role === "admin" || userRole.role === "consultant") {
      redirect("/admin/dashboard");
    } else if (userRole.role === "parent") {
      redirect("/parent/dashboard");
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <LoginForm returnUrl={returnUrl} />
    </section>
  );
}
