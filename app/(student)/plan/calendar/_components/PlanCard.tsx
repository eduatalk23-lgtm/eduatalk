"use client";

import { Clock } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import { CONTENT_TYPE_EMOJIS } from "../_constants/contentIcons";

type PlanCardProps = {
  plan: PlanWithContent;
  compact?: boolean;
  showTime?: boolean;
  showProgress?: boolean;
  // 연결 상태 (같은 plan_number를 가진 쪼개진 플랜들)
  isConnected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isMiddle?: boolean;
};

export function PlanCard({ 
  plan, 
  compact = false, 
  showTime = true, 
  showProgress = true,
  isConnected = false,
  isFirst = false,
  isLast = false,
  isMiddle = false,
}: PlanCardProps) {
  const contentTypeIcon = CONTENT_TYPE_EMOJIS[plan.content_type];
  const isCompleted = plan.progress !== null && plan.progress >= 100;
  const isActive = plan.actual_start_time && !plan.actual_end_time;
  const progressPercentage = plan.progress !== null ? Math.round(plan.progress) : null;

  if (compact) {
    // 연결선 스타일 결정
    const connectionClasses = isConnected
      ? isFirst
        ? "rounded-t-md rounded-b-none" // 첫 번째: 위쪽만 둥글게
        : isLast
        ? "rounded-b-md rounded-t-none" // 마지막: 아래쪽만 둥글게
        : "rounded-none" // 중간: 둥글게 없음
      : "rounded-md";
    
    const borderColorClass = isCompleted
      ? "border-green-300"
      : isActive
      ? "border-blue-300"
      : "border-gray-200";
    
    const bgColorClass = isCompleted
      ? "bg-green-50"
      : isActive
      ? "bg-blue-50"
      : "bg-white";
    
    // 연결된 경우 border 조정
    const borderClasses = isConnected
      ? isFirst
        ? "border-b-0" // 첫 번째: 아래 border 제거
        : isLast
        ? "border-t-0" // 마지막: 위 border 제거
        : "border-t-0 border-b-0" // 중간: 위아래 border 제거
      : "";
    
    return (
      <div
        className={`group border p-1.5 text-xs transition-all duration-200 hover:scale-[1.02] hover:shadow-md relative ${connectionClasses} ${borderColorClass} ${bgColorClass} ${borderClasses}`}
      >
        {/* 연결선 표시 (아래쪽에 연결선) */}
        {isConnected && !isLast && (
          <div 
            className={`absolute left-0 right-0 bottom-0 ${isCompleted ? "bg-green-300" : isActive ? "bg-blue-300" : "bg-gray-200"}`} 
            style={{ height: "3px", transform: "translateY(6px)", zIndex: 10 }} 
          />
        )}
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm shrink-0">{contentTypeIcon}</span>
          <span className="truncate font-medium text-gray-900 min-w-0 flex-1">
            {plan.contentSubjectCategory || plan.contentSubject || "-"}
          </span>
          {plan.contentEpisode && (
            <span className="shrink-0 text-xs text-gray-600">
              {plan.contentEpisode}
            </span>
          )}
          {isCompleted && (
            <span className="shrink-0 rounded-full bg-green-500 px-1.5 py-0.5 text-xs font-semibold text-white ml-1">
              ✅
            </span>
          )}
          {isActive && !isCompleted && (
            <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white ml-1">
              ⏱️
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group rounded-lg border-2 p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
        isCompleted
          ? "border-green-300 bg-green-50"
          : isActive
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 왼쪽: 콘텐츠 정보 */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="text-xl">{contentTypeIcon}</span>
            <h3 className="truncate text-lg font-semibold text-gray-900">{plan.contentTitle}</h3>
            {/* 상태 뱃지 */}
            {isCompleted && (
              <span className="shrink-0 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ✅ 완료
              </span>
            )}
            {isActive && !isCompleted && (
              <span className="shrink-0 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⏱️ 학습 중
              </span>
            )}
            {!isCompleted && !isActive && (
              <span className="shrink-0 rounded-full bg-gray-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⏸️ 대기
              </span>
            )}
          </div>

          {/* 메타 정보 */}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {plan.contentSubjectCategory && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{plan.contentSubjectCategory}</span>
            )}
            {plan.contentSubject && <span className="text-xs font-medium">{plan.contentSubject}</span>}
            {showTime && plan.start_time && plan.end_time && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Clock className="h-3 w-3" />
                {plan.start_time} ~ {plan.end_time}
              </span>
            )}
          </div>

          {/* 범위 정보 */}
          {plan.planned_start_page_or_time !== null && plan.planned_end_page_or_time !== null && (
            <div className="mt-2 text-xs text-gray-500">
              {plan.content_type === "book" ? (
                <>📖 {plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}페이지</>
              ) : (
                <>🎧 {plan.planned_start_page_or_time}강</>
              )}
              {plan.chapter && <span className="ml-1">({plan.chapter})</span>}
            </div>
          )}

          {/* 플랜 시간 정보 (타임라인 뷰용) */}
          {plan.start_time && plan.end_time && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
              <Clock className="h-3 w-3" />
              <span className="font-medium">{plan.start_time} ~ {plan.end_time}</span>
            </div>
          )}
        </div>

        {/* 오른쪽: 진행률 */}
        {showProgress && progressPercentage !== null && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`text-base font-bold ${
              isCompleted ? "text-green-600" : isActive ? "text-blue-600" : "text-gray-600"
            }`}>
              {progressPercentage}%
            </span>
            <div className="h-2.5 w-20 overflow-hidden rounded-full bg-gray-200 shadow-inner">
              <div
                className={`h-full transition-all duration-500 ${
                  isCompleted ? "bg-green-500" : isActive ? "bg-blue-500" : "bg-gray-400"
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

