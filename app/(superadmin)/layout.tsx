import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: superadmin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1">{children}</main>
    </div>
  );
}

