"use client";

import { PlanGroup, PlanWithContent } from "../_utils/planGroupUtils";
import {
  calculateGroupProgress,
  calculateGroupTotalStudyTime,
  getActivePlansCount,
  getCompletedPlansCount,
  formatTime,
} from "../_utils/planGroupUtils";
import { PlanItem } from "./PlanItem";
import { TimestampDisplay } from "./TimestampDisplay";
import { TimerControlButtons } from "./TimerControlButtons";
import { PlanGroupActions } from "./PlanGroupActions";
import { PlanMemoModal } from "./PlanMemoModal";
import { PlanRangeAdjustModal } from "./PlanRangeAdjustModal";
import { PlanDetailInfo } from "./PlanDetailInfo";
import { TimeCheckSection } from "./TimeCheckSection";
import { startPlan, pausePlan, resumePlan, stopAllActiveSessionsForPlan } from "../actions/todayActions";
import { savePlanMemo } from "../actions/planMemoActions";
import { adjustPlanRanges } from "../actions/planRangeActions";
import { resetPlanTimer } from "../actions/timerResetActions";
import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useMemo, memo } from "react";
import { getTimeStats, getActivePlan } from "../_utils/planGroupUtils";

type PlanGroupCardProps = {
  group: PlanGroup;
  viewMode: "daily" | "single";
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string; // 플랜 날짜 (메모 조회용)
  memo?: string | null; // 메모 내용
  totalPages?: number; // 콘텐츠 총량 (범위 조정용)
  onViewDetail?: () => void; // 일일 뷰에서 단일 뷰로 전환할 때
};

function PlanGroupCardComponent({
  group,
  viewMode,
  sessions,
  planDate,
  memo,
  totalPages,
  onViewDetail,
}: PlanGroupCardProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  // 콘텐츠 정보 (메모이제이션)
  const contentInfo = useMemo(() => ({
    title: group.content?.title || "제목 없음",
    icon: group.plans[0]?.content_type === "book"
      ? "📚"
      : group.plans[0]?.content_type === "lecture"
      ? "🎧"
      : "📝"
  }), [group.content?.title, group.plans[0]?.content_type]);

  // 집계 정보 계산 (메모이제이션)
  const aggregatedInfo = useMemo(() => ({
    totalProgress: calculateGroupProgress(group),
    totalStudyTime: calculateGroupTotalStudyTime(group),
    activePlansCount: getActivePlansCount(group, sessions),
    completedPlansCount: getCompletedPlansCount(group),
    activePlan: getActivePlan(group, sessions)
  }), [group, sessions]);

  // 그룹 상태 계산 (메모이제이션)
  const groupStatus = useMemo(() => {
    const activePlan = aggregatedInfo.activePlan;
    const isGroupRunning = !!activePlan;

    // 일시정지된 플랜이 있으면 일시정지 상태로 간주
    const isGroupPaused = group.plans.some((plan) => {
      const session = sessions.get(plan.id);
      return (
        plan.actual_start_time &&
        !plan.actual_end_time &&
        session &&
        session.isPaused
      );
    });

    // 다른 플랜이 활성화되어 있는지 확인 (현재 그룹의 플랜 제외)
    const currentGroupPlanIds = new Set(group.plans.map((p) => p.id));
    const hasOtherActivePlan = Array.from(sessions.entries()).some(
      ([planId, session]) =>
        !currentGroupPlanIds.has(planId) &&
        session &&
        !session.isPaused
    );

    return {
      isGroupRunning,
      isGroupPaused,
      hasOtherActivePlan
    };
  }, [aggregatedInfo.activePlan, group.plans, sessions]);

  // 시간 통계 계산 (메모이제이션)
  const timeStats = useMemo(() =>
    getTimeStats(group.plans, aggregatedInfo.activePlan, sessions),
    [group.plans, aggregatedInfo.activePlan, sessions]
  );

  // 그룹 타이머 제어 핸들러 (optimistic update 적용)
  const handleGroupStart = async (timestamp?: string) => {
    // 그룹 내 첫 번째 대기 중인 플랜 시작
    const waitingPlan = group.plans.find(
      (plan) => !plan.actual_start_time && !plan.actual_end_time
    );
    if (!waitingPlan) return;

    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성 (없으면 서버에서 생성)
      const clientTimestamp = timestamp || new Date().toISOString();
      // 서버 동기화는 백그라운드에서 처리 (startTransition 사용)
      startTransition(async () => {
        const result = await startPlan(waitingPlan.id, clientTimestamp);
        if (result.success) {
          // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
          // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
          setIsLoading(false);
        } else {
          alert(result.error || "플랜 시작에 실패했습니다.");
          setIsLoading(false);
        }
      });
    } catch (error) {
      alert("오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleGroupPause = async () => {
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoading) {
      return;
    }

    // 실제로 세션이 있는 활성 플랜만 일시정지 (세션 데이터 기반)
    const activePlanIds = Array.from(
      new Set(
        group.plans
          .filter((plan) => {
            const session = sessions.get(plan.id);
            // 세션이 있고, 일시정지되지 않은 플랜만
            return (
              plan.actual_start_time &&
              !plan.actual_end_time &&
              session &&
              !session.isPaused
            );
          })
          .map((plan) => plan.id)
      )
    );

    if (activePlanIds.length === 0) {
      alert("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const clientTimestamp = new Date().toISOString();
      const results = await Promise.all(
        activePlanIds.map(async (planId) => {
          try {
            const result = await pausePlan(planId, clientTimestamp);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      const failedResults = results.filter((r) => !r.success);
      // "이미 일시정지된 상태입니다" 또는 "활성 세션을 찾을 수 없습니다" 에러는 무시
      // (세션 상태 동기화 문제로 인한 에러일 수 있음)
      const criticalErrors = failedResults.filter(
        (r) =>
          r.error &&
          !r.error.includes("이미 일시정지된 상태입니다") &&
          !r.error.includes("활성 세션을 찾을 수 없습니다")
      );

      if (criticalErrors.length > 0) {
        const errorMessages = criticalErrors
          .map((r) => r.error || "알 수 없는 오류")
          .join(", ");
        alert(`일시정지에 실패했습니다: ${errorMessages}`);
        setIsLoading(false);
        // 에러 발생 시에만 상태 동기화를 위해 refresh
        startTransition(() => {
          router.refresh();
        });
      } else {
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
        // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
        setIsLoading(false);
      }
    } catch (error) {
      console.error("[PlanGroupCard] 일시정지 오류:", error);
      alert("오류가 발생했습니다: " + (error instanceof Error ? error.message : String(error)));
      setIsLoading(false);
    }
  };

  const handleGroupResume = async (timestamp?: string) => {
    // 실제로 세션이 있고 일시정지된 플랜만 재개 (세션 데이터 기반)
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
      // 클라이언트에서 타임스탬프 생성 (전달받은 타임스탬프가 없으면 생성)
      const clientTimestamp = timestamp || new Date().toISOString();
      const results = await Promise.all(
        pausedPlanIds.map(async (planId) => {
          try {
            return await resumePlan(planId, clientTimestamp);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      const failedResults = results.filter((r) => !r.success);
      // "활성 세션을 찾을 수 없습니다" 에러는 무시 (세션 상태 동기화 문제)
      const criticalErrors = failedResults.filter(
        (r) => r.error && !r.error.includes("활성 세션을 찾을 수 없습니다")
      );

      if (criticalErrors.length > 0) {
        const errorMessages = criticalErrors
          .map((r) => r.error || "알 수 없는 오류")
          .join(", ");
        alert(`재개에 실패했습니다: ${errorMessages}`);
        setIsLoading(false);
        // 에러 발생 시에만 상태 동기화를 위해 refresh
        startTransition(() => {
          router.refresh();
        });
      } else {
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
        // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
        setIsLoading(false);
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleGroupComplete = async () => {
    // 완료 버튼을 누르면 활성 세션을 먼저 종료하여 타이머 중지
    if (!activePlan) {
      // 활성 플랜이 없으면 상세보기 페이지로 이동
      if (group.plans.length > 0) {
        router.push(`/today/plan/${group.plans[0].id}`);
      }
      return;
    }

    setIsLoading(true);
    try {
      // 활성 플랜의 모든 활성 세션 종료
      const result = await stopAllActiveSessionsForPlan(activePlan.id);
      
      if (!result.success) {
        alert(result.error || "세션 종료에 실패했습니다.");
        return;
      }

      // 그룹 내 다른 활성 플랜들의 세션도 종료
      const activePlanIds = group.plans
        .filter(
          (plan) =>
            plan.actual_start_time &&
            !plan.actual_end_time &&
            plan.id !== activePlan.id
        )
        .map((plan) => plan.id);

      for (const planId of activePlanIds) {
        await stopAllActiveSessionsForPlan(planId);
      }

      // 페이지 새로고침하여 타이머 중지 확인
      router.refresh();

      // 상세보기 페이지로 이동
      router.push(`/today/plan/${activePlan.id}`);
    } catch (error) {
      console.error("[PlanGroupCard] 완료 처리 오류:", error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 회차 표시 (같은 sequence를 가진 플랜들)
  const sequenceText = group.sequence
    ? `${group.sequence}회차`
    : group.plans.length > 1
    ? `${group.plans[0]?.sequence || 1}회차`
    : "1회차";

  // 메모 저장 핸들러
  const handleSaveMemo = async (newMemo: string) => {
    const result = await savePlanMemo(group.planNumber, planDate, newMemo);
    if (result.success) {
      router.refresh();
    } else {
      throw new Error(result.error || "메모 저장에 실패했습니다.");
    }
  };

  // 범위 조정 저장 핸들러
  const handleSaveRanges = async (ranges: Array<{ planId: string; startPageOrTime: number; endPageOrTime: number }>) => {
    const planIds = ranges.map((r) => r.planId);
    const result = await adjustPlanRanges(planIds, ranges);
    if (result.success) {
      router.refresh();
    } else {
      throw new Error(result.error || "범위 조정에 실패했습니다.");
    }
  };

  // 타이머 초기화 핸들러
  const handleResetTimer = async () => {
    if (!confirm("타이머 기록을 초기화하시겠습니까?\n\n초기화하면 다음 정보가 삭제됩니다:\n- 시작/종료 시간\n- 학습 시간 기록\n- 일시정지 기록\n- 타이머 활동 기록\n\n이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPlanTimer(group.planNumber, planDate);
      if (result.success) {
        // 서버 상태 반영을 위해 페이지 새로고침
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert(result.error || "타이머 초기화에 실패했습니다.");
      }
    } catch (error) {
      console.error("[PlanGroupCard] 타이머 초기화 오류:", error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 콘텐츠 총량 계산 (메모이제이션)
  const totalPagesCalculated = useMemo(() => {
    if (totalPages !== undefined && totalPages > 0) {
      return totalPages;
    }
    // 기본값: 가장 큰 endPageOrTime을 총량으로 추정
    const maxEnd = Math.max(
      ...group.plans.map((p) => p.planned_end_page_or_time ?? 0)
    );
    return maxEnd || 100;
  }, [totalPages, group.plans]);

  const isBook = useMemo(() =>
    group.plans[0]?.content_type === "book",
    [group.plans[0]?.content_type]
  );

  if (viewMode === "single") {
    // 단일 뷰: 전체 화면으로 크게 표시
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="relative text-center">
          <div className="absolute right-0 top-0">
            <PlanGroupActions
              group={group}
              memo={memo ?? null}
              hasMemo={!!memo && memo.length > 0}
              onMemoClick={() => setIsMemoModalOpen(true)}
              onRangeAdjustClick={() => setIsRangeModalOpen(true)}
              viewMode="single"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-4xl">{contentInfo.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900">{contentInfo.title}</h2>
          </div>
        </div>

        {/* 플랜 상세 정보 */}
        <PlanDetailInfo group={group} />

        {/* 시간 체크 섹션 */}
        <TimeCheckSection
          timeStats={timeStats}
          isPaused={groupStatus.isGroupPaused}
          activePlanStartTime={aggregatedInfo.activePlan?.actual_start_time ?? null}
          planId={aggregatedInfo.activePlan?.id || group.plans[0]?.id || ""}
          isActive={groupStatus.isGroupRunning}
          isLoading={isLoading || isPending}
          planNumber={group.planNumber}
          planDate={planDate}
          hasOtherActivePlan={groupStatus.hasOtherActivePlan}
          onStart={handleGroupStart}
          onPause={handleGroupPause}
          onResume={handleGroupResume}
          onComplete={handleGroupComplete}
          onReset={handleResetTimer}
        />


        {/* 전체 진행률 및 시간 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                전체 진행률
              </h3>
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

        {/* 메모 모달 */}
        <PlanMemoModal
          group={group}
          memo={memo}
          isOpen={isMemoModalOpen}
          onClose={() => setIsMemoModalOpen(false)}
          onSave={handleSaveMemo}
        />

        {/* 범위 조정 모달 */}
        <PlanRangeAdjustModal
          group={group}
          isOpen={isRangeModalOpen}
          onClose={() => setIsRangeModalOpen(false)}
          onSave={handleSaveRanges}
          totalPages={totalPagesCalculated}
          isBook={isBook}
        />
      </div>
    );
  }

  // 일일 뷰: 컴팩트한 카드 형태
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{contentInfo.icon}</span>
            <h3 className="font-semibold text-gray-900">{contentInfo.title}</h3>
            {group.planNumber !== null && (
              <span className="text-xs text-gray-500">
                (plan_number: {group.planNumber})
              </span>
            )}
          </div>
          <PlanGroupActions
            group={group}
            memo={memo ?? null}
            hasMemo={!!memo && memo.length > 0}
            onMemoClick={() => setIsMemoModalOpen(true)}
            onRangeAdjustClick={() => setIsRangeModalOpen(true)}
            onViewDetail={onViewDetail}
            viewMode="daily"
          />
        </div>
        {group.sequence && (
          <p className="text-sm text-gray-600">({sequenceText})</p>
        )}

        {/* 개별 플랜 블록 */}
        <div className="flex flex-col gap-3">
          {group.plans.map((plan, index) => {
            // plan 객체에 session 정보 추가
            const planWithSession = {
              ...plan,
              session: sessions.get(plan.id) || undefined,
            };


            return (
            <PlanItem
              key={plan.id}
              plan={planWithSession}
              isGrouped={true}
              showTimer={
                !!plan.actual_start_time ||
                !!plan.actual_end_time ||
                sessions.has(plan.id)
              }
              viewMode="daily"
            />
          );
        })}
        </div>

        {/* 집계 정보 */}
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">전체 진행률</span>
              <span className="font-semibold text-gray-900">{aggregatedInfo.totalProgress}%</span>
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
      </div>

      {/* 그룹 제어 버튼 */}
      <TimerControlButtons
        planId={aggregatedInfo.activePlan?.id || group.plans[0]?.id || ""}
        isActive={groupStatus.isGroupRunning}
        isPaused={groupStatus.isGroupPaused}
        isCompleted={aggregatedInfo.completedPlansCount === group.plans.length}
        isLoading={isLoading || isPending}
        onStart={handleGroupStart}
        onPause={handleGroupPause}
        onResume={handleGroupResume}
        onComplete={handleGroupComplete}
      />

      {/* 메모 모달 */}
      <PlanMemoModal
        group={group}
        memo={memo}
        isOpen={isMemoModalOpen}
        onClose={() => setIsMemoModalOpen(false)}
        onSave={handleSaveMemo}
      />

      {/* 범위 조정 모달 */}
      <PlanRangeAdjustModal
        group={group}
        isOpen={isRangeModalOpen}
        onClose={() => setIsRangeModalOpen(false)}
        onSave={handleSaveRanges}
        totalPages={totalPagesCalculated}
        isBook={isBook}
      />
    </div>
  );
}

export const PlanGroupCard = memo(PlanGroupCardComponent);

