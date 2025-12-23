"use client";

import React, { memo, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { ContentSlot } from "@/lib/types/content-selection";
import {
  calculateVirtualTimeline,
  groupPlansByDate,
  groupPlansByWeek,
  type DailyScheduleInfo,
  type VirtualTimelineResult,
  type VirtualPlanItem,
} from "@/lib/plan/virtualSchedulePreview";
import {
  Calendar,
  Clock,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  CalendarDays,
  List,
  Link2,
  Unlink2,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type ViewMode = "daily" | "weekly" | "list";

type VirtualTimelinePreviewProps = {
  slots: ContentSlot[];
  dailySchedules: DailyScheduleInfo[];
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

const getSlotTypeColor = (
  slotType: ContentSlot["slot_type"]
): { bg: string; border: string; text: string } => {
  switch (slotType) {
    case "book":
      return {
        bg: "bg-blue-100",
        border: "border-blue-300",
        text: "text-blue-700",
      };
    case "lecture":
      return {
        bg: "bg-green-100",
        border: "border-green-300",
        text: "text-green-700",
      };
    case "custom":
      return {
        bg: "bg-purple-100",
        border: "border-purple-300",
        text: "text-purple-700",
      };
    case "self_study":
      return {
        bg: "bg-orange-100",
        border: "border-orange-300",
        text: "text-orange-700",
      };
    case "test":
      return {
        bg: "bg-red-100",
        border: "border-red-300",
        text: "text-red-700",
      };
    default:
      return {
        bg: "bg-gray-100",
        border: "border-gray-300",
        text: "text-gray-700",
      };
  }
};

const SLOT_TYPE_LABEL: Record<string, string> = {
  book: "교재",
  lecture: "강의",
  custom: "커스텀",
  self_study: "자습",
  test: "테스트",
};

// ============================================================================
// 컴포넌트
// ============================================================================

function VirtualTimelinePreviewComponent({
  slots,
  dailySchedules,
  className,
}: VirtualTimelinePreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  // 가상 타임라인 계산
  const result = useMemo<VirtualTimelineResult | null>(() => {
    if (slots.length === 0 || dailySchedules.length === 0) {
      return null;
    }
    return calculateVirtualTimeline(slots, dailySchedules);
  }, [slots, dailySchedules]);

  // 뷰 모드별 데이터
  const groupedByDate = useMemo(() => {
    if (!result) return {};
    return groupPlansByDate(result);
  }, [result]);

  const groupedByWeek = useMemo(() => {
    if (!result) return {};
    return groupPlansByWeek(result);
  }, [result]);

  // 데이터가 없는 경우
  if (!result || result.plans.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8",
          className
        )}
      >
        <Calendar className="mb-2 h-8 w-8 text-gray-400" />
        <div className="text-center text-sm text-gray-500">
          슬롯을 구성하면 가상 타임라인 미리보기가 표시됩니다
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 헤더 및 요약 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-medium text-gray-700">
            가상 타임라인 미리보기
          </h3>
        </div>

        {/* 뷰 모드 전환 - 모바일에서 더 큰 버튼 */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode("daily")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors sm:flex-initial sm:px-2 sm:py-1 sm:text-xs",
              viewMode === "daily"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 active:bg-gray-200 sm:hover:text-gray-900"
            )}
          >
            <CalendarDays className="h-4 w-4 sm:h-3 sm:w-3" />
            일별
          </button>
          <button
            type="button"
            onClick={() => setViewMode("weekly")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors sm:flex-initial sm:px-2 sm:py-1 sm:text-xs",
              viewMode === "weekly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 active:bg-gray-200 sm:hover:text-gray-900"
            )}
          >
            <BarChart3 className="h-4 w-4 sm:h-3 sm:w-3" />
            주별
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors sm:flex-initial sm:px-2 sm:py-1 sm:text-xs",
              viewMode === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 active:bg-gray-200 sm:hover:text-gray-900"
            )}
          >
            <List className="h-4 w-4 sm:h-3 sm:w-3" />
            리스트
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard
          label="총 학습시간"
          value={formatMinutes(result.totalStudyMinutes)}
          icon={<Clock className="h-4 w-4" />}
        />
        <SummaryCard
          label="콘텐츠 수"
          value={`${result.totalContents}개`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="학습 일수"
          value={`${Object.keys(groupedByDate).length}일`}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <SummaryCard
          label="총 주차"
          value={`${result.weekSummaries.length}주`}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* 경고 메시지 */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <div className="text-xs text-amber-700">
              {result.warnings.map((warning, index) => (
                <div key={index}>{warning}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 교과별 분배 */}
      <SubjectDistributionBar
        distribution={result.subjectDistribution}
        totalMinutes={result.totalStudyMinutes}
      />

      {/* 뷰 모드별 콘텐츠 */}
      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 bg-white sm:max-h-[400px]">
        {viewMode === "daily" && (
          <DailyView groupedByDate={groupedByDate} />
        )}
        {viewMode === "weekly" && (
          <WeeklyView weekSummaries={result.weekSummaries} />
        )}
        {viewMode === "list" && <ListView plans={result.plans} />}
      </div>
    </div>
  );
}

// ============================================================================
// 하위 컴포넌트
// ============================================================================

type SummaryCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function SummaryCard({ label, value, icon }: SummaryCardProps) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 sm:p-3">
      <div className="mb-1 flex items-center gap-1 text-gray-400">{icon}</div>
      <div className="text-base font-semibold text-gray-900 sm:text-lg">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

type SubjectDistributionBarProps = {
  distribution: VirtualTimelineResult["subjectDistribution"];
  totalMinutes: number;
};

function SubjectDistributionBar({
  distribution,
  totalMinutes,
}: SubjectDistributionBarProps) {
  if (distribution.length === 0) return null;

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-cyan-500",
    "bg-pink-500",
  ];

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="mb-2 text-xs font-medium text-gray-700">교과별 분배</div>
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-gray-200">
        {distribution.map((item, index) => (
          <div
            key={item.subject_category}
            className={cn("h-full", colors[index % colors.length])}
            style={{ width: `${item.percentage}%` }}
            title={`${item.subject_category}: ${formatMinutes(item.total_minutes)} (${item.percentage}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {distribution.map((item, index) => (
          <div key={item.subject_category} className="flex items-center gap-1">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                colors[index % colors.length]
              )}
            />
            <span className="text-xs text-gray-600">
              {item.subject_category} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type DailyViewProps = {
  groupedByDate: Record<string, VirtualPlanItem[]>;
};

function DailyView({ groupedByDate }: DailyViewProps) {
  const dates = Object.keys(groupedByDate).sort();

  return (
    <div className="divide-y divide-gray-100">
      {dates.slice(0, 14).map((date) => {
        const plans = groupedByDate[date];
        const totalMinutes = plans.reduce((sum, p) => sum + p.duration_minutes, 0);

        return (
          <div key={date} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {formatDate(date)}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    plans[0]?.day_type === "학습일"
                      ? "bg-blue-100 text-blue-700"
                      : plans[0]?.day_type === "복습일"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                  )}
                >
                  {plans[0]?.day_type}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatMinutes(totalMinutes)}
              </span>
            </div>

            <div className="space-y-1">
              {plans.map((plan, index) => (
                <PlanItemRow key={index} plan={plan} sameDayPlans={plans} />
              ))}
            </div>
          </div>
        );
      })}
      {dates.length > 14 && (
        <div className="p-3 text-center text-xs text-gray-500">
          +{dates.length - 14}일 더 있습니다
        </div>
      )}
    </div>
  );
}

type WeeklyViewProps = {
  weekSummaries: VirtualTimelineResult["weekSummaries"];
};

function WeeklyView({ weekSummaries }: WeeklyViewProps) {
  return (
    <div className="divide-y divide-gray-100">
      {weekSummaries.map((week) => (
        <div key={week.week_number} className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {week.week_number}주차
            </span>
            <span className="text-xs text-gray-500">
              {formatMinutes(week.total_minutes)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-blue-50 p-2 text-center">
              <div className="font-medium text-blue-700">
                {week.study_days}일
              </div>
              <div className="text-blue-600">학습일</div>
            </div>
            <div className="rounded bg-green-50 p-2 text-center">
              <div className="font-medium text-green-700">
                {week.review_days}일
              </div>
              <div className="text-green-600">복습일</div>
            </div>
            <div className="rounded bg-gray-50 p-2 text-center">
              <div className="font-medium text-gray-700">
                {Object.keys(week.subjects).length}개
              </div>
              <div className="text-gray-600">교과</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ListViewProps = {
  plans: VirtualPlanItem[];
};

function ListView({ plans }: ListViewProps) {
  // 날짜별로 그룹화하여 sameDayPlans 전달
  const plansByDate = useMemo(() => {
    const grouped: Record<string, VirtualPlanItem[]> = {};
    plans.forEach((plan) => {
      if (!grouped[plan.date]) grouped[plan.date] = [];
      grouped[plan.date].push(plan);
    });
    return grouped;
  }, [plans]);

  return (
    <div className="divide-y divide-gray-100">
      {plans.slice(0, 30).map((plan, index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          <div className="w-20 flex-shrink-0 text-xs text-gray-500">
            {formatDate(plan.date)}
          </div>
          <PlanItemRow plan={plan} sameDayPlans={plansByDate[plan.date]} />
        </div>
      ))}
      {plans.length > 30 && (
        <div className="p-3 text-center text-xs text-gray-500">
          +{plans.length - 30}개 더 있습니다
        </div>
      )}
    </div>
  );
}

type PlanItemRowProps = {
  plan: VirtualPlanItem;
  /** 같은 날 다른 플랜 목록 (연계 표시용) */
  sameDayPlans?: VirtualPlanItem[];
};

function PlanItemRow({ plan, sameDayPlans = [] }: PlanItemRowProps) {
  const colors = getSlotTypeColor(plan.slot_type);

  // 연계 관계 확인
  const hasLinkedRelation =
    plan.linked_to_slot_index !== undefined || plan.linked_group_id !== undefined;

  // 배타적 관계 확인 (같은 날에 배타적 슬롯이 없어야 정상)
  const hasExclusiveRelation =
    plan.exclusive_with_indices && plan.exclusive_with_indices.length > 0;

  // 같은 날 연계 슬롯 연결 표시 (다음 슬롯이 이 슬롯과 연계되어 있는지)
  const isLinkedToNext = sameDayPlans.some(
    (p) =>
      p.linked_to_slot_index === plan.slot_index &&
      p.link_type === "after"
  );

  return (
    <div className="relative">
      {/* 연계 연결선 (다음 슬롯과 연결됨) */}
      {isLinkedToNext && (
        <div className="absolute -bottom-1 left-4 z-10 flex h-2 w-px items-center justify-center bg-indigo-300">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-2 py-1.5",
          colors.bg,
          colors.border,
          // 연계 슬롯은 왼쪽에 인디고 테두리
          hasLinkedRelation && "border-l-2 border-l-indigo-400"
        )}
      >
        {/* 관계 아이콘 */}
        {(hasLinkedRelation || hasExclusiveRelation) && (
          <div className="flex items-center gap-0.5">
            {hasLinkedRelation && (
              <Link2 className="h-3 w-3 text-indigo-500" />
            )}
            {hasExclusiveRelation && (
              <Unlink2 className="h-3 w-3 text-amber-500" />
            )}
          </div>
        )}

        <span className={cn("text-xs font-medium", colors.text)}>
          {plan.start_time}-{plan.end_time}
        </span>
        <ChevronRight className="h-3 w-3 text-gray-400" />
        <div className="flex-1 truncate">
          <span className="text-xs text-gray-600">{plan.subject_category}</span>
          {plan.title && (
            <span className="ml-1 text-xs font-medium text-gray-800">
              {plan.title}
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-xs text-gray-400">
          {SLOT_TYPE_LABEL[plan.slot_type || ""] || ""}
        </span>
      </div>
    </div>
  );
}

export const VirtualTimelinePreview = memo(VirtualTimelinePreviewComponent);
