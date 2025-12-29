/**
 * 기존 플랜 그룹에 콘텐츠 추가 페이지
 *
 * 캘린더 전용(is_calendar_only=true) 또는 콘텐츠가 없는 플랜 그룹에
 * 콘텐츠를 추가하고 플랜을 생성하는 위저드
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getContainerClass } from "@/lib/constants/layout";
import { ArrowLeft } from "lucide-react";
import { AddContentWizard } from "./_components/AddContentWizard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AddContentPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const tenantContext = await getTenantContext();

  // 플랜 그룹 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(id, user.userId, tenantContext?.tenantId || null);

  if (!group) {
    notFound();
  }

  // 이미 콘텐츠가 있는 경우 상세 페이지로 리다이렉트
  if (contents.length > 0 && !group.is_calendar_only) {
    redirect(`/plan/group/${id}`);
  }

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link
            href={`/plan/group/${id}`}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            플랜 그룹으로 돌아가기
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            콘텐츠 추가
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {group.name || "이름 없음"}
            </span>
            에 학습할 콘텐츠를 추가하세요.
          </p>
        </div>

        {/* 위저드 */}
        <AddContentWizard
          groupId={id}
          group={group}
          exclusions={exclusions}
          academySchedules={academySchedules}
        />
      </div>
    </div>
  );
}
