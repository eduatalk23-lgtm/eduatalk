import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getTemplateSettings,
  getContentPlanGroupCount,
} from "@/lib/domains/plan/actions";
import { getNearCompletionPlanGroups } from "@/lib/domains/plan/actions/contentPlanGroup";
import { getContainerClass } from "@/lib/constants/layout";
import { ContentAddWizard } from "./_components/ContentAddWizard";
import { LimitReachedGuide } from "../../_components/LimitReachedGuide";

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function ContentAddWizardPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { templateId } = await params;

  // 템플릿 설정 조회
  const templateSettings = await getTemplateSettings({
    templatePlanGroupId: templateId,
    includeExclusions: true,
    includeAcademySchedules: true,
  });

  if (!templateSettings) {
    notFound();
  }

  // 9개 제한 체크
  const countInfo = await getContentPlanGroupCount();

  if (!countInfo.canAdd) {
    // 완료 가능한 플랜그룹 조회 (95% 이상 진행)
    const nearCompletionGroups = await getNearCompletionPlanGroups();

    return (
      <div className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="py-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            콘텐츠 추가
          </h1>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            플랜그룹 한도에 도달하여 새 콘텐츠를 추가할 수 없습니다.
          </p>
          <LimitReachedGuide
            current={countInfo.current}
            max={countInfo.max}
            nearCompletionGroups={nearCompletionGroups}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <ContentAddWizard
        templateId={templateId}
        templateSettings={templateSettings}
        remainingSlots={countInfo.remaining}
      />
    </div>
  );
}
