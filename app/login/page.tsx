import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { userId, role } = await getCurrentUserRole();

  // 이미 인증된 사용자는 적절한 페이지로 리다이렉트
  if (userId) {
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
        // 로그인 페이지에 에러 메시지와 함께 표시
      } else {
        // 활성화된 학생은 대시보드로
        redirect("/dashboard");
      }
    } else if (role === "admin" || role === "consultant") {
      redirect("/admin/dashboard");
    } else if (role === "parent") {
      redirect("/parent/dashboard");
    } else {
      // role이 null이면 학생 설정 페이지로
      redirect("/student-setup");
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <LoginForm />
    </section>
  );
}
