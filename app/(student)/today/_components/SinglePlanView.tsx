"use client";

import { useEffect, useMemo } from "react";
import { PlanCard } from "./PlanCard";
import { PlanSelector } from "./PlanSelector";
import { PlanGroup } from "../_utils/planGroupUtils";
import { formatKoreanDateWithDay } from "../_utils/dateDisplay";

type SinglePlanViewProps = {
  groups: PlanGroup[];
  sessions: Map<
    string,
    { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }
  >;
  planDate: string;
  selectedPlanNumber: number | null;
  selectedPlanId?: string | null; // plan.id 기반 선택
  onSelectPlan: (planNumber: number | null) => void;
  onSelectPlanById?: (planId: string) => void; // plan.id 기반 선택 (우선 사용)
  serverNow?: number;
  campMode?: boolean; // 캠프 모드 여부
};

export function SinglePlanView({
  groups,
  sessions,
  planDate,
  selectedPlanNumber,
  selectedPlanId,
  onSelectPlan,
  onSelectPlanById,
  serverNow = Date.now(),
  campMode = false,
}: SinglePlanViewProps) {
  // SinglePlanView에서는 자동 선택을 하지 않음
  // PlanViewContainer에서 처리하도록 함

  // selectedPlanId가 있으면 plan.id로 먼저 찾기 (정확한 그룹 식별)
  // 없으면 selectedPlanNumber로 찾기
  const selectedGroup = selectedPlanId
    ? groups.find((g) => g.plan.id === selectedPlanId)
    : selectedPlanNumber !== null
    ? groups.find((g) => g.planNumber === selectedPlanNumber)
    : null;
  
  // selectedGroup이 없으면 첫 번째 그룹 사용
  const displayGroup = selectedGroup || groups[0];

  if (!displayGroup) {
    const formattedDate = planDate
      ? formatKoreanDateWithDay(planDate)
      : "선택한 날짜";
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">📚</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              선택한 날짜의 단일 플랜이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              {formattedDate}에는 학습 플랜이 생성되지 않았습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PlanSelector
        groups={groups}
        selectedPlanNumber={selectedPlanNumber}
        selectedPlanId={selectedPlanId}
        onSelect={onSelectPlan}
        onSelectById={onSelectPlanById}
        sessions={sessions}
      />
      <PlanCard
        group={displayGroup}
        sessions={sessions}
        planDate={planDate}
        viewMode="single"
        serverNow={serverNow}
        campMode={campMode}
      />
    </div>
  );
}
