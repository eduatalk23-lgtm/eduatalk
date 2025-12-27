import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTemplatePlanGroups } from "@/lib/domains/plan/actions";
import { getContentPlanGroupCount } from "@/lib/domains/plan/actions/contentPlanGroup";
import { getContainerClass } from "@/lib/constants/layout";
import { ContentAddHub } from "./_components/ContentAddHub";

export default async function ContentAddPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 템플릿(위저드 플랜그룹) 목록 조회
  const templates = await getTemplatePlanGroups();

  // 현재 콘텐츠 플랜그룹 개수 조회
  const contentCount = await getContentPlanGroupCount();

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <div className="py-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          콘텐츠 추가
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          학습할 콘텐츠를 추가하는 방법을 선택하세요.
        </p>
        <ContentAddHub
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
          }))}
          contentCount={contentCount}
          studentId={user.userId}
          tenantId={user.tenantId ?? ""}
        />
      </div>
    </div>
  );
}
