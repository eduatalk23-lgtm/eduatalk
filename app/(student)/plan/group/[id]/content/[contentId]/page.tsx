import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPlansByPlanContent } from "@/lib/data/planContents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanBreadcrumb } from "@/components/plan/PlanBreadcrumb";
import { createContentBreadcrumb } from "@/lib/utils/breadcrumb";
import { ContentDetailView } from "./_components/ContentDetailView";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type PageProps = {
  params: Promise<{ id: string; contentId: string }>;
};

async function getPlanGroupInfo(planGroupId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_groups")
    .select("id, name, student_id")
    .eq("id", planGroupId)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { id: planGroupId, contentId } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    notFound();
  }

  // 플랜 그룹 정보 조회
  const planGroup = await getPlanGroupInfo(planGroupId);
  if (!planGroup) {
    notFound();
  }

  // 권한 확인: 본인의 플랜 그룹인지
  if (planGroup.student_id !== user.userId) {
    notFound();
  }

  // 콘텐츠 및 플랜 목록 조회
  const { content, plans, stats } = await getPlansByPlanContent(planGroupId, contentId);

  if (!content) {
    notFound();
  }

  // 브레드크럼 생성
  const contentTitle = plans[0]?.content_title || `콘텐츠 ${content.display_order + 1}`;
  const breadcrumbItems = createContentBreadcrumb(
    planGroup.name || "플랜 그룹",
    planGroupId,
    contentTitle,
    content.content_type as "book" | "lecture" | "custom"
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* 브레드크럼 */}
      <PlanBreadcrumb items={breadcrumbItems} />

      {/* 콘텐츠 상세 정보 */}
      <Suspense fallback={<SuspenseFallback />}>
        <ContentDetailView
          content={content}
          contentTitle={contentTitle}
          plans={plans}
          stats={stats}
          planGroupId={planGroupId}
        />
      </Suspense>
    </div>
  );
}
