"use client";

import { PlanGroup } from "@/lib/types/plan";

type PlanGroupProgressCardProps = {
  group: PlanGroup;
  planCount: number;
  completedCount: number;
  hasPlans: boolean;
};

export function PlanGroupProgressCard({
  group,
  planCount,
  completedCount,
  hasPlans,
}: PlanGroupProgressCardProps) {
  const progressPercentage = planCount > 0 ? Math.round((completedCount / planCount) * 100) : 0;

  if (!hasPlans || planCount === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">플랜 진행 상황</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">0개</p>
            <p className="mt-1 text-sm text-gray-500">플랜이 생성되지 않았습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500">플랜 진행 상황</h3>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900">{completedCount}</p>
            <p className="text-lg text-gray-500">/ {planCount}개</p>
          </div>
          <p className="mt-1 text-sm text-gray-500">완료된 플랜</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-blue-600">{progressPercentage}%</p>
          <p className="text-xs text-gray-500">진행률</p>
        </div>
      </div>
      
      {/* 진행률 바 */}
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs text-gray-500">진행 중</p>
          <p className="mt-1 text-lg font-semibold text-orange-600">
            {planCount - completedCount}개
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">남은 플랜</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {planCount - completedCount}개
          </p>
        </div>
      </div>
    </div>
  );
}

