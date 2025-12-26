import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTemplatePlanGroups } from "@/lib/domains/plan/actions";
import { getContainerClass } from "@/lib/constants/layout";
import { TemplateSelector } from "./_components/TemplateSelector";

export default async function ContentAddPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 템플릿(위저드 플랜그룹) 목록 조회
  const templates = await getTemplatePlanGroups();

  if (templates.length === 0) {
    return (
      <div className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            콘텐츠 추가
          </h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              콘텐츠를 추가하려면 먼저 플랜 설정(위저드)을 생성해야 합니다.
            </p>
            <a
              href="/plan/new-group"
              className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              플랜 설정 생성하기
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <div className="py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          콘텐츠 추가
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          학습할 콘텐츠를 선택하고 설정을 상속받을 템플릿을 선택하세요.
        </p>
        <TemplateSelector templates={templates} />
      </div>
    </div>
  );
}
