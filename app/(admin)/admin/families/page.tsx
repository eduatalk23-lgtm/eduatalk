import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { listFamilies } from "@/lib/domains/family";
import { PageHeader } from "@/components/layout/PageHeader";
import { FamilyListClient } from "./_components/FamilyListClient";

export const metadata = {
  title: "가족 관리 | 관리자",
};

export default async function FamiliesPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const result = await listFamilies({ limit: 50 });
  const families = result.success ? result.data?.items || [] : [];
  const totalCount = result.success ? result.data?.totalCount || 0 : 0;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="가족 관리"
          description="형제자매와 학부모를 가족 그룹으로 관리합니다"
        />
        <Link
          href="/admin/families/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          가족 생성
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            전체 가족
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            학생이 있는 가족
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {families.filter((f) => f.studentCount > 0).length}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            학부모가 있는 가족
          </div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {families.filter((f) => f.parentCount > 0).length}
          </div>
        </div>
      </div>

      {/* Family List */}
      <FamilyListClient initialFamilies={families} />
    </div>
  );
}
