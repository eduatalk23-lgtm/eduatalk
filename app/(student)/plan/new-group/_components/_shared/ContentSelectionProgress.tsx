"use client";

import React from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { ProgressIndicatorProps } from "@/lib/types/content-selection";
import { cn } from "@/lib/cn";

/**
 * ContentSelectionProgress - 콘텐츠 선택 진행률 표시
 * 
 * Content selection specific progress indicator with features:
 * - 전체 진행률 (X/9)
 * - 필수 과목 체크 (국/수/영)
 * - 경고 메시지 및 초과 경고
 * 
 * For simple progress bars, use _shared/ProgressIndicator instead.
 */
export const ContentSelectionProgress = React.memo(function ContentSelectionProgress({
  current,
  max,
  requiredSubjects = [],
  showWarning = false,
  warningMessage,
}: ProgressIndicatorProps) {
  const percentage = Math.round((current / max) * 100);
  const isComplete = current === max;
  const isOverLimit = current > max;

  // 필수 과목 체크 (캠프 모드에서만)
  const hasRequiredSubjects = requiredSubjects.length > 0;
  const allRequiredSelected =
    hasRequiredSubjects &&
    requiredSubjects.every((subj) => subj.selected);
  const someRequiredMissing =
    hasRequiredSubjects &&
    requiredSubjects.some((subj) => !subj.selected);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {/* 진행률 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          콘텐츠 선택 진행률
        </h3>
        <div className="flex items-center gap-2">
          {isOverLimit ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <div className="h-5 w-5" />
          )}
          <span
            className={cn(
              "text-2xl font-bold",
              isOverLimit
                ? "text-red-600"
                : isComplete
                ? "text-green-600"
                : "text-blue-600"
            )}
          >
            {current}
          </span>
          <span className="text-lg text-gray-400">/</span>
          <span className="text-lg font-medium text-gray-600">{max}</span>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              "h-full transition-all duration-300",
              isOverLimit
                ? "bg-red-500"
                : isComplete
                ? "bg-green-500"
                : "bg-blue-500"
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {current === 0
              ? "콘텐츠를 선택해주세요"
              : current < max
              ? `${max - current}개 더 선택 가능`
              : isOverLimit
              ? `${current - max}개 초과`
              : "선택 완료"}
          </span>
          <span className="font-medium text-gray-700">{percentage}%</span>
        </div>
      </div>

      {/* 필수 과목 체크 (캠프 모드에서만 표시) */}
      {hasRequiredSubjects && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              필수 과목
            </span>
            {allRequiredSelected && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {requiredSubjects.map((subj) => (
              <div
                key={subj.subject}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                  subj.selected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {subj.selected ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span>{subj.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 경고 메시지 */}
      {showWarning && warningMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-800">{warningMessage}</p>
        </div>
      )}

      {/* 초과 경고 */}
      {isOverLimit && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            최대 {max}개까지만 선택할 수 있습니다. {current - max}개를
            제거해주세요.
          </p>
        </div>
      )}

      {/* 필수 과목 미선택 경고 (캠프 모드에서만 표시) */}
      {hasRequiredSubjects && someRequiredMissing && current >= max && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">필수 과목을 모두 선택해주세요</p>
            <p className="mt-1">
              {requiredSubjects
                .filter((s) => !s.selected)
                .map((s) => s.subject)
                .join(", ")}
              과목이 선택되지 않았습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

