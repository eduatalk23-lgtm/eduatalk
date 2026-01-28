"use client";

import { PlanHistoryViewer } from "../PlanHistoryViewer";
import { DeletedPlansView } from "../DeletedPlansView";
import { DeletedPlanGroupsView } from "../DeletedPlanGroupsView";
import { useAdminPlanBasic, useAdminPlanFilter } from "../context/AdminPlanContext";

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
 *
 * 성능 최적화: Modal 상태 변경에 리렌더링되지 않음
 */
export function HistoryTab({ tab: _tab }: HistoryTabProps) {
  const { studentId, selectedPlannerId } = useAdminPlanBasic();
  const { handleRefresh } = useAdminPlanFilter();

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
          plannerId={selectedPlannerId}
          onRefresh={handleRefresh}
        />
      </section>
    </div>
  );
}
