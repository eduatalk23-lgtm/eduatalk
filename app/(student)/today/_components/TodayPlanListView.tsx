"use client";

import { useState } from "react";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { DailyPlanView } from "./DailyPlanView";
import { SinglePlanView } from "./SinglePlanView";
import { PlanGroup } from "../_utils/planGroupUtils";

type TodayPlanListViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean }>;
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
};

export function TodayPlanListView({
  groups,
  sessions,
  initialMode = "daily",
  initialSelectedPlanNumber = null,
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">오늘 플랜</h2>
        <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      </div>

      {viewMode === "daily" ? (
        <DailyPlanView
          groups={groups}
          sessions={sessions}
          onViewDetail={handleViewDetail}
        />
      ) : (
        <SinglePlanView
          groups={groups}
          selectedPlanNumber={selectedPlanNumber}
          onSelectPlan={setSelectedPlanNumber}
          sessions={sessions}
        />
      )}
    </div>
  );
}

