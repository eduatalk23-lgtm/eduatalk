"use client";

import { useCallback } from "react";
import { PlanCard } from "./PlanCard";
import { PlanGroup } from "../_utils/planGroupUtils";
import { formatKoreanDateWithDay } from "../_utils/dateDisplay";

type DailyPlanListViewProps = {
  groups: PlanGroup[];
  sessions: Map<
    string,
    { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }
  >;
  planDate: string;
  onViewDetail: (planId: string) => void;
  serverNow?: number;
  campMode?: boolean; // 캠프 모드 여부
  studentId?: string; // 인라인 콘텐츠 연결 모달용
};

export function DailyPlanListView({
  groups,
  sessions,
  planDate,
  onViewDetail,
  serverNow = Date.now(),
  campMode = false,
  studentId,
}: DailyPlanListViewProps) {
  if (groups.length === 0) {
    const formattedDate = planDate
      ? formatKoreanDateWithDay(planDate)
      : "선택한 날짜";
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">📚</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              선택한 날짜의 학습 플랜이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              {formattedDate}에 등록된 플랜이 없습니다. 새로운 플랜을
              만들어보세요.
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
          key={group.planNumber ?? `null-${group.plan.id}`}
          group={group}
          sessions={sessions}
          planDate={planDate}
          viewMode="daily"
          onViewDetail={onViewDetail}
          serverNow={serverNow}
          campMode={campMode}
          studentId={studentId}
        />
      ))}
    </div>
  );
}
