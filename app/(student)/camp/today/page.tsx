import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { getCampTemplate } from "@/lib/data/campTemplates";
import { perfTime } from "@/lib/utils/perfLog";
import { getContainerClass } from "@/lib/constants/layout";
import { isCampMode } from "@/lib/plan/context";

export default async function CampTodayPage() {
  const pageTimer = perfTime("[camp/today] render - page");
  const { userId, role } = await getCachedUserRole();

  if (!userId || role !== "student") {
    pageTimer.end();
    redirect("/login");
  }

  // 활성화된 캠프 플랜 그룹 확인 및 템플릿 검증
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId: userId,
    status: "active",
  });

  const campModePlanGroups = allActivePlanGroups.filter((group) =>
    isCampMode(group)
  );

  const activeCampPlanGroups = await Promise.all(
    campModePlanGroups.map(async (group) => {
      if (group.camp_template_id) {
        const template = await getCampTemplate(group.camp_template_id);
        return template ? group : null;
      }
      return group;
    })
  ).then((groups) =>
    groups.filter(
      (group): group is NonNullable<typeof group> => group !== null
    )
  );

  if (activeCampPlanGroups.length === 0) {
    pageTimer.end();
    return (
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-gray-900">
                캠프 학습관리
              </h1>
              <p className="text-sm text-gray-600">
                캠프 플랜을 확인하고 학습을 진행하세요
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <h3 className="text-lg font-semibold text-gray-900">
                활성화된 캠프 플랜 그룹이 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                캠프 프로그램에 참여하고 플랜이 활성화되면 여기서 확인할 수
                있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const page = (
    <div className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900">캠프 학습관리</h1>
            <p className="text-sm text-gray-600">
              캠프 플랜을 확인하고 학습을 진행하세요
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {activeCampPlanGroups.length}개의 활성 캠프 플랜 그룹이 있습니다.
        </p>
      </div>
    </div>
  );
  pageTimer.end();
  return page;
}
