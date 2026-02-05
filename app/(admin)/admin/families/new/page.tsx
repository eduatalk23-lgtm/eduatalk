import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateFamilyForm } from "../_components/CreateFamilyForm";

export const metadata = {
  title: "가족 생성 | 관리자",
};

export default async function CreateFamilyPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/admin/families" className="hover:text-gray-700 dark:hover:text-gray-300">
          가족 관리
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">새 가족 생성</span>
      </nav>

      {/* Header */}
      <PageHeader
        title="새 가족 생성"
        description="형제자매와 학부모를 그룹화할 새 가족을 생성합니다"
      />

      {/* Form */}
      <CreateFamilyForm />
    </div>
  );
}
