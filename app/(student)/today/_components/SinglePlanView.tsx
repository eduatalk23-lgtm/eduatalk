"use client";

import { memo } from "react";
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

function SinglePlanViewComponent({
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

// 커스텀 비교 함수로 불필요한 리렌더링 방지
function arePropsEqual(
  prevProps: SinglePlanViewProps,
  nextProps: SinglePlanViewProps
): boolean {
  // 기본 값 비교
  if (
    prevProps.planDate !== nextProps.planDate ||
    prevProps.selectedPlanNumber !== nextProps.selectedPlanNumber ||
    prevProps.selectedPlanId !== nextProps.selectedPlanId ||
    prevProps.campMode !== nextProps.campMode
  ) {
    return false;
  }

  // groups 배열 비교 (length와 각 plan.id 비교)
  if (prevProps.groups.length !== nextProps.groups.length) {
    return false;
  }
  for (let i = 0; i < prevProps.groups.length; i++) {
    if (prevProps.groups[i].plan.id !== nextProps.groups[i].plan.id) {
      return false;
    }
    // 완료 상태 변경 확인
    if (
      prevProps.groups[i].plan.status !== nextProps.groups[i].plan.status ||
      prevProps.groups[i].plan.progress !== nextProps.groups[i].plan.progress
    ) {
      return false;
    }
  }

  // sessions Map 비교 (size와 내용)
  if (prevProps.sessions.size !== nextProps.sessions.size) {
    return false;
  }

  return true;
}

export const SinglePlanView = memo(SinglePlanViewComponent, arePropsEqual);
