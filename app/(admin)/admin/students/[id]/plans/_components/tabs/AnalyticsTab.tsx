"use client";

import { PlanStatsCards } from "../PlanStatsCards";
import { PlanTypeStats } from "../PlanTypeStats";
import { SummaryDashboard } from "../SummaryDashboard";
import { PlanQualityDashboard } from "../PlanQualityDashboard";
import { useAdminPlan } from "../context/AdminPlanContext";

interface AnalyticsTabProps {
  tab: "analytics";
}

/**
 * 분석 탭 컴포넌트
 *
 * 포함 컴포넌트:
 * - PlanStatsCards: 현황 카드 (미완료, 완료율, 학습 시간)
 * - PlanTypeStats: 유형별 통계 (교재/강의/직접입력)
 * - SummaryDashboard: 요약 대시보드
 * - PlanQualityDashboard: 플랜 품질 분석 (activePlanGroupId 있을 때만)
 */
export function AnalyticsTab({ tab: _tab }: AnalyticsTabProps) {
  const { studentId, selectedDate, selectedPlannerId, activePlanGroupId } =
    useAdminPlan();

  return (
    <div className="space-y-6">
      {/* 현황 카드 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">현황 요약</h2>
        <PlanStatsCards studentId={studentId} />
      </section>

      {/* 유형별 통계 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">
          콘텐츠 유형별 통계
        </h2>
        <PlanTypeStats
          studentId={studentId}
          selectedDate={selectedDate}
          plannerId={selectedPlannerId}
        />
      </section>

      {/* 요약 대시보드 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-secondary-900">학습 분석</h2>
        <SummaryDashboard studentId={studentId} />
      </section>

      {/* 플랜 품질 분석 (activePlanGroupId가 있을 때만 표시) */}
      {activePlanGroupId && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-secondary-900">
            플랜 품질 분석
          </h2>
          <PlanQualityDashboard
            planGroupId={activePlanGroupId}
            planGroupName="현재 플랜 그룹"
          />
        </section>
      )}
    </div>
  );
}
