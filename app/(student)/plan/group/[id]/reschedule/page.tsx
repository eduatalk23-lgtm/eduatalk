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

type ReschedulePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReschedulePage({
  params,
}: ReschedulePageProps) {
  const { id } = await params;

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
  const { data: existingPlans } = await supabase
    .from("student_plan")
    .select("id, status, is_active, content_id")
    .eq("plan_group_id", id)
    .eq("student_id", user.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                플랜 그룹 재조정
              </h1>
              <p className="mt-1 text-sm text-gray-600">
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
        />
      </div>
    </div>
  );
}

