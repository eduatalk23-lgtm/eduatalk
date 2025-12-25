import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { PermissionSettingsForm } from "./_components/PermissionSettingsForm";

export const metadata = {
  title: "권한 설정 | 설정",
  description: "상담사 역할의 권한을 설정합니다.",
};

export default async function PermissionSettingsPage() {
  const { userId, role, tenantId } = await getCurrentUserRole();

  // admin 또는 superadmin만 접근 가능
  if (!userId || (role !== "admin" && role !== "superadmin")) {
    redirect("/login");
  }

  // 테넌트가 없는 경우 (superadmin)
  if (!tenantId) {
    return (
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/settings"
            className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
          >
            ← 설정으로 돌아가기
          </Link>
          <h1 className="text-h1 text-gray-900 dark:text-gray-100">권한 설정</h1>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Super Admin은 특정 테넌트를 선택하여 권한을 설정할 수 있습니다.
            각 테넌트의 설정 페이지에서 권한을 관리해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/settings"
          className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
        >
          ← 설정으로 돌아가기
        </Link>
        <h1 className="text-h1 text-gray-900 dark:text-gray-100">권한 설정</h1>
        <p className="text-body-2 text-gray-600 dark:text-gray-400">
          상담사 역할이 수행할 수 있는 작업을 설정합니다.
        </p>
      </div>

      <PermissionSettingsForm tenantId={tenantId} />
    </div>
  );
}
