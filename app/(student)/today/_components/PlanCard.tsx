"use client";

import { useMemo, memo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlanGroup } from "../_utils/planGroupUtils";
import { getActivePlan, getTimeStats } from "../_utils/planGroupUtils";
import { PlanTimer } from "./PlanTimer";
import { PlanProgressBadge, PlanPriorityIndicator } from "./PlanProgressBadge";
import { InlineContentLinkModal } from "./InlineContentLinkModal";
import { Clock, Check, LinkIcon } from "lucide-react";
import { usePlanCardActions } from "@/lib/hooks/usePlanCardActions";
import {
  bgSurface,
  borderDefault,
  textPrimary,
  textSecondary,
  getIndigoTextClasses,
  completedPlanStyles,
  getCompletedPlanClasses,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type PlanCardProps = {
  group: PlanGroup;
  sessions: Map<string, {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>;
  planDate: string;
  viewMode: "single" | "daily";
  onViewDetail?: (planId: string) => void;
  serverNow?: number;
  campMode?: boolean;
  /** 학생 ID - 인라인 콘텐츠 연결 모달에 필요 */
  studentId?: string;
};

function PlanCardComponent({
  group,
  sessions,
  planDate,
  viewMode,
  onViewDetail,
  serverNow = Date.now(),
  campMode = false,
  studentId,
}: PlanCardProps) {
  const router = useRouter();

  // 인라인 콘텐츠 연결 모달 상태
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // 가상 플랜 관련 필드 (타입 단언으로 접근)
  const isVirtual = (group.plan as { is_virtual?: boolean | null }).is_virtual === true;
  const slotIndex = (group.plan as { slot_index?: number | null }).slot_index;
  const virtualSubjectCategory = (group.plan as { virtual_subject_category?: string | null }).virtual_subject_category;
  const virtualDescription = (group.plan as { virtual_description?: string | null }).virtual_description;
  const planGroupId = (group.plan as { plan_group_id?: string | null }).plan_group_id;

  // 콘텐츠 연결 처리 - 인라인 모달 사용 (studentId가 있는 경우)
  const handleLinkContent = useCallback(() => {
    if (!isVirtual) return;

    // studentId가 있으면 인라인 모달 사용
    if (studentId) {
      setIsLinkModalOpen(true);
      return;
    }

    // studentId가 없으면 기존 방식 (페이지 이동)
    if (planGroupId) {
      router.push(`/plan/group/${planGroupId}/add-content?planId=${group.plan.id}&slotIndex=${slotIndex ?? 0}`);
    }
  }, [isVirtual, studentId, planGroupId, group.plan.id, slotIndex, router]);

  // Hook으로 추출된 액션 및 상태
  const {
    isLoading,
    pendingAction,
    isPausedState,
    isRunning,
    timerState,
    handleStart,
    handlePause,
    handleResume,
    handleComplete,
    handlePostponePlan,
    canPostpone,
  } = usePlanCardActions({ group, sessions, campMode });

  // 완료 상태 확인
  const isCompleted = !!group.plan.actual_end_time;

  // 콘텐츠 정보
  const contentInfo = useMemo(
    () => ({
      title: isVirtual
        ? virtualDescription || "콘텐츠를 연결해주세요"
        : group.content?.title || "제목 없음",
      icon:
        group.plan.content_type === "book"
          ? "📚"
          : group.plan.content_type === "lecture"
          ? "🎧"
          : "📝",
      subtitle: isVirtual ? virtualSubjectCategory || "과목 미정" : null,
    }),
    [group.content?.title, group.plan.content_type, isVirtual, virtualDescription, virtualSubjectCategory]
  );

  const activePlan = useMemo(
    () => getActivePlan(group, sessions),
    [group, sessions]
  );

  // 시간 통계
  const timeStats = useMemo(
    () => getTimeStats([group.plan], activePlan, sessions),
    [group.plan, activePlan, sessions]
  );

  const planTimeRange =
    group.plan.start_time && group.plan.end_time
      ? `${group.plan.start_time} ~ ${group.plan.end_time}`
      : null;

  const getChapterIcon = (contentType: PlanGroup["plan"]["content_type"]) => {
    if (contentType === "book") return "📖";
    if (contentType === "lecture") return "🎧";
    return "📝";
  };

  const getRangeLabel = (planData: PlanGroup["plan"]) => {
    const { planned_start_page_or_time: start, planned_end_page_or_time: end, content_type } = planData;
    if (start === null || end === null) {
      return null;
    }
    if (content_type === "book") {
      return `📄 페이지: ${start} ~ ${end}`;
    }
    if (content_type === "lecture") {
      return `🎧 강의: ${start} ~ ${end}`;
    }
    return `📝 범위: ${start} ~ ${end}`;
  };

  const planChapterIcon = getChapterIcon(group.plan.content_type);
  const planRangeLabel = getRangeLabel(group.plan);

  // 단일 뷰
  if (viewMode === "single") {
    return (
    <>
      <div
        className={cn(
          "flex flex-col gap-6",
          isCompleted && completedPlanStyles.container
        )}
      >
        {/* 헤더 */}
        <div className="flex flex-col items-center gap-3 text-center">
          {/* 가상 플랜 뱃지 */}
          {isVirtual && (
            <div className="inline-flex items-center gap-2 self-center">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                플랜 준비중
              </span>
            </div>
          )}
          {/* 완료 표시 */}
          {!isVirtual && isCompleted && (
            <div className="inline-flex items-center gap-2 self-center">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              </span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                완료됨
              </span>
            </div>
          )}
          {planTimeRange && (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-1 text-sm font-semibold shadow-[var(--elevation-1)]",
                bgSurface,
                getIndigoTextClasses("heading")
              )}
            >
              <Clock
                className={cn("h-4 w-4", getIndigoTextClasses("icon"))}
                aria-hidden="true"
              />
              <span>{planTimeRange}</span>
            </div>
          )}
          <div className="text-4xl">{contentInfo.icon}</div>
          <h2
            className={cn(
              "text-2xl font-bold",
              isVirtual
                ? "italic text-blue-700 dark:text-blue-400"
                : isCompleted
                ? completedPlanStyles.title
                : textPrimary
            )}
          >
            {contentInfo.title}
          </h2>
          {/* 가상 플랜: 과목 카테고리 표시 */}
          {isVirtual && contentInfo.subtitle && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-800 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              {contentInfo.subtitle}
            </span>
          )}
          {/* 일반 플랜: 챕터/범위 정보 */}
          {!isVirtual && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl" aria-hidden="true">
                  {planChapterIcon}
                </span>
                <div className="flex flex-col gap-1">
                  <span className={cn("text-sm font-semibold", textPrimary)}>
                    {group.plan.chapter || "챕터 정보 없음"}
                  </span>
                </div>
              </div>
              {planRangeLabel && (
                <div className={cn("text-sm", textSecondary)}>{planRangeLabel}</div>
              )}
            </>
          )}
          {/* 진행률 표시 (단일 뷰) - 가상 플랜이 아닌 경우만 */}
          {!isVirtual && !isCompleted && (
            <div className="mt-3 w-full max-w-xs">
              <PlanProgressBadge
                progress={group.plan.progress ?? 0}
                status={group.plan.status}
              />
            </div>
          )}
        </div>

        {/* 가상 플랜: 콘텐츠 연결 버튼 */}
        {isVirtual ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              학습을 시작하려면 먼저 콘텐츠를 연결해주세요
            </p>
            <button
              type="button"
              onClick={handleLinkContent}
              className="flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors shadow-[var(--elevation-2)]"
            >
              <LinkIcon className="h-5 w-5" />
              콘텐츠 연결하기
            </button>
          </div>
        ) : (
          /* 타이머 */
          <PlanTimer
            planId={group.plan.id}
            timeStats={timeStats}
            isPaused={isPausedState}
            isActive={isRunning}
            isLoading={isLoading}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
            pendingAction={pendingAction}
            onPostpone={canPostpone ? () => handlePostponePlan(group.plan.id) : undefined}
            canPostpone={canPostpone}
            status={timerState.status}
            accumulatedSeconds={timerState.accumulatedSeconds}
            startedAt={timerState.startedAt}
            serverNow={serverNow}
          />
        )}
      </div>

      {/* 인라인 콘텐츠 연결 모달 */}
      {studentId && (
        <InlineContentLinkModal
          open={isLinkModalOpen}
          onOpenChange={setIsLinkModalOpen}
          planId={group.plan.id}
          studentId={studentId}
          subjectCategory={virtualSubjectCategory}
          slotDescription={virtualDescription}
        />
      )}
    </>
    );
  }

  // 일일 뷰 - 모바일 친화적 카드 레이아웃
  return (
    <>
    <div
      className={cn(
        "rounded-xl border p-4 shadow-[var(--elevation-1)] transition-base sm:p-5",
        isVirtual
          ? "border-dashed border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20"
          : isCompleted
          ? getCompletedPlanClasses("subtle")
          : cn("hover:shadow-[var(--elevation-4)]", borderDefault, bgSurface)
      )}
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* 카드 헤더 */}
        <div className="flex flex-col gap-3 text-center sm:text-left">
          {/* 가상 플랜 뱃지 */}
          {isVirtual && (
            <div className="inline-flex items-center gap-2 self-center sm:self-start">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <LinkIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                플랜 준비중
              </span>
            </div>
          )}
          {/* 완료 표시 */}
          {!isVirtual && isCompleted && (
            <div className="inline-flex items-center gap-2 self-center sm:self-start">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              </span>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                완료됨
              </span>
            </div>
          )}
          {planTimeRange && (
            <div
              className={cn(
                "inline-flex items-center justify-center gap-2 self-center rounded-md px-3 py-1 text-xs font-semibold shadow-[var(--elevation-1)] sm:self-start",
                bgSurface,
                getIndigoTextClasses("heading")
              )}
            >
              <Clock
                className={cn("h-4 w-4", getIndigoTextClasses("icon"))}
                aria-hidden="true"
              />
              <span>{planTimeRange}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-lg">
              <span>{contentInfo.icon}</span>
              <h3
                className={cn(
                  "font-semibold",
                  isVirtual
                    ? "italic text-blue-700 dark:text-blue-400"
                    : isCompleted
                    ? completedPlanStyles.title
                    : textPrimary
                )}
              >
                {contentInfo.title}
              </h3>
            </div>
            {!isVirtual && onViewDetail && (
              <button
                onClick={() => onViewDetail(group.plan.id)}
                className={cn("text-sm font-semibold", getIndigoTextClasses("link"))}
              >
                상세보기 →
              </button>
            )}
          </div>
          {/* 가상 플랜: 과목 카테고리 표시 */}
          {isVirtual && contentInfo.subtitle && (
            <span className="self-center sm:self-start rounded-full bg-blue-100 dark:bg-blue-800 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
              {contentInfo.subtitle}
            </span>
          )}
          {/* 일반 플랜: 챕터/범위 정보 */}
          {!isVirtual && (
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {planChapterIcon}
                </span>
                <span className={cn("text-sm font-semibold", textPrimary)}>
                  {group.plan.chapter || "챕터 정보 없음"}
                </span>
              </div>
              {planRangeLabel && (
                <div className={cn("text-sm", textSecondary)}>{planRangeLabel}</div>
              )}
            </div>
          )}
          {/* 진행률 및 우선순위 표시 - 가상 플랜이 아닌 경우만 */}
          {!isVirtual && !isCompleted && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <PlanProgressBadge
                progress={group.plan.progress ?? 0}
                status={group.plan.status}
                compact
              />
              <PlanPriorityIndicator
                startTime={group.plan.start_time}
                blockIndex={group.plan.block_index}
                compact
              />
            </div>
          )}
        </div>

        {/* 가상 플랜: 콘텐츠 연결 버튼 */}
        {isVirtual ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
              학습을 시작하려면 먼저 콘텐츠를 연결해주세요
            </p>
            <button
              type="button"
              onClick={handleLinkContent}
              className="flex items-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              <LinkIcon className="h-4 w-4" />
              콘텐츠 연결
            </button>
          </div>
        ) : (
          /* 타이머 */
          <PlanTimer
            planId={group.plan.id}
            timeStats={timeStats}
            isPaused={isPausedState}
            isActive={isRunning}
            isLoading={isLoading}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
            pendingAction={pendingAction}
            onPostpone={canPostpone ? () => handlePostponePlan(group.plan.id) : undefined}
            canPostpone={canPostpone}
            compact
            status={timerState.status}
            accumulatedSeconds={timerState.accumulatedSeconds}
            startedAt={timerState.startedAt}
            serverNow={serverNow}
          />
        )}
      </div>
    </div>

    {/* 인라인 콘텐츠 연결 모달 */}
    {studentId && (
      <InlineContentLinkModal
        open={isLinkModalOpen}
        onOpenChange={setIsLinkModalOpen}
        planId={group.plan.id}
        studentId={studentId}
        subjectCategory={virtualSubjectCategory}
        slotDescription={virtualDescription}
      />
    )}
    </>
  );
}

export const PlanCard = memo(PlanCardComponent, (prevProps, nextProps) => {
  const prevPlan = prevProps.group.plan;
  const nextPlan = nextProps.group.plan;

  // 현재 플랜의 세션만 비교 (다른 플랜 세션 변경 시 리렌더링 방지)
  const prevSession = prevProps.sessions.get(prevPlan.id);
  const nextSession = nextProps.sessions.get(nextPlan.id);

  const sessionsEqual =
    prevSession?.isPaused === nextSession?.isPaused &&
    prevSession?.startedAt === nextSession?.startedAt &&
    prevSession?.pausedAt === nextSession?.pausedAt &&
    prevSession?.pausedDurationSeconds === nextSession?.pausedDurationSeconds;

  return (
    prevProps.group.planNumber === nextProps.group.planNumber &&
    prevPlan.id === nextPlan.id &&
    prevPlan.progress === nextPlan.progress &&
    prevPlan.status === nextPlan.status && // 상태 변경 감지
    prevPlan.actual_start_time === nextPlan.actual_start_time &&
    prevPlan.actual_end_time === nextPlan.actual_end_time &&
    prevProps.planDate === nextProps.planDate &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.campMode === nextProps.campMode &&
    prevProps.serverNow === nextProps.serverNow &&
    prevProps.studentId === nextProps.studentId &&
    sessionsEqual
  );
});
