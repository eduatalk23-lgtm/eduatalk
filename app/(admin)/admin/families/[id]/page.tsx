import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getFamilyWithMembers } from "@/lib/domains/family";
import { PageHeader } from "@/components/layout/PageHeader";
import { FamilyDetailClient } from "../_components/FamilyDetailClient";

export const metadata = {
  title: "가족 상세 | 관리자",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FamilyDetailPage({ params }: Props) {
  const { id } = await params;
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const result = await getFamilyWithMembers(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const family = result.data;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/admin/families" className="hover:text-gray-700 dark:hover:text-gray-300">
          가족 관리
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">
          {family.familyName || "이름 없는 가족"}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={family.familyName || "이름 없는 가족"}
          description={
            family.primaryContactParent
              ? `주 연락처: ${family.primaryContactParent.name || "이름 없음"}`
              : "주 연락처 미지정"
          }
        />
      </div>

      {/* Content */}
      <FamilyDetailClient family={family} />
    </div>
  );
}
