"use client";

import { useMemo, useCallback } from "react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { PlanGroupCard } from "./PlanGroupCard";
import { ViewMode } from "./ViewModeSelector";

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

  // 그룹 렌더링 결과를 메모이제이션하여 중복 렌더링 방지
  // onViewDetail을 직접 전달하여 인라인 함수 생성 방지
  const renderedGroups = useMemo(
    () =>
      groups.map((group, index) => {
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
      }),
    [groups, sessions, planDate, memos, totalPagesMap, onViewDetail, campMode]
  );

  return (
    <div className="flex flex-col gap-4">
      {renderedGroups}
    </div>
  );
}

