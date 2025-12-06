"use client";

import { useState } from "react";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { DailyPlanView } from "./DailyPlanView";
import { SinglePlanView } from "./SinglePlanView";
import { PlanGroup } from "../_utils/planGroupUtils";

type TodayPlanListViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string;
  memos: Map<number | null, string | null>; // planNumber -> memo
  totalPagesMap: Map<string, number>; // contentKey -> totalPages
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
  serverNow?: number;
  campMode?: boolean; // 캠프 모드 여부
};

export function TodayPlanListView({
  groups,
  sessions,
  planDate,
  memos,
  totalPagesMap,
  initialMode = "single",
  initialSelectedPlanNumber = null,
  serverNow = Date.now(),
  campMode = false,
}: TodayPlanListViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [selectedPlanNumber, setSelectedPlanNumber] = useState<number | null>(
    initialSelectedPlanNumber ?? groups[0]?.planNumber ?? null
  );

  const handleViewDetail = (planNumber: number | null) => {
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "single" && !selectedPlanNumber) {
      // 단일 뷰로 전환할 때 선택된 플랜이 없으면 첫 번째 플랜 선택
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-end">
        <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      </div>

      {viewMode === "daily" ? (
        <DailyPlanView
          groups={groups}
          sessions={sessions}
          planDate={planDate}
          memos={memos}
          totalPagesMap={totalPagesMap}
          onViewDetail={handleViewDetail}
          campMode={campMode}
        />
      ) : (
        <SinglePlanView
          groups={groups}
          selectedPlanNumber={selectedPlanNumber}
          onSelectPlan={setSelectedPlanNumber}
          sessions={sessions}
          planDate={planDate}
          serverNow={serverNow}
          campMode={campMode}
        />
      )}
    </div>
  );
}

