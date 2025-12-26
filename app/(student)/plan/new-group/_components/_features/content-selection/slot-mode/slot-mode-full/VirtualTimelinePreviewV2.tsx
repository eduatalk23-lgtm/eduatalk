"use client";

import React, { memo, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { ContentSlot } from "@/lib/types/content-selection";
import type { StudyReviewCycle, DailyScheduleInfo } from "@/lib/types/plan";
import type { SimpleExclusion } from "@/lib/plan/virtualSchedulePreviewV2";
import {
  calculateVirtualTimelineV2,
  groupPlansByDateV2,
  groupPlansByCycleV2,
  type VirtualTimelineResultV2,
  type VirtualPlanItemV2,
  type SubjectTimeDistributionV2,
  type CycleSummaryV2,
} from "@/lib/plan/virtualSchedulePreviewV2";
import {
  Calendar,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  BarChart3,
  CalendarDays,
  List,
  Target,
  BookOpen,
  RefreshCcw,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type ViewMode = "cycle" | "daily" | "list";

type VirtualTimelinePreviewV2Props = {
  slots: ContentSlot[];
  studyReviewCycle: StudyReviewCycle;
  periodStart: string;
  periodEnd: string;
  exclusions?: SimpleExclusion[];
  /** Step 3에서 계산된 일별 스케줄 (time_slots 포함) */
  dailySchedule?: DailyScheduleInfo[];
  className?: string;
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${month}/${day} (${dayOfWeek})`;
};

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
};

const getSlotTypeLabel = (slotType: ContentSlot["slot_type"]): string => {
  switch (slotType) {
    case "book":
      return "교재";
    case "lecture":
      return "강의";
    case "self_study":
      return "자습";
    default:
      return "";
  }
};

const getSlotTypeColor = (
  slotType: ContentSlot["slot_type"]
): { bg: string; border: string; text: string } => {
  switch (slotType) {
    case "book":
      return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" };
    case "lecture":
      return { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" };
    case "self_study":
      return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" };
    default:
      return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" };
  }
};

const getSubjectTypeBadge = (subjectType: "strategy" | "weakness" | null) => {
  if (subjectType === "strategy") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
        <Target className="h-2.5 w-2.5" />
        전략
      </span>
    );
  }
  if (subjectType === "weakness") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">
        <BookOpen className="h-2.5 w-2.5" />
        취약
      </span>
    );
  }
  return null;
};

// ============================================================================
// 서브 컴포넌트: 과목 배분 요약
// ============================================================================

const SubjectDistributionSummary = memo(function SubjectDistributionSummary({
  distribution,
  cycleInfo,
}: {
  distribution: SubjectTimeDistributionV2[];
  cycleInfo: { studyDaysPerCycle: number; reviewDaysPerCycle: number };
}) {
  const weaknessSubjects = distribution.filter((d) => d.subject_type === "weakness");
  const strategySubjects = distribution.filter((d) => d.subject_type === "strategy");

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
        <BarChart3 className="h-4 w-4" />
        과목 배분 요약 ({cycleInfo.studyDaysPerCycle}-{cycleInfo.reviewDaysPerCycle} 주기)
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 취약과목 */}
        <div>
          <div className="mb-1 text-xs font-medium text-yellow-700">
            취약과목 (매일)
          </div>
          <div className="space-y-1">
            {weaknessSubjects.map((subj) => (
              <div
                key={subj.subject_category}
                className="flex items-center gap-2 text-xs"
              >
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-yellow-400"
                    style={{ width: `${subj.percentage}%` }}
                  />
                </div>
                <span className="w-20 truncate text-gray-600">
                  {subj.subject_category}
                </span>
              </div>
            ))}
            {weaknessSubjects.length === 0 && (
              <div className="text-xs text-gray-400">없음</div>
            )}
          </div>
        </div>

        {/* 전략과목 */}
        <div>
          <div className="mb-1 text-xs font-medium text-blue-700">
            전략과목 (주 N일)
          </div>
          <div className="space-y-1">
            {strategySubjects.map((subj) => (
              <div
                key={subj.subject_category}
                className="flex items-center gap-2 text-xs"
              >
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${subj.percentage}%` }}
                  />
                </div>
                <span className="w-20 truncate text-gray-600">
                  {subj.subject_category}
                </span>
              </div>
            ))}
            {strategySubjects.length === 0 && (
              <div className="text-xs text-gray-400">없음</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// 서브 컴포넌트: 플랜 아이템 카드
// ============================================================================

const PlanItemCard = memo(function PlanItemCard({
  plan,
}: {
  plan: VirtualPlanItemV2;
}) {
  const colors = getSlotTypeColor(plan.slot_type);
  const isReview = plan.day_type === "review";
  const isEstimated = plan.isEstimatedRange;
  const hasWarning = !!plan.warning;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2",
        // 경고가 있는 경우 빨간색 테두리
        hasWarning
          ? "border-red-300 bg-red-50"
          : isReview
            ? "border-purple-200 bg-purple-50"
            : colors.border,
        !hasWarning && !isReview && colors.bg,
        // 추정 범위인 경우 점선 테두리
        isEstimated && !hasWarning && "border-dashed"
      )}
    >
      {/* 시간 */}
      <div className="w-20 shrink-0 text-xs text-gray-500">
        {plan.start_time} - {plan.end_time}
      </div>

      {/* 콘텐츠 정보 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isReview && (
            <RefreshCcw className="h-3 w-3 shrink-0 text-purple-600" />
          )}
          <span className={cn("text-sm font-medium", isReview ? "text-purple-700" : colors.text)}>
            {plan.subject_category}
          </span>
          <span className="text-xs text-gray-500">
            {getSlotTypeLabel(plan.slot_type)}
          </span>
          {getSubjectTypeBadge(plan.subject_type)}
          {/* 추정 범위 뱃지 */}
          {isEstimated && (
            <span className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
              예상
            </span>
          )}
        </div>

        {plan.title && (
          <p className="mt-0.5 truncate text-xs text-gray-600">{plan.title}</p>
        )}

        {plan.range_start !== undefined && plan.range_end !== undefined && (
          <p className={cn(
            "text-[10px]",
            isEstimated ? "text-amber-500" : "text-gray-400"
          )}>
            {plan.slot_type === "lecture"
              ? `${plan.range_start}~${plan.range_end}회차`
              : `${plan.range_start}~${plan.range_end}p`}
            {/* 일별 분배 진행률 표시 */}
            {plan.sequence && plan.total_sequences && plan.total_sequences > 1 && (
              <span className="ml-1 text-blue-500">
                ({plan.sequence}/{plan.total_sequences})
              </span>
            )}
            {/* 일일 학습량 표시 (추정 범위인 경우) */}
            {isEstimated && plan.dailyAmount && (
              <span className="ml-1">
                (~{plan.dailyAmount}{plan.slot_type === "book" ? "p" : "회"}/일)
              </span>
            )}
          </p>
        )}

        {/* 경고 메시지 */}
        {hasWarning && (
          <p className="mt-0.5 text-[10px] font-medium text-red-600">
            ⚠ {plan.warning}
          </p>
        )}
      </div>

      {/* 소요 시간 */}
      <div className="shrink-0 text-xs text-gray-500">
        {formatMinutes(plan.duration_minutes)}
      </div>
    </div>
  );
});

// ============================================================================
// 서브 컴포넌트: 일별 그룹
// ============================================================================

const DayGroup = memo(function DayGroup({
  date,
  plans,
  cycleDay,
}: {
  date: string;
  plans: VirtualPlanItemV2[];
  cycleDay?: { cycle_day_number: number; day_type: "study" | "review" };
}) {
  const isReviewDay = cycleDay?.day_type === "review";
  const hasStrategySubject = plans.some((p) => p.subject_type === "strategy" && p.day_type === "study");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      {/* 날짜 헤더 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium text-gray-900">{formatDate(date)}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            isReviewDay
              ? "bg-purple-100 text-purple-700"
              : "bg-blue-100 text-blue-700"
          )}
        >
          {isReviewDay ? "복습일" : "학습일"} {cycleDay?.cycle_day_number}
        </span>
        {hasStrategySubject && !isReviewDay && (
          <span className="text-xs text-blue-600">✦ 전략과목</span>
        )}
      </div>

      {/* 플랜 목록 */}
      <div className="space-y-2">
        {plans.map((plan, idx) => (
          <PlanItemCard key={`${plan.slot_index}-${idx}`} plan={plan} />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// 서브 컴포넌트: 주기별 그룹
// ============================================================================

const CycleGroup = memo(function CycleGroup({
  cycleNumber,
  plans,
  summary,
}: {
  cycleNumber: number;
  plans: VirtualPlanItemV2[];
  summary?: CycleSummaryV2;
}) {
  const [isExpanded, setIsExpanded] = useState(cycleNumber === 1);

  // 날짜별로 플랜 그룹화
  const plansByDate = useMemo(() => {
    const grouped = new Map<string, VirtualPlanItemV2[]>();
    for (const plan of plans) {
      if (!grouped.has(plan.date)) {
        grouped.set(plan.date, []);
      }
      grouped.get(plan.date)!.push(plan);
    }
    return grouped;
  }, [plans]);

  // 날짜 범위 계산
  const dates = Array.from(plansByDate.keys()).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50">
      {/* 주기 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900">
            주기 {cycleNumber}
          </span>
          {startDate && endDate && (
            <span className="text-sm text-gray-500">
              ({formatDate(startDate)} ~ {formatDate(endDate)})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {summary && (
            <div className="flex gap-2 text-xs text-gray-500">
              <span>학습 {summary.study_day_count}일</span>
              <span>복습 {summary.review_day_count}일</span>
              <span>{formatMinutes(summary.total_study_minutes + summary.total_review_minutes)}</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* 주기 내용 */}
      {isExpanded && (
        <div className="space-y-3 border-t border-gray-200 p-3">
          {Array.from(plansByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, datePlans]) => {
              const firstPlan = datePlans[0];
              return (
                <DayGroup
                  key={date}
                  date={date}
                  plans={datePlans}
                  cycleDay={{
                    cycle_day_number: firstPlan.cycle_day_number,
                    day_type: firstPlan.day_type,
                  }}
                />
              );
            })}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function VirtualTimelinePreviewV2Component({
  slots,
  studyReviewCycle,
  periodStart,
  periodEnd,
  exclusions = [],
  dailySchedule,
  className,
}: VirtualTimelinePreviewV2Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("cycle");

  // 가상 타임라인 계산
  const result = useMemo<VirtualTimelineResultV2>(() => {
    return calculateVirtualTimelineV2(slots, {
      studyReviewCycle,
      periodStart,
      periodEnd,
      exclusions,
      dailySchedule, // Step 3의 time_slots 전달
    });
  }, [slots, studyReviewCycle, periodStart, periodEnd, exclusions, dailySchedule]);

  // 주기별 그룹화
  const plansByCycle = useMemo(() => {
    return groupPlansByCycleV2(result);
  }, [result]);

  // 날짜별 그룹화
  const plansByDate = useMemo(() => {
    return groupPlansByDateV2(result);
  }, [result]);

  // 플랜이 없는 경우
  if (result.plans.length === 0) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-gray-50 p-6", className)}>
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Calendar className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            {result.warnings.length > 0
              ? result.warnings[0]
              : "슬롯을 추가하면 가상 타임라인이 표시됩니다"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          가상 타임라인 미리보기
        </h3>

        {/* 뷰 모드 토글 */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode("cycle")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "cycle"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            주기별
          </button>
          <button
            onClick={() => setViewMode("daily")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "daily"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            일별
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "list"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            리스트
          </button>
        </div>
      </div>

      {/* 과목 배분 요약 */}
      <SubjectDistributionSummary
        distribution={result.subjectDistribution}
        cycleInfo={result.cycleInfo}
      />

      {/* 통계 요약 */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            학습 {formatMinutes(result.totalStudyMinutes)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-gray-600">
            복습 {formatMinutes(result.totalReviewMinutes)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {result.cycleInfo.totalCycles}주기
          </span>
        </div>
        {result.totalContents > 0 && (
          <div className="text-sm text-gray-600">
            {result.totalContents}개 콘텐츠
          </div>
        )}
      </div>

      {/* 경고 메시지 */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
            <div className="space-y-1">
              {result.warnings.map((warning, idx) => (
                <p key={idx} className="text-sm text-yellow-700">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 타임라인 콘텐츠 */}
      <div className="max-h-[500px] overflow-y-auto">
        {viewMode === "cycle" && (
          <div className="space-y-4">
            {Array.from(plansByCycle.entries())
              .sort(([a], [b]) => a - b)
              .map(([cycleNumber, cyclePlans]) => (
                <CycleGroup
                  key={cycleNumber}
                  cycleNumber={cycleNumber}
                  plans={cyclePlans}
                  summary={result.cycleSummaries.find(
                    (s) => s.cycle_number === cycleNumber
                  )}
                />
              ))}
          </div>
        )}

        {viewMode === "daily" && (
          <div className="space-y-3">
            {Array.from(plansByDate.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, datePlans]) => {
                const firstPlan = datePlans[0];
                return (
                  <DayGroup
                    key={date}
                    date={date}
                    plans={datePlans}
                    cycleDay={{
                      cycle_day_number: firstPlan.cycle_day_number,
                      day_type: firstPlan.day_type,
                    }}
                  />
                );
              })}
          </div>
        )}

        {viewMode === "list" && (
          <div className="space-y-2">
            {result.plans.map((plan, idx) => (
              <div
                key={`${plan.date}-${plan.slot_index}-${idx}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-white p-2",
                  plan.isEstimatedRange
                    ? "border-dashed border-amber-300"
                    : "border-gray-200"
                )}
              >
                <span className="w-20 shrink-0 text-xs text-gray-500">
                  {formatDate(plan.date)}
                </span>
                <span className="w-16 shrink-0 text-xs text-gray-500">
                  {plan.start_time}
                </span>
                <span className="flex-1 truncate text-sm">
                  {plan.subject_category} - {getSlotTypeLabel(plan.slot_type)}
                  {plan.day_type === "review" && " (복습)"}
                </span>
                {getSubjectTypeBadge(plan.subject_type)}
                {plan.isEstimatedRange && (
                  <span className="inline-flex shrink-0 items-center rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                    예상
                  </span>
                )}
                <span className="shrink-0 text-xs text-gray-500">
                  {formatMinutes(plan.duration_minutes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const VirtualTimelinePreviewV2 = memo(VirtualTimelinePreviewV2Component);
export default VirtualTimelinePreviewV2;
