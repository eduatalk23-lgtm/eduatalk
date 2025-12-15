"use client";

import { useMemo, useCallback } from "react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { PlanGroupCard } from "./PlanGroupCard";
import { ViewMode } from "./ViewModeSelector";
import { VirtualizedList } from "@/lib/components/VirtualizedList";

type DailyPlanViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string;
  memos: Map<number | null, string | null>; // planNumber -> memo
  totalPagesMap: Map<string, number>; // contentKey -> totalPages
  onViewDetail: (planNumber: number | null) => void;
  campMode?: boolean; // 캠프 모드 여부
};

export function DailyPlanView({
  groups,
  sessions,
  planDate,
  memos,
  totalPagesMap,
  onViewDetail,
  campMode = false,
}: DailyPlanViewProps) {
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
              학습 플랜을 생성해보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 그룹 렌더링 함수
  const renderGroup = useCallback(
    (group: PlanGroup, index: number) => {
      const contentKey = group.plan
        ? `${group.plan.content_type}:${group.plan.content_id}`
        : "";
      const totalPages = totalPagesMap.get(contentKey);
      const memo = memos.get(group.planNumber);

      return (
        <div key={`group-${group.planNumber}-${index}`}>
          <PlanGroupCard
            group={group}
            viewMode="daily"
            sessions={sessions}
            planDate={planDate}
            memo={memo}
            totalPages={totalPages}
            onViewDetail={onViewDetail}
            campMode={campMode}
          />
        </div>
      );
    },
    [sessions, planDate, memos, totalPagesMap, onViewDetail, campMode]
  );

  // 플랜 그룹이 10개 이상일 때 가상화 적용
  if (groups.length > 10) {
    return (
      <VirtualizedList
        items={groups}
        itemHeight={200} // PlanGroupCard의 예상 높이
        containerHeight={600} // 컨테이너 높이
        renderItem={renderGroup}
        className="rounded-xl border border-gray-200 bg-white p-4"
        overscan={3}
      />
    );
  }

  // 10개 이하일 때는 일반 렌더링
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, index) => renderGroup(group, index))}
    </div>
  );
}

