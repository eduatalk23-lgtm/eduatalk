import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { getContainerClass } from "@/lib/constants/layout";
import { AdjustDashboard } from "./_components/AdjustDashboard";

export default async function AdjustPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  // 활성화된 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId: userId,
    status: "active",
  });

  // 일반 모드 플랜 그룹만 필터링 (캠프 모드 제외)
  const normalPlanGroups = activePlanGroups.filter(
    (group) =>
      group.plan_type !== "camp" &&
      group.camp_template_id === null &&
      group.camp_invitation_id === null
  );

  if (normalPlanGroups.length === 0) {
    return (
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              플랜 재조정
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              플랜 일정을 드래그하여 재배치하고 학습량을 조절할 수 있습니다.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">
              활성화된 플랜 그룹이 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              플랜 그룹을 먼저 생성해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            플랜 재조정
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            플랜 일정을 드래그하여 재배치하고 학습량을 조절할 수 있습니다.
          </p>
        </div>

        <AdjustDashboard
          planGroups={normalPlanGroups.map((g) => ({
            id: g.id,
            name: g.name || "이름 없음",
          }))}
          defaultPlanGroupId={normalPlanGroups[0].id}
        />
      </div>
    </div>
  );
}
