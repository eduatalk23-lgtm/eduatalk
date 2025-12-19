/**
 * 관리자용 플랜 그룹 재조정 페이지
 *
 * 관리자가 학생의 플랜 그룹을 재조정할 수 있는 페이지입니다.
 * 학생용 재조정 페이지와 동일한 UI를 사용하되, 관리자 컨텍스트를 전달합니다.
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanGroupWithDetailsByRole, verifyPlanGroupAccess } from "@/lib/auth/planGroupAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminRescheduleWizard } from "./_components/AdminRescheduleWizard";
import { getContainerClass } from "@/lib/constants/layout";

type AdminReschedulePageProps = {
  params: Promise<{ id: string; groupId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    suggestion?: string;
    priority?: string;
  }>;
};

export default async function AdminReschedulePage({
  params,
  searchParams,
}: AdminReschedulePageProps) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, groupId } = await params;
  const searchParamsData = await searchParams;

  // 권한 검증
  const access = await verifyPlanGroupAccess();
  const tenantContext = await getTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents } = await getPlanGroupWithDetailsByRole(
    groupId,
    access.user.userId,
    access.role,
    tenantContext?.tenantId || null
  );

  if (!group) {
    notFound();
  }

  // 템플릿 ID 일치 확인
  if (group.camp_template_id !== templateId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // 기존 플랜 조회 (재조정 대상 확인용)
  const { data: existingPlans } = await supabase
    .from("student_plan")
    .select("id, status, is_active, content_id, plan_date")
    .eq("plan_group_id", groupId)
    .eq("student_id", group.student_id);

  // URL 쿼리 파라미터에서 날짜 범위 파싱
  let initialDateRange: { from: string; to: string } | null = null;
  if (searchParamsData.from && searchParamsData.to) {
    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      dateRegex.test(searchParamsData.from) &&
      dateRegex.test(searchParamsData.to) &&
      searchParamsData.from <= searchParamsData.to
    ) {
      initialDateRange = {
        from: searchParamsData.from,
        to: searchParamsData.to,
      };
    }
  }

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/camp-templates/${templateId}/participants/student/${group.student_id}`}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              참여자 상세로 돌아가기
            </Link>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-gray-900">
                플랜 그룹 재조정 (관리자)
              </h1>
              <p className="text-sm text-gray-600">
                {group.name || "이름 없음"}
              </p>
            </div>
          </div>
        </div>

        {/* Wizard */}
        <AdminRescheduleWizard
          groupId={groupId}
          templateId={templateId}
          group={group}
          contents={contents}
          existingPlans={existingPlans || []}
          initialDateRange={initialDateRange}
        />
      </div>
    </div>
  );
}

