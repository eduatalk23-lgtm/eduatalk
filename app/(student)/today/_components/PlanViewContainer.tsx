"use client";

import { useState } from "react";
import { SinglePlanView } from "./SinglePlanView";
import { DailyPlanListView } from "./DailyPlanListView";
import { ViewModeSelector } from "./ViewModeSelector";

export type ViewMode = "single" | "daily";

type PlanViewContainerProps = {
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
};

export function PlanViewContainer({
  initialMode = "daily",
  initialSelectedPlanNumber = null,
}: PlanViewContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [selectedPlanNumber, setSelectedPlanNumber] = useState<number | null>(
    initialSelectedPlanNumber
  );

  const handleViewDetail = (planNumber: number | null) => {
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "single" && !selectedPlanNumber) {
      // 단일 뷰로 전환할 때 선택된 플랜이 없으면 첫 번째 플랜 선택
      setSelectedPlanNumber(null); // 데이터 로딩 후 첫 번째 플랜으로 설정
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-end">
        <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      </div>

      {viewMode === "daily" ? (
        <DailyPlanListView onViewDetail={handleViewDetail} />
      ) : (
        <SinglePlanView
          selectedPlanNumber={selectedPlanNumber}
          onSelectPlan={setSelectedPlanNumber}
        />
      )}
    </div>
  );
}

