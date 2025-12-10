/**
 * 충돌 경고 컴포넌트
 * 
 * 재조정 시 발생할 수 있는 충돌을 표시합니다.
 */

"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import type { Conflict } from "@/lib/reschedule/conflictDetector";

type ConflictWarningProps = {
  conflicts: Conflict[];
};

export function ConflictWarning({ conflicts }: ConflictWarningProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // 심각도별로 그룹화
  const conflictsBySeverity = useMemo(() => {
    const high: Conflict[] = [];
    const medium: Conflict[] = [];
    const low: Conflict[] = [];

    conflicts
      .filter((c) => !dismissed.has(`${c.type}-${c.date}`))
      .forEach((conflict) => {
        if (conflict.severity === "high") {
          high.push(conflict);
        } else if (conflict.severity === "medium") {
          medium.push(conflict);
        } else {
          low.push(conflict);
        }
      });

    return { high, medium, low };
  }, [conflicts, dismissed]);

  const handleDismiss = (conflict: Conflict) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(`${conflict.type}-${conflict.date}`);
    setDismissed(newDismissed);
  };

  const allConflicts = [
    ...conflictsBySeverity.high,
    ...conflictsBySeverity.medium,
    ...conflictsBySeverity.low,
  ];

  if (allConflicts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {conflictsBySeverity.high.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h4 className="font-semibold text-red-900">
                높은 심각도 충돌 ({conflictsBySeverity.high.length}개)
              </h4>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {conflictsBySeverity.high.map((conflict, index) => (
              <div
                key={`${conflict.type}-${conflict.date}-${index}`}
                className="flex items-start justify-between rounded-lg border border-red-300 bg-white p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    {conflict.message}
                  </p>
                  {conflict.details && (
                    <div className="mt-1 text-xs text-red-700">
                      {conflict.details.overlappingPlans && (
                        <p>
                          겹치는 플랜:{" "}
                          {conflict.details.overlappingPlans.length}개
                        </p>
                      )}
                      {conflict.details.totalHours && (
                        <p>
                          총 학습 시간: {conflict.details.totalHours.toFixed(1)}
                          시간
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(conflict)}
                  className="ml-2 rounded p-1 text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflictsBySeverity.medium.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h4 className="font-semibold text-yellow-900">
                중간 심각도 충돌 ({conflictsBySeverity.medium.length}개)
              </h4>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {conflictsBySeverity.medium.map((conflict, index) => (
              <div
                key={`${conflict.type}-${conflict.date}-${index}`}
                className="flex items-start justify-between rounded-lg border border-yellow-300 bg-white p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">
                    {conflict.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(conflict)}
                  className="ml-2 rounded p-1 text-yellow-600 transition hover:bg-yellow-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflictsBySeverity.low.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">
                낮은 심각도 충돌 ({conflictsBySeverity.low.length}개)
              </h4>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {conflictsBySeverity.low.map((conflict, index) => (
              <div
                key={`${conflict.type}-${conflict.date}-${index}`}
                className="flex items-start justify-between rounded-lg border border-blue-300 bg-white p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    {conflict.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(conflict)}
                  className="ml-2 rounded p-1 text-blue-600 transition hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

