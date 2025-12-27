"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Calendar, BookOpen, Clock, BarChart3 } from "lucide-react";
import type { ContentScheduleSummary } from "@/lib/domains/plan/actions/contentSchedule";

type ContentScheduleCardProps = {
  content: ContentScheduleSummary;
  isExpanded?: boolean;
  onToggle?: () => void;
};

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-blue-500";
  if (percent >= 20) return "bg-yellow-500";
  return "bg-gray-300";
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "skipped":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function ContentScheduleCard({
  content,
  isExpanded = false,
  onToggle,
}: ContentScheduleCardProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  const expanded = onToggle ? isExpanded : localExpanded;
  const handleToggle = onToggle ?? (() => setLocalExpanded(!localExpanded));

  const contentTypeIcon = content.contentType === "lecture" ? "🎬" : "📚";
  const weekdayLabels = content.studyWeekdays
    .map((d) => WEEKDAY_NAMES[d])
    .join("/");

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* 헤더 (클릭하면 펼치기/접기) */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{contentTypeIcon}</span>
          <div className="text-left">
            <h3 className="font-medium text-gray-900">{content.contentTitle}</h3>
            {content.subject && (
              <p className="text-sm text-gray-500">{content.subject}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* 진행률 표시 */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(content.progressPercent)} transition-all`}
                style={{ width: `${content.progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600 w-12 text-right">
              {content.progressPercent}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* 상세 정보 (펼쳐진 상태) */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* 요약 정보 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">기간</p>
                <p className="text-sm font-medium">
                  {formatDateFull(content.startDate)} ~ {formatDateFull(content.endDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">범위</p>
                <p className="text-sm font-medium">
                  {content.startRange} ~ {content.endRange}{content.rangeUnit} (총 {content.totalRange}{content.rangeUnit})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">학습일</p>
                <p className="text-sm font-medium">
                  {weekdayLabels} ({content.studyDays}일)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">일평균</p>
                <p className="text-sm font-medium">
                  약 {content.dailyAverage}{content.rangeUnit}
                </p>
              </div>
            </div>
          </div>

          {/* 일별 배치 미리보기 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">일별 배치</h4>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {content.dailyPlans.slice(0, 14).map((plan, index) => (
                <div
                  key={`${plan.date}-${index}`}
                  className={`flex flex-col items-center px-2 py-1 rounded text-xs ${getStatusBadgeClass(plan.status)}`}
                >
                  <span className="font-medium">{formatDate(plan.date)}</span>
                  <span>
                    {plan.startPage}-{plan.endPage}
                  </span>
                </div>
              ))}
              {content.dailyPlans.length > 14 && (
                <div className="flex items-center px-2 py-1 text-xs text-gray-500">
                  +{content.dailyPlans.length - 14}개 더
                </div>
              )}
            </div>
          </div>

          {/* 진행 상태 요약 */}
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">
                완료 {content.completedPlans}개
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-600">
                대기 {content.totalPlans - content.completedPlans}개
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 콘텐츠별 스케줄 목록 컴포넌트
 */
type ContentScheduleListProps = {
  contents: ContentScheduleSummary[];
  totalPlans: number;
  overallProgress: number;
};

export function ContentScheduleList({
  contents,
  totalPlans,
  overallProgress,
}: ContentScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    contents.length > 0 ? contents[0].contentId : null
  );

  if (contents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        콘텐츠가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 전체 요약 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            총 {contents.length}개 콘텐츠
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600">
            {totalPlans}개 플랜
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">전체 진행률</span>
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(overallProgress)} transition-all`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {overallProgress}%
          </span>
        </div>
      </div>

      {/* 콘텐츠 카드 목록 */}
      <div className="space-y-3">
        {contents.map((content) => (
          <ContentScheduleCard
            key={content.contentId}
            content={content}
            isExpanded={expandedId === content.contentId}
            onToggle={() =>
              setExpandedId(
                expandedId === content.contentId ? null : content.contentId
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
