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
  onSelectPlan: (planNumber: number | null) => void;
  serverNow?: number;
  campMode?: boolean; // 캠프 모드 여부
};

export function SinglePlanView({
  groups,
  sessions,
  planDate,
  selectedPlanNumber,
  onSelectPlan,
  serverNow = Date.now(),
  campMode = false,
}: SinglePlanViewProps) {
  // selectedPlanNumber가 null이고 groups가 있으면 첫 번째 그룹 자동 선택
  // 단, groups가 변경되었을 때만 실행 (무한 루프 방지)
  useEffect(() => {
    if (selectedPlanNumber === null && groups.length > 0) {
      const firstGroupPlanNumber = groups[0]?.planNumber ?? null;
      if (firstGroupPlanNumber !== null) {
        onSelectPlan(firstGroupPlanNumber);
      }
    }
    // onSelectPlan은 부모 컴포넌트에서 useCallback으로 메모이제이션되어 있어야 함
    // groups의 첫 번째 요소가 변경되었을 때만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanNumber, groups.length, groups[0]?.plan?.id]);

  const selectedGroup =
    groups.find((g) => g.planNumber === selectedPlanNumber) || groups[0];

  if (!selectedGroup) {
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
        onSelect={onSelectPlan}
        sessions={sessions}
      />
      <PlanCard
        group={selectedGroup}
        sessions={sessions}
        planDate={planDate}
        viewMode="single"
        serverNow={serverNow}
        campMode={campMode}
      />
    </div>
  );
}
