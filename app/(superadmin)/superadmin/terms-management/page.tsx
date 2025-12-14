export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { TermsManagementContent } from "./_components/TermsManagementContent";

export default async function TermsManagementPage() {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">약관 관리</h1>
        <p className="text-sm text-gray-600">
          이용약관, 개인정보취급방침, 마케팅 활용 동의 내용을 관리합니다.
        </p>
      </div>

      <TermsManagementContent />
    </div>
  );
}

