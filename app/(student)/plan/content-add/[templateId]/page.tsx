import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getTemplateSettings,
  getContentPlanGroupCount,
} from "@/lib/domains/plan/actions";
import { getContainerClass } from "@/lib/constants/layout";
import { ContentAddWizard } from "./_components/ContentAddWizard";

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
    return (
      <div className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            콘텐츠 추가
          </h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-200">
              콘텐츠별 플랜그룹은 최대 {countInfo.max}개까지 생성할 수 있습니다.
              <br />
              기존 플랜그룹을 완료하거나 삭제한 후 다시 시도해주세요.
            </p>
            <a
              href="/plan"
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              플랜 목록으로
            </a>
          </div>
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
