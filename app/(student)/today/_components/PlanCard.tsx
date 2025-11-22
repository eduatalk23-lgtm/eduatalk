"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PlanGroup, PlanWithContent } from "../_utils/planGroupUtils";
import {
  calculateGroupProgress,
  calculateGroupTotalStudyTime,
  getActivePlansCount,
  getCompletedPlansCount,
  formatTime,
  getActivePlan,
  getTimeStats,
} from "../_utils/planGroupUtils";
import { PlanTimer } from "./PlanTimer";
import { startPlan, pausePlan, resumePlan, stopAllActiveSessionsForPlan } from "../actions/todayActions";
import { togglePlanCompletion } from "@/app/actions/today";
import { CheckCircle2, Circle } from "lucide-react";

type PlanCardProps = {
  group: PlanGroup;
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string;
  viewMode: "single" | "daily";
  onViewDetail?: () => void;
};

export function PlanCard({
  group,
  sessions,
  planDate,
  viewMode,
  onViewDetail,
}: PlanCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 콘텐츠 정보
  const contentInfo = useMemo(() => ({
    title: group.content?.title || "제목 없음",
    icon: group.plans[0]?.content_type === "book"
      ? "📚"
      : group.plans[0]?.content_type === "lecture"
      ? "🎧"
      : "📝",
  }), [group.content?.title, group.plans[0]?.content_type]);

  // 집계 정보
  const aggregatedInfo = useMemo(() => ({
    totalProgress: calculateGroupProgress(group),
    totalStudyTime: calculateGroupTotalStudyTime(group, sessions),
    activePlansCount: getActivePlansCount(group, sessions),
    completedPlansCount: getCompletedPlansCount(group),
    activePlan: getActivePlan(group, sessions),
  }), [group, sessions]);

  // 그룹 상태
  const groupStatus = useMemo(() => {
    const isGroupRunning = !!aggregatedInfo.activePlan;
    const isGroupPaused = group.plans.some((plan) => {
      const session = sessions.get(plan.id);
      return (
        plan.actual_start_time &&
        !plan.actual_end_time &&
        session &&
        session.isPaused
      );
    });
    const isGroupCompleted = aggregatedInfo.completedPlansCount === group.plans.length;

    return {
      isGroupRunning,
      isGroupPaused,
      isGroupCompleted,
    };
  }, [aggregatedInfo, group.plans, sessions]);

  // 시간 통계
  const timeStats = useMemo(() =>
    getTimeStats(group.plans, aggregatedInfo.activePlan, sessions),
    [group.plans, aggregatedInfo.activePlan, sessions]
  );

  // 타이머 제어 핸들러
  const handleStart = async () => {
    const waitingPlan = group.plans.find(
      (plan) => !plan.actual_start_time && !plan.actual_end_time
    );
    if (!waitingPlan) return;

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const result = await startPlan(waitingPlan.id, timestamp);
      if (!result.success) {
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (isLoading) return;

    const activePlanIds = group.plans
      .filter((plan) => {
        const session = sessions.get(plan.id);
        return (
          plan.actual_start_time &&
          !plan.actual_end_time &&
          session &&
          !session.isPaused
        );
      })
      .map((plan) => plan.id);

    if (activePlanIds.length === 0) {
      alert("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      await Promise.all(
        activePlanIds.map((planId) => pausePlan(planId, timestamp))
      );
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    const pausedPlanIds = group.plans
      .filter((plan) => {
        const session = sessions.get(plan.id);
        return session && session.isPaused;
      })
      .map((plan) => plan.id);

    if (pausedPlanIds.length === 0) {
      alert("재개할 일시정지된 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      await Promise.all(
        pausedPlanIds.map((planId) => resumePlan(planId, timestamp))
      );
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!aggregatedInfo.activePlan) {
      if (group.plans.length > 0) {
        router.push(`/today/plan/${group.plans[0].id}`);
      }
      return;
    }

    setIsLoading(true);
    try {
      await stopAllActiveSessionsForPlan(aggregatedInfo.activePlan.id);
      router.refresh();
      router.push(`/today/plan/${aggregatedInfo.activePlan.id}`);
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 완료/미완료 토글
  const handleToggleCompletion = async (planId: string, isCompleted: boolean) => {
    setIsLoading(true);
    try {
      const result = await togglePlanCompletion(planId, !isCompleted);
      if (!result.success) {
        alert(result.error || "완료 상태 변경에 실패했습니다.");
      } else {
        router.refresh();
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 단일 뷰
  if (viewMode === "single") {
    return (
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="text-center">
          <div className="text-4xl mb-2">{contentInfo.icon}</div>
          <h2 className="text-2xl font-bold text-gray-900">{contentInfo.title}</h2>
        </div>

        {/* 타이머 */}
        <PlanTimer
          timeStats={timeStats}
          isPaused={groupStatus.isGroupPaused}
          isActive={groupStatus.isGroupRunning}
          isLoading={isLoading}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
        />

        {/* 진행률 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-center">
              <h3 className="text-lg font-semibold text-gray-900">전체 진행률</h3>
              <div className="text-3xl font-bold text-indigo-600">
                {aggregatedInfo.totalProgress}%
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${aggregatedInfo.totalProgress}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 text-center">
              <p className="text-sm text-gray-600">총 학습 시간</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatTime(aggregatedInfo.totalStudyTime)}
              </p>
            </div>
          </div>
        </div>

        {/* 플랜 목록 - 같은 plan_number를 가진 플랜은 하나의 논리적 플랜으로 통합 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-900">플랜 목록</h3>
          {(() => {
            // 같은 plan_number를 가진 플랜들은 이미 group으로 묶여있으므로, 하나의 항목으로 표시
            const allPlans = group.plans;
            const representativePlan = allPlans[0];
            
            // 모든 플랜이 완료되었는지 확인
            const isCompleted = allPlans.every((p) => !!p.actual_end_time);
            
            // 그룹 전체 진행률 계산
            const totalRange = allPlans.reduce((sum, plan) => {
              const range = (plan.planned_end_page_or_time ?? 0) - (plan.planned_start_page_or_time ?? 0);
              return sum + range;
            }, 0);
            
            const completedRange = allPlans.reduce((sum, plan) => {
              return sum + (plan.completed_amount ?? 0);
            }, 0);
            
            const progress = totalRange > 0 ? Math.round((completedRange / totalRange) * 100) : 0;
            
            // 전체 범위 계산 (가장 작은 시작 ~ 가장 큰 종료)
            const allStarts = allPlans
              .map((p) => p.planned_start_page_or_time)
              .filter((v): v is number => v !== null && v !== undefined)
              .sort((a, b) => a - b);
            const allEnds = allPlans
              .map((p) => p.planned_end_page_or_time)
              .filter((v): v is number => v !== null && v !== undefined)
              .sort((a, b) => b - a);
            
            const overallStart = allStarts.length > 0 ? allStarts[0] : null;
            const overallEnd = allEnds.length > 0 ? allEnds[0] : null;
            
            // 시간 정보 (가장 이른 시작 시간과 가장 늦은 종료 시간)
            const startTimes = allPlans
              .map((p) => p.start_time)
              .filter((t): t is string => !!t)
              .sort();
            const endTimes = allPlans
              .map((p) => p.end_time)
              .filter((t): t is string => !!t)
              .sort();
            const timeDisplay = startTimes.length > 0 && endTimes.length > 0
              ? `${startTimes[0]} ~ ${endTimes[endTimes.length - 1]}`
              : null;

            return (
              <div
                key={group.planNumber ?? 'no-number'}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <button
                  onClick={() => handleToggleCompletion(representativePlan.id, isCompleted)}
                  disabled={isLoading}
                  className="flex-shrink-0"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-400" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {(() => {
                      const contentType = representativePlan.content_type;
                      const contentTypeIcon = contentType === "book"
                        ? "📖"
                        : contentType === "lecture"
                        ? "🎧"
                        : "📝";
                      
                      const chapterText = representativePlan.chapter;
                      
                      // 챕터 정보 표시 (없으면 "정보 없음")
                      return (
                        <>
                          {contentTypeIcon} 챕터: {chapterText || "정보 없음"}
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const contentType = representativePlan.content_type;
                      
                      // 전체 범위 표시
                      if (overallStart !== null && overallEnd !== null) {
                        if (contentType === "book") {
                          return <>📄 페이지: {overallStart} ~ {overallEnd}</>;
                        } else if (contentType === "lecture") {
                          return <>🎧 강의: {overallStart} ~ {overallEnd}</>;
                        } else {
                          return <>📝 범위: {overallStart} ~ {overallEnd}</>;
                        }
                      }
                      return null;
                    })()}
                  </div>
                  {timeDisplay && (
                    <div className="mt-1 text-xs text-blue-600">
                      ⏰ 시간: {timeDisplay}
                    </div>
                  )}
                  {progress > 0 && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // 일일 뷰
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{contentInfo.icon}</span>
            <h3 className="font-semibold text-gray-900">{contentInfo.title}</h3>
          </div>
          {onViewDetail && (
            <button
              onClick={onViewDetail}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              상세보기 →
            </button>
          )}
        </div>

        {/* 타이머 */}
        <PlanTimer
          timeStats={timeStats}
          isPaused={groupStatus.isGroupPaused}
          isActive={groupStatus.isGroupRunning}
          isLoading={isLoading}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
          compact
        />

        {/* 집계 정보 */}
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">전체 진행률</span>
              <span className="font-semibold text-gray-900">
                {aggregatedInfo.totalProgress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${aggregatedInfo.totalProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>총 학습 시간: {formatTime(aggregatedInfo.totalStudyTime)}</span>
              <span>
                활성: {aggregatedInfo.activePlansCount} | 완료: {aggregatedInfo.completedPlansCount}
              </span>
            </div>
          </div>
        </div>

        {/* 플랜 목록 (간단 버전) - 같은 plan_number를 가진 플랜은 하나의 논리적 플랜으로 통합 */}
        <div className="flex flex-col gap-2">
          {(() => {
            // 같은 plan_number를 가진 플랜들은 이미 group으로 묶여있으므로, 하나의 항목으로 표시
            const allPlans = group.plans;
            const representativePlan = allPlans[0];
            
            // 모든 플랜이 완료되었는지 확인
            const isCompleted = allPlans.every((p) => !!p.actual_end_time);
            
            // 그룹 전체 진행률 계산
            const totalRange = allPlans.reduce((sum, plan) => {
              const range = (plan.planned_end_page_or_time ?? 0) - (plan.planned_start_page_or_time ?? 0);
              return sum + range;
            }, 0);
            
            const completedRange = allPlans.reduce((sum, plan) => {
              return sum + (plan.completed_amount ?? 0);
            }, 0);
            
            const progress = totalRange > 0 ? Math.round((completedRange / totalRange) * 100) : 0;
            
            // 전체 범위 계산 (가장 작은 시작 ~ 가장 큰 종료)
            const allStarts = allPlans
              .map((p) => p.planned_start_page_or_time)
              .filter((v): v is number => v !== null && v !== undefined)
              .sort((a, b) => a - b);
            const allEnds = allPlans
              .map((p) => p.planned_end_page_or_time)
              .filter((v): v is number => v !== null && v !== undefined)
              .sort((a, b) => b - a);
            
            const overallStart = allStarts.length > 0 ? allStarts[0] : null;
            const overallEnd = allEnds.length > 0 ? allEnds[0] : null;
            
            // 시간 정보 (가장 이른 시작 시간과 가장 늦은 종료 시간)
            const startTimes = allPlans
              .map((p) => p.start_time)
              .filter((t): t is string => !!t)
              .sort();
            const endTimes = allPlans
              .map((p) => p.end_time)
              .filter((t): t is string => !!t)
              .sort();
            const timeDisplay = startTimes.length > 0 && endTimes.length > 0
              ? `${startTimes[0]} ~ ${endTimes[endTimes.length - 1]}`
              : null;

            return (
              <div
                key={group.planNumber ?? 'no-number'}
                className="flex items-center gap-2 rounded border border-gray-200 bg-white p-2"
              >
                <button
                  onClick={() => handleToggleCompletion(representativePlan.id, isCompleted)}
                  disabled={isLoading}
                  className="flex-shrink-0"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <div className="flex-1 text-xs">
                  <div className="font-medium text-gray-900">
                    {(() => {
                      const contentType = representativePlan.content_type;
                      const contentTypeIcon = contentType === "book"
                        ? "📖"
                        : contentType === "lecture"
                        ? "🎧"
                        : "📝";
                      
                      const chapterText = representativePlan.chapter;
                      
                      // 챕터 정보 표시 (없으면 "정보 없음")
                      return (
                        <>
                          {contentTypeIcon} 챕터: {chapterText || "정보 없음"}
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-gray-500">
                    {(() => {
                      const contentType = representativePlan.content_type;
                      
                      // 전체 범위 표시
                      if (overallStart !== null && overallEnd !== null) {
                        if (contentType === "book") {
                          return <>📄 페이지: {overallStart} ~ {overallEnd}</>;
                        } else if (contentType === "lecture") {
                          return <>🎧 강의: {overallStart} ~ {overallEnd}</>;
                        } else {
                          return <>📝 범위: {overallStart} ~ {overallEnd}</>;
                        }
                      }
                      return null;
                    })()}
                  </div>
                  {timeDisplay && (
                    <div className="mt-0.5 text-xs text-blue-600">
                      ⏰ 시간: {timeDisplay}
                    </div>
                  )}
                </div>
                {progress > 0 && (
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

