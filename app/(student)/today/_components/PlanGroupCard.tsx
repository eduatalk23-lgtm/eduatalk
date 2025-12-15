"use client";

import { PlanGroup, PlanWithContent } from "../_utils/planGroupUtils";
import {
  calculateGroupProgress,
  calculateGroupTotalStudyTime,
  getActivePlansCount,
  getCompletedPlansCount,
  formatTime,
} from "../_utils/planGroupUtils";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import { PlanItem } from "./PlanItem";
import { TimestampDisplay } from "./TimestampDisplay";
import { TimerControlButtons } from "./TimerControlButtons";
import { PlanGroupActions } from "./PlanGroupActions";
import { PlanMemoModal } from "./PlanMemoModal";
import { PlanRangeAdjustModal } from "./PlanRangeAdjustModal";
import { PlanDetailInfo } from "./PlanDetailInfo";
import { TimeCheckSection } from "./TimeCheckSection";
import { startPlan, pausePlan, resumePlan, preparePlanCompletion } from "../actions/todayActions";
import { savePlanMemo } from "../actions/planMemoActions";
import { adjustPlanRanges } from "../actions/planRangeActions";
import { resetPlanTimer } from "../actions/timerResetActions";
import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useMemo, memo } from "react";
import { getTimeStats, getActivePlan } from "../_utils/planGroupUtils";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { useToast } from "@/components/ui/ToastProvider";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { bgSurface, bgPage, textPrimary, textSecondary, textMuted, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type PlanGroupCardProps = {
  group: PlanGroup;
  viewMode: "daily" | "single";
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string; // 플랜 날짜 (메모 조회용)
  memo?: string | null; // 메모 내용
  totalPages?: number; // 콘텐츠 총량 (범위 조정용)
  onViewDetail?: (planNumber: number | null) => void; // 일일 뷰에서 단일 뷰로 전환할 때
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
  // 캠프 모드는 group.plan_type으로 자동 판단
  const campMode = group.plan_type === "camp";
  const router = useRouter();
  const timerStore = usePlanTimerStore();
  const { showError } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  // 콘텐츠 정보 (메모이제이션)
  const contentInfo = useMemo(() => ({
    title: group.content?.title || "제목 없음",
    icon: group.plan.content_type === "book"
      ? "📚"
      : group.plan.content_type === "lecture"
      ? "🎧"
      : "📝"
  }), [group.content?.title, group.plan.content_type]);

   // 집계 정보 계산 (메모이제이션)
   const aggregatedInfo = useMemo(() => ({
     totalProgress: calculateGroupProgress(group),
     totalStudyTime: calculateGroupTotalStudyTime(group, sessions),
     activePlansCount: getActivePlansCount(group, sessions),
     completedPlansCount: getCompletedPlansCount(group),
     activePlan: getActivePlan(group, sessions)
   }), [group, sessions]);

  // 그룹 상태 계산 (메모이제이션)
  const groupStatus = useMemo(() => {
    const activePlan = aggregatedInfo.activePlan;
    const isGroupRunning = !!activePlan;

    // 일시정지된 플랜이 있으면 일시정지 상태로 간주
    const plan = group.plan;
    const session = sessions.get(plan.id);
    const isGroupPaused = plan.actual_start_time &&
      !plan.actual_end_time &&
      session &&
      session.isPaused;

    // 다른 플랜이 활성화되어 있는지 확인 (현재 그룹의 플랜 제외)
    const currentGroupPlanIds = new Set([plan.id]);
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
  }, [aggregatedInfo.activePlan, group.plan, sessions]);

  // 시간 통계 계산 (메모이제이션)
  const timeStats = useMemo(() =>
    getTimeStats([group.plan], aggregatedInfo.activePlan, sessions),
    [group.plan, aggregatedInfo.activePlan, sessions]
  );

  // 그룹 타이머 제어 핸들러 (optimistic update 적용)
  const handleGroupStart = async (timestamp?: string) => {
    // 그룹 내 첫 번째 대기 중인 플랜 시작
    const plan = group.plan;
    if (plan.actual_start_time || plan.actual_end_time) return;
    const waitingPlan = plan;

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
    const plan = group.plan;
    const session = sessions.get(plan.id);
    const isActive = plan.actual_start_time &&
      !plan.actual_end_time &&
      session &&
      !session.isPaused;

    if (!isActive) {
      alert("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const clientTimestamp = new Date().toISOString();
      const result = await pausePlan(plan.id, clientTimestamp);

      if (!result.success) {
        // "이미 일시정지된 상태입니다" 또는 "활성 세션을 찾을 수 없습니다" 에러는 무시
        // (세션 상태 동기화 문제로 인한 에러일 수 있음)
        const isIgnorableError = result.error &&
          (result.error.includes("이미 일시정지된 상태입니다") ||
           result.error.includes("활성 세션을 찾을 수 없습니다"));
        
        if (!isIgnorableError) {
          alert(`일시정지에 실패했습니다: ${result.error || "알 수 없는 오류"}`);
          setIsLoading(false);
          // 에러 발생 시에만 상태 동기화를 위해 refresh
          startTransition(() => {
            router.refresh();
          });
          return;
        }
      }
      
      // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
      // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
      setIsLoading(false);
    } catch (error) {
      console.error("[PlanGroupCard] 일시정지 오류:", error);
      alert("오류가 발생했습니다: " + (error instanceof Error ? error.message : String(error)));
      setIsLoading(false);
    }
  };

  const handleGroupResume = async (timestamp?: string) => {
    // 실제로 세션이 있고 일시정지된 플랜만 재개 (세션 데이터 기반)
    const plan = group.plan;
    const session = sessions.get(plan.id);
    const isPaused = session && session.isPaused;

    if (!isPaused) {
      alert("재개할 일시정지된 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성 (전달받은 타임스탬프가 없으면 생성)
      const clientTimestamp = timestamp || new Date().toISOString();
      const result = await resumePlan(plan.id, clientTimestamp);

      if (!result.success) {
        // "활성 세션을 찾을 수 없습니다" 에러는 무시 (세션 상태 동기화 문제)
        const isIgnorableError = result.error && result.error.includes("활성 세션을 찾을 수 없습니다");
        
        if (!isIgnorableError) {
          alert(`재개에 실패했습니다: ${result.error || "알 수 없는 오류"}`);
          setIsLoading(false);
          // 에러 발생 시에만 상태 동기화를 위해 refresh
          startTransition(() => {
            router.refresh();
          });
          return;
        }
      }
      
      // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
      // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
      setIsLoading(false);
    } catch (error) {
      alert("오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleGroupComplete = async () => {
    const targetPlanId = aggregatedInfo.activePlan?.id || group.plan.id;
    
    // 확인 다이얼로그
    const confirmed = confirm(
      "지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?"
    );
    
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await preparePlanCompletion(targetPlanId);
      
      if (!result.success) {
        showError(result.error || "플랜 완료 준비에 실패했습니다.");
        return;
      }

      // 타이머 정지 (스토어에서 제거)
      timerStore.removeTimer(targetPlanId);

      // 완료 입력 페이지로 이동
      router.push(buildPlanExecutionUrl(targetPlanId, campMode));
    } catch (error) {
      console.error("[PlanGroupCard] 완료 처리 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

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
    // 기본값: endPageOrTime을 총량으로 추정
    return group.plan.planned_end_page_or_time ?? 100;
  }, [totalPages, group.plan.planned_end_page_or_time]);

  const isBook = useMemo(() =>
    group.plan.content_type === "book",
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
          isPaused={!!groupStatus.isGroupPaused}
          activePlanStartTime={aggregatedInfo.activePlan?.actual_start_time ?? null}
          planId={aggregatedInfo.activePlan?.id || group.plan.id || ""}
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
          campMode={campMode}
        />


        {/* 전체 진행률 및 시간 */}
        <div className={cn("rounded-lg border p-6 shadow-sm", bgSurface, borderDefault)}>
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
    <div className={cn("rounded-lg border p-4 shadow-sm", bgSurface, borderDefault)}>
      <div className="flex flex-col gap-4">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{contentInfo.icon}</span>
            <h3 className={cn("font-semibold", textPrimary)}>{contentInfo.title}</h3>
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
            onViewDetail={onViewDetail ? () => onViewDetail(group.planNumber) : undefined}
            viewMode="daily"
          />
        </div>
        {group.sequence && (
          <p className={cn("text-sm", textSecondary)}>({sequenceText})</p>
        )}

        {/* 플랜 정보 (같은 plan_number를 가진 플랜은 하나만 표시) */}
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
              <span className={cn("font-semibold", textPrimary)}>{aggregatedInfo.totalProgress}%</span>
            </div>
            <ProgressBar
              value={aggregatedInfo.totalProgress}
              color="indigo"
              size="sm"
            />
            <div className={cn("flex items-center justify-between text-xs", textMuted)}>
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
        planId={aggregatedInfo.activePlan?.id || group.plan.id || ""}
        isActive={groupStatus.isGroupRunning}
        isPaused={!!groupStatus.isGroupPaused}
        isCompleted={aggregatedInfo.completedPlansCount === 1}
        isLoading={isLoading || isPending}
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

