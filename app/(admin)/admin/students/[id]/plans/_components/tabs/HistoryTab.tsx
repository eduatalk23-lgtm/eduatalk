"use client";

import { PlanHistoryViewer } from "../PlanHistoryViewer";
import { DeletedPlansView } from "../DeletedPlansView";
import { DeletedPlanGroupsView } from "../DeletedPlanGroupsView";
import { useAdminPlan } from "../context/AdminPlanContext";

interface HistoryTabProps {
  tab: "history";
}

/**
 * 히스토리 탭 컴포넌트
 *
 * 포함 컴포넌트:
 * - PlanHistoryViewer: 플랜 변경 이력
 * - DeletedPlansView: 삭제된 플랜 복구
 * - DeletedPlanGroupsView: 삭제된 플랜 그룹 복구
 */
export function HistoryTab({ tab: _tab }: HistoryTabProps) {
  const { studentId, selectedPlannerId, handleRefresh } = useAdminPlan();

  return (
    <div className="space-y-6">
      {/* 활동 히스토리 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">활동 이력</h2>
        <PlanHistoryViewer
          studentId={studentId}
          plannerId={selectedPlannerId}
          limit={50}
        />
      </section>

      {/* 삭제된 플랜 복구 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">
          삭제된 플랜
        </h2>
        <DeletedPlansView
          studentId={studentId}
          plannerId={selectedPlannerId}
          onRefresh={handleRefresh}
        />
      </section>

      {/* 삭제된 플랜 그룹 복구 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">
          삭제된 플랜 그룹
        </h2>
        <DeletedPlanGroupsView
          studentId={studentId}
          onRefresh={handleRefresh}
        />
      </section>
    </div>
  );
}
