/**
 * 플랜 그룹 재조정 페이지
 *
 * 3단계 Wizard 형태로 재조정을 진행합니다.
 * - Step 1: 콘텐츠 선택
 * - Step 2: 상세 조정
 * - Step 3: 미리보기 & 확인
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { RescheduleWizard } from "./_components/RescheduleWizard";
import { getContainerClass } from "@/lib/constants/layout";

type ReschedulePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    suggestion?: string;
    priority?: string;
  }>;
};

export default async function ReschedulePage({
  params,
  searchParams,
}: ReschedulePageProps) {
  const { id } = await params;
  const searchParamsData = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents } = await getPlanGroupWithDetails(
    id,
    user.id,
    tenantContext?.tenantId || null
  );

  if (!group) {
    notFound();
  }

  // 기존 플랜 조회 (재조정 대상 확인용)
  // content_id와 함께 master_content_id도 조회하여 plan_contents와 매칭 가능하도록 함
  const { data: existingPlansRaw } = await supabase
    .from("student_plan")
    .select("id, status, is_active, content_id, content_type, plan_date")
    .eq("plan_group_id", id)
    .eq("student_id", user.id);

  // 콘텐츠 타입별로 master_content_id 조회
  const existingPlans = await Promise.all(
    (existingPlansRaw || []).map(async (plan) => {
      let masterContentId: string | null = null;

      if (plan.content_type === "lecture") {
        const { data: lecture } = await supabase
          .from("lectures")
          .select("master_lecture_id")
          .eq("id", plan.content_id)
          .maybeSingle();
        masterContentId = lecture?.master_lecture_id || null;
      } else if (plan.content_type === "book") {
        const { data: book } = await supabase
          .from("books")
          .select("master_book_id")
          .eq("id", plan.content_id)
          .maybeSingle();
        masterContentId = book?.master_book_id || null;
      }

      return {
        ...plan,
        master_content_id: masterContentId,
      };
    })
  );

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
              href={`/plan/group/${id}`}
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
              플랜 그룹 상세로 돌아가기
            </Link>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-gray-900">
                플랜 그룹 재조정
              </h1>
              <p className="text-sm text-gray-600">
                {group.name || "이름 없음"}
              </p>
            </div>
          </div>
        </div>

        {/* Wizard */}
        <RescheduleWizard
          groupId={id}
          group={group}
          contents={contents}
          existingPlans={existingPlans || []}
          initialDateRange={initialDateRange}
        />
      </div>
    </div>
  );
}
