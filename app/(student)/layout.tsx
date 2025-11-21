export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: student만 접근 가능
  if (!userId || role !== "student") {
    console.log("[student/layout] 접근 거부", { userId, role });
    redirect("/login");
  }

  return (
    <RoleBasedLayout
      role="student"
      dashboardHref="/dashboard"
      roleLabel="학생"
      wrapper={(content) => <ToastProvider>{content}</ToastProvider>}
    >
      {children}
    </RoleBasedLayout>
  );
}
