"use client";

import { useState, useEffect } from "react";
import { SinglePlanView } from "./SinglePlanView";
import { DailyPlanListView } from "./DailyPlanListView";
import { ViewModeSelector } from "./ViewModeSelector";
import { groupPlansByPlanNumber, PlanWithContent } from "../_utils/planGroupUtils";

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
  
  // 공유 데이터 상태
  const [groups, setGroups] = useState<Array<{
    planNumber: number | null;
    plans: PlanWithContent[];
    content: any;
    sequence: number | null;
  }>>([]);
  const [sessions, setSessions] = useState<Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>>(new Map());
  const [planDate, setPlanDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 데이터 로딩 (한 번만)
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/today/plans");
        if (!response.ok) throw new Error("플랜 조회 실패");
        
        const data = await response.json();
        const grouped = groupPlansByPlanNumber(data.plans);
        setGroups(grouped);
        setSessions(new Map(Object.entries(data.sessions || {})));
        setPlanDate(data.planDate || "");
        
        // 선택된 플랜이 없으면 첫 번째 플랜 선택
        if (!selectedPlanNumber && grouped.length > 0) {
          setSelectedPlanNumber(grouped[0]?.planNumber ?? null);
        }
      } catch (error) {
        console.error("[PlanViewContainer] 데이터 로딩 실패", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    
    // 주기적으로 데이터 갱신 (타이머 업데이트용)
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [selectedPlanNumber]);

  const handleViewDetail = (planNumber: number | null) => {
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "single" && !selectedPlanNumber && groups.length > 0) {
      // 단일 뷰로 전환할 때 선택된 플랜이 없으면 첫 번째 플랜 선택
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 flex items-center justify-center p-8">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-end">
        <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      </div>

      {viewMode === "daily" ? (
        <DailyPlanListView
          groups={groups}
          sessions={sessions}
          planDate={planDate}
          onViewDetail={handleViewDetail}
        />
      ) : (
        <SinglePlanView
          groups={groups}
          sessions={sessions}
          planDate={planDate}
          selectedPlanNumber={selectedPlanNumber}
          onSelectPlan={setSelectedPlanNumber}
        />
      )}
    </div>
  );
}
