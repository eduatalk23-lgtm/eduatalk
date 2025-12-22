"use client";

import { useState, useEffect } from "react";
import { getAttendanceRecordHistory } from "@/lib/domains/attendance";
import type { AttendanceRecordHistory } from "@/lib/types/attendance";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textSecondary,
  borderInput,
} from "@/lib/utils/darkMode";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type AttendanceHistoryListProps = {
  recordId: string;
};

export function AttendanceHistoryList({ recordId }: AttendanceHistoryListProps) {
  const [history, setHistory] = useState<AttendanceRecordHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getAttendanceRecordHistory(recordId);
        if (result.data) {
          setHistory(result.data);
        } else if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        console.error("이력 조회 실패:", err);
        setError("이력 조회 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [recordId]);

  // 변경된 필드 찾기
  function getChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ): Array<{ field: string; before: unknown; after: unknown }> {
    const changed: Array<{ field: string; before: unknown; after: unknown }> = [];
    const fieldsToCheck = [
      "check_in_time",
      "check_out_time",
      "check_in_method",
      "check_out_method",
      "status",
      "notes",
    ];

    for (const field of fieldsToCheck) {
      const beforeValue = before[field];
      const afterValue = after[field];
      if (beforeValue !== afterValue) {
        changed.push({ field, before: beforeValue, after: afterValue });
      }
    }

    return changed;
  }

  // 필드명 한글 변환
  function getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      check_in_time: "입실 시간",
      check_out_time: "퇴실 시간",
      check_in_method: "입실 방법",
      check_out_method: "퇴실 방법",
      status: "출석 상태",
      notes: "비고",
    };
    return labels[field] || field;
  }

  // 값 포맷팅
  function formatValue(field: string, value: unknown): string {
    if (value === null || value === undefined) {
      return "-";
    }

    if (field === "check_in_time" || field === "check_out_time") {
      if (typeof value === "string") {
        try {
          return format(new Date(value), "yyyy-MM-dd HH:mm", { locale: ko });
        } catch {
          return String(value);
        }
      }
    }

    if (field === "check_in_method" || field === "check_out_method") {
      const methodLabels: Record<string, string> = {
        manual: "수동",
        qr: "QR코드",
        location: "위치기반",
        auto: "자동",
      };
      return methodLabels[String(value)] || String(value);
    }

    if (field === "status") {
      const statusLabels: Record<string, string> = {
        present: "출석",
        absent: "결석",
        late: "지각",
        early_leave: "조퇴",
        excused: "공결",
      };
      return statusLabels[String(value)] || String(value);
    }

    return String(value);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="수정 이력" />
        <CardContent>
          <div className="p-4 text-center text-sm text-gray-500">
            로딩 중...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="수정 이력" />
        <CardContent>
          <div className="p-4 text-center text-sm text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader title="수정 이력" />
        <CardContent>
          <div className="p-4 text-center text-sm text-gray-500">
            수정 이력이 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={`수정 이력 (${history.length}건)`} />
      <CardContent>
        <div className="flex flex-col gap-4">
          {history.map((item) => {
            const changedFields = getChangedFields(
              item.before_data,
              item.after_data
            );
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-4",
                  borderInput,
                  bgSurface
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {format(new Date(item.modified_at), "yyyy-MM-dd HH:mm:ss", {
                        locale: ko,
                      })}
                    </div>
                    {item.reason && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        사유: {item.reason}
                      </div>
                    )}
                  </div>
                  {changedFields.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      className={cn(
                        "text-xs text-indigo-600 hover:text-indigo-700",
                        "dark:text-indigo-400 dark:hover:text-indigo-300"
                      )}
                    >
                      {isExpanded ? "접기" : "상세 보기"}
                    </button>
                  )}
                </div>

                {isExpanded && changedFields.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                    {changedFields.map((change) => (
                      <div
                        key={change.field}
                        className="flex flex-col gap-1 text-sm"
                      >
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {getFieldLabel(change.field)}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-600 dark:text-red-400">
                            이전: {formatValue(change.field, change.before)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 dark:text-green-400">
                            이후: {formatValue(change.field, change.after)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

