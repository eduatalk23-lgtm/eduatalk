"use client";

import { useEffect, useState } from "react";
import { PlanCard } from "./PlanCard";
import { groupPlansByPlanNumber, PlanWithContent } from "../_utils/planGroupUtils";

type DailyPlanListViewProps = {
  onViewDetail: (planNumber: number | null) => void;
};

export function DailyPlanListView({ onViewDetail }: DailyPlanListViewProps) {
  const [groups, setGroups] = useState<Array<{
    planNumber: number | null;
    plans: PlanWithContent[];
    content: any;
    sequence: number | null;
  }>>([]);
  const [sessions, setSessions] = useState<Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>>(new Map());
  const [planDate, setPlanDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(null);
      } catch (err) {
        console.error("[DailyPlanListView] 데이터 로딩 실패", err);
        setError("플랜을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    
    // 주기적으로 데이터 갱신 (타이머 업데이트용)
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">⚠️</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              플랜을 불러오는 중 오류가 발생했습니다
            </h3>
            <p className="text-sm text-gray-500">
              잠시 후 다시 시도해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">📚</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              오늘 배울 내용이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              자동 스케줄러를 실행해보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <PlanCard
          key={group.planNumber ?? "null"}
          group={group}
          sessions={sessions}
          planDate={planDate}
          viewMode="daily"
          onViewDetail={() => onViewDetail(group.planNumber)}
        />
      ))}
    </div>
  );
}

