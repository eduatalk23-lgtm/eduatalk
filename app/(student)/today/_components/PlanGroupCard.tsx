"use client";

import { useMemo, useState, useTransition, memo } from "react";
import { useRouter } from "next/navigation";
import { PlanGroup } from "../_utils/planGroupUtils";
import {
  calculateGroupProgress,
  calculateGroupTotalStudyTime,
  getActivePlansCount,
  getCompletedPlansCount,
  formatTime,
  getTimeStats,
  getActivePlan,
} from "../_utils/planGroupUtils";
import { PlanItem } from "./PlanItem";
import { TimerControlButtons } from "./TimerControlButtons";
import { PlanGroupActions } from "./PlanGroupActions";
import { PlanMemoModal } from "./PlanMemoModal";
import { PlanRangeAdjustModal } from "./PlanRangeAdjustModal";
import { PlanDetailInfo } from "./PlanDetailInfo";
import { TimeCheckSection } from "./TimeCheckSection";
import { savePlanMemo } from "../actions/planMemoActions";
import { adjustPlanRanges } from "../actions/planRangeActions";
import { resetPlanTimer } from "../actions/timerResetActions";
import { usePlanCardActions } from "@/lib/hooks/usePlanCardActions";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import {
  bgSurface,
  bgPage,
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type SessionState = {
  isPaused: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
};

type PlanGroupCardProps = {
  group: PlanGroup;
  viewMode: "daily" | "single";
  sessions: Map<string, SessionState>;
  planDate: string;
  memo?: string | null;
  totalPages?: number;
  onViewDetail?: (planId: string) => void;
  campMode?: boolean;
};

function PlanGroupCardComponent({
  group,
  viewMode,
  sessions,
  planDate,
  memo,
  totalPages,
  onViewDetail,
  campMode = false,
}: PlanGroupCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  // Hook으로 추출된 타이머 액션 및 상태
  const {
    isLoading: isActionLoading,
    pendingAction,
    isRunning: isGroupRunning,
    isPausedState: isGroupPaused,
    handleStart: handleGroupStart,
    handlePause: handleGroupPause,
    handleResume: handleGroupResume,
    handleComplete: handleGroupComplete,
  } = usePlanCardActions({ group, sessions, campMode });

  const isLoading = isActionLoading || isResetLoading || isPending;

  // 콘텐츠 정보 (메모이제이션)
  const contentInfo = useMemo(
    () => ({
      title: group.content?.title || "제목 없음",
      icon:
        group.plan.content_type === "book"
          ? "📚"
          : group.plan.content_type === "lecture"
          ? "🎧"
          : "📝",
    }),
    [group.content?.title, group.plan.content_type]
  );

  // 집계 정보 계산 (메모이제이션)
  const aggregatedInfo = useMemo(
    () => ({
      totalProgress: calculateGroupProgress(group),
      totalStudyTime: calculateGroupTotalStudyTime(group, sessions),
      activePlansCount: getActivePlansCount(group, sessions),
      completedPlansCount: getCompletedPlansCount(group),
      activePlan: getActivePlan(group, sessions),
    }),
    [group, sessions]
  );

  // 다른 플랜이 활성화되어 있는지 확인
  const hasOtherActivePlan = useMemo(() => {
    const currentGroupPlanIds = new Set([group.plan.id]);
    return Array.from(sessions.entries()).some(
      ([planId, session]) =>
        !currentGroupPlanIds.has(planId) && session && !session.isPaused
    );
  }, [group.plan.id, sessions]);

  // 시간 통계 계산 (메모이제이션)
  const timeStats = useMemo(
    () => getTimeStats([group.plan], aggregatedInfo.activePlan, sessions),
    [group.plan, aggregatedInfo.activePlan, sessions]
  );

  // 회차 표시
  const sequenceText = group.sequence
    ? `${group.sequence}회차`
    : `${group.plan.sequence || 1}회차`;

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
  const handleSaveRanges = async (
    ranges: Array<{
      planId: string;
      startPageOrTime: number;
      endPageOrTime: number;
    }>
  ) => {
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
    if (
      !confirm(
        "타이머 기록을 초기화하시겠습니까?\n\n초기화하면 다음 정보가 삭제됩니다:\n- 시작/종료 시간\n- 학습 시간 기록\n- 일시정지 기록\n- 타이머 활동 기록\n\n이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setIsResetLoading(true);
    try {
      const result = await resetPlanTimer(group.planNumber, planDate);
      if (result.success) {
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
      setIsResetLoading(false);
    }
  };

  // 콘텐츠 총량 계산 (메모이제이션)
  const totalPagesCalculated = useMemo(() => {
    if (totalPages !== undefined && totalPages > 0) {
      return totalPages;
    }
    return group.plan.planned_end_page_or_time ?? 100;
  }, [totalPages, group.plan.planned_end_page_or_time]);

  const isBook = useMemo(
    () => group.plan.content_type === "book",
    [group.plan.content_type]
  );

  if (viewMode === "single") {
    // 단일 뷰: 전체 화면으로 크게 표시
    return (
      <div className="flex flex-col gap-6">
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
            <h2 className={cn("text-h2", textPrimary)}>{contentInfo.title}</h2>
          </div>
        </div>

        {/* 플랜 상세 정보 */}
        <PlanDetailInfo group={group} />

        {/* 시간 체크 섹션 */}
        <TimeCheckSection
          timeStats={timeStats}
          isPaused={isGroupPaused}
          activePlanStartTime={aggregatedInfo.activePlan?.actual_start_time ?? null}
          planId={aggregatedInfo.activePlan?.id || group.plan.id || ""}
          isActive={isGroupRunning}
          isLoading={isLoading}
          planNumber={group.planNumber}
          planDate={planDate}
          hasOtherActivePlan={hasOtherActivePlan}
          onStart={handleGroupStart}
          onPause={handleGroupPause}
          onResume={handleGroupResume}
          onComplete={handleGroupComplete}
          onReset={handleResetTimer}
          campMode={campMode}
        />

        {/* 전체 진행률 및 시간 */}
        <div
          className={cn(
            "rounded-lg border p-6 shadow-[var(--elevation-1)]",
            bgSurface,
            borderDefault
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-center">
              <h3 className={cn("text-lg font-semibold", textPrimary)}>
                전체 진행률
              </h3>
              <div className="text-3xl font-bold text-indigo-600">
                {aggregatedInfo.totalProgress}%
              </div>
              <ProgressBar
                value={aggregatedInfo.totalProgress}
                color="indigo"
                size="md"
              />
            </div>

            <div className="flex flex-col gap-1 text-center">
              <p className={cn("text-sm", textSecondary)}>총 학습 시간</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {formatTime(aggregatedInfo.totalStudyTime)}
              </p>
            </div>
          </div>
        </div>

        {/* 메모 모달 */}
        <PlanMemoModal
          group={group}
          memo={memo ?? null}
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
    <div
      className={cn(
        "rounded-lg border p-4 shadow-[var(--elevation-1)] transition-base hover:shadow-[var(--elevation-4)]",
        bgSurface,
        borderDefault
      )}
    >
      <div className="flex flex-col gap-4">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{contentInfo.icon}</span>
            <h3 className={cn("font-semibold", textPrimary)}>
              {contentInfo.title}
            </h3>
            {group.planNumber !== null && (
              <span className={cn("text-xs", textMuted)}>
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
            onViewDetail={
              onViewDetail ? () => onViewDetail(group.plan.id) : undefined
            }
            viewMode="daily"
          />
        </div>
        {group.sequence && (
          <p className={cn("text-sm", textSecondary)}>({sequenceText})</p>
        )}

        {/* 플랜 정보 */}
        <div className="flex flex-col gap-3">
          {(() => {
            const plan = group.plan;
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
                campMode={campMode}
              />
            );
          })()}
        </div>

        {/* 집계 정보 */}
        <div className={cn("rounded-lg p-3", bgPage)}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className={textSecondary}>전체 진행률</span>
              <span className={cn("font-semibold", textPrimary)}>
                {aggregatedInfo.totalProgress}%
              </span>
            </div>
            <ProgressBar
              value={aggregatedInfo.totalProgress}
              color="indigo"
              size="sm"
            />
            <div
              className={cn(
                "flex items-center justify-between text-xs",
                textMuted
              )}
            >
              <span>총 학습 시간: {formatTime(aggregatedInfo.totalStudyTime)}</span>
              <span>
                활성: {aggregatedInfo.activePlansCount} | 완료:{" "}
                {aggregatedInfo.completedPlansCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 그룹 제어 버튼 */}
      <TimerControlButtons
        planId={aggregatedInfo.activePlan?.id || group.plan.id || ""}
        isActive={isGroupRunning}
        isPaused={isGroupPaused}
        isCompleted={aggregatedInfo.completedPlansCount === 1}
        isLoading={isLoading}
        onStart={handleGroupStart}
        onPause={handleGroupPause}
        onResume={handleGroupResume}
        onComplete={handleGroupComplete}
        campMode={campMode}
      />

      {/* 메모 모달 */}
      <PlanMemoModal
        group={group}
        memo={memo ?? null}
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
