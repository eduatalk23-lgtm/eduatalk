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
import { TimerLogSection } from "./TimerLogSection";
import { startPlan, pausePlan, resumePlan } from "../actions/todayActions";
import { savePlanMemo } from "../actions/planMemoActions";
import { adjustPlanRanges } from "../actions/planRangeActions";
import { resetPlanTimer } from "../actions/timerResetActions";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getTimeStats, getActivePlan } from "../_utils/planGroupUtils";
import { getTimerLogsByPlanNumber } from "../actions/timerLogActions";
import type { TimerLog } from "../actions/timerLogActions";

type PlanGroupCardProps = {
  group: PlanGroup;
  viewMode: "daily" | "single";
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string; // 플랜 날짜 (메모 조회용)
  memo?: string | null; // 메모 내용
  totalPages?: number; // 콘텐츠 총량 (범위 조정용)
  onViewDetail?: () => void; // 일일 뷰에서 단일 뷰로 전환할 때
};

export function PlanGroupCard({
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
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);

  const contentTitle = group.content?.title || "제목 없음";
  const contentTypeIcon =
    group.plans[0]?.content_type === "book"
      ? "📚"
      : group.plans[0]?.content_type === "lecture"
      ? "🎧"
      : "📝";

  // 집계 정보 계산
  const totalProgress = calculateGroupProgress(group);
  const totalStudyTime = calculateGroupTotalStudyTime(group);
  const activePlansCount = getActivePlansCount(group, sessions);
  const completedPlansCount = getCompletedPlansCount(group);

  // 활성 플랜 찾기
  const activePlan = getActivePlan(group, sessions);

  const isGroupRunning = !!activePlan;
  const isGroupPaused =
    activePlansCount > 0 &&
    group.plans.some((plan) => sessions.get(plan.id)?.isPaused);

  // 시간 통계 계산
  const timeStats = getTimeStats(group.plans, activePlan, sessions);

  // 그룹 타이머 제어 핸들러
  const handleGroupStart = async () => {
    // 그룹 내 첫 번째 대기 중인 플랜 시작
    const waitingPlan = group.plans.find(
      (plan) => !plan.actual_start_time && !plan.actual_end_time
    );
    if (!waitingPlan) return;

    setIsLoading(true);
    try {
      const result = await startPlan(waitingPlan.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupPause = async () => {
    // 모든 활성 플랜 일시정지
    const activePlanIds = group.plans
      .filter(
        (plan) =>
          plan.actual_start_time &&
          !plan.actual_end_time &&
          (!sessions.get(plan.id)?.isPaused)
      )
      .map((plan) => plan.id);

    if (activePlanIds.length === 0) {
      alert("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[PlanGroupCard] 일시정지 시작, 활성 플랜 IDs:", activePlanIds);
      
      const results = await Promise.all(
        activePlanIds.map(async (planId) => {
          try {
            console.log(`[PlanGroupCard] 플랜 ${planId} 일시정지 시도...`);
            const result = await pausePlan(planId);
            console.log(`[PlanGroupCard] 플랜 ${planId} 일시정지 결과:`, result);
            if (!result.success) {
              console.error(`[PlanGroupCard] 플랜 ${planId} 일시정지 실패:`, result.error);
            }
            return result;
          } catch (error) {
            console.error(`[PlanGroupCard] 플랜 ${planId} 일시정지 예외:`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          }
        })
      );
      
      const failedResults = results.filter((r) => !r.success);
      if (failedResults.length > 0) {
        const errorMessages = failedResults.map((r) => r.error || "알 수 없는 오류").join(", ");
        console.error("[PlanGroupCard] 일시정지 실패 상세:", JSON.stringify(failedResults, null, 2));
        alert(`일시정지에 실패했습니다: ${errorMessages}`);
      } else {
        console.log("[PlanGroupCard] 모든 플랜 일시정지 성공, 페이지 새로고침");
        router.refresh();
      }
    } catch (error) {
      console.error("[PlanGroupCard] 일시정지 오류:", error);
      alert("오류가 발생했습니다: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupResume = async () => {
    // 모든 일시정지된 플랜 재개
    const pausedPlanIds = group.plans
      .filter((plan) => sessions.get(plan.id)?.isPaused)
      .map((plan) => plan.id);

    setIsLoading(true);
    try {
      await Promise.all(pausedPlanIds.map((planId) => resumePlan(planId)));
      router.refresh();
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupComplete = () => {
    // 완료 페이지는 개별 플랜 단위로 처리
    if (activePlan) {
      router.push(`/today/plan/${activePlan.id}`);
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
    if (!confirm("타이머 기록을 초기화하시겠습니까?\n\n초기화하면 다음 정보가 삭제됩니다:\n- 시작/종료 시간\n- 학습 시간 기록\n- 일시정지 기록\n- 타이머 로그\n\n이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPlanTimer(group.planNumber, planDate);
      if (result.success) {
        router.refresh();
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

  // 콘텐츠 총량 계산 (totalPages가 없으면 첫 번째 플랜의 콘텐츠에서 추정)
  const getTotalPages = () => {
    if (totalPages !== undefined && totalPages > 0) {
      return totalPages;
    }
    // 기본값: 가장 큰 endPageOrTime을 총량으로 추정
    const maxEnd = Math.max(
      ...group.plans.map((p) => p.planned_end_page_or_time ?? 0)
    );
    return maxEnd || 100;
  };

  const isBook = group.plans[0]?.content_type === "book";

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
          <div className="mb-2 text-4xl">{contentTypeIcon}</div>
          <h2 className="text-2xl font-bold text-gray-900">{contentTitle}</h2>
        </div>

        {/* 플랜 상세 정보 */}
        <PlanDetailInfo group={group} />

        {/* 시간 체크 섹션 */}
        <TimeCheckSection
          timeStats={timeStats}
          isPaused={isGroupPaused}
          activePlanStartTime={activePlan?.actual_start_time ?? null}
          planId={activePlan?.id || group.plans[0]?.id || ""}
          isActive={isGroupRunning}
          isLoading={isLoading}
          planNumber={group.planNumber}
          planDate={planDate}
          onStart={handleGroupStart}
          onPause={handleGroupPause}
          onResume={handleGroupResume}
          onComplete={handleGroupComplete}
          onReset={handleResetTimer}
        />

        {/* 타이머 로그 섹션 */}
        <TimerLogSection logs={timerLogs} />

        {/* 전체 진행률 및 시간 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-center">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              전체 진행률
            </h3>
            <div className="mb-2 text-3xl font-bold text-indigo-600">
              {totalProgress}%
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">총 학습 시간</p>
            <p className="text-2xl font-bold text-indigo-600">
              {formatTime(totalStudyTime)}
            </p>
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
          totalPages={getTotalPages()}
          isBook={isBook}
        />
      </div>
    );
  }

  // 일일 뷰: 컴팩트한 카드 형태
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 카드 헤더 */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{contentTypeIcon}</span>
            <h3 className="font-semibold text-gray-900">{contentTitle}</h3>
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
      </div>

      {/* 개별 플랜 블록 */}
      <div className="mb-4 space-y-3">
        {group.plans.map((plan) => (
          <PlanItem
            key={plan.id}
            plan={plan}
            isGrouped={true}
            isActive={plan.id === activePlan?.id}
            showTimer={
              !!plan.actual_start_time ||
              !!plan.actual_end_time ||
              sessions.has(plan.id)
            }
            viewMode="daily"
          />
        ))}
      </div>

      {/* 집계 정보 */}
      <div className="mb-4 rounded-lg bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">전체 진행률</span>
          <span className="font-semibold text-gray-900">{totalProgress}%</span>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 학습 시간: {formatTime(totalStudyTime)}</span>
          <span>
            활성: {activePlansCount} | 완료: {completedPlansCount}
          </span>
        </div>
      </div>

      {/* 그룹 제어 버튼 */}
      <TimerControlButtons
        planId={activePlan?.id || group.plans[0]?.id || ""}
        isActive={isGroupRunning}
        isPaused={isGroupPaused}
        isCompleted={completedPlansCount === group.plans.length}
        isLoading={isLoading}
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
        totalPages={getTotalPages()}
        isBook={isBook}
      />
    </div>
  );
}

