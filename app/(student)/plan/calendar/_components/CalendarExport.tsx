"use client";

import { useState } from "react";
import { Download, Calendar, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { downloadICalFile, exportPlansForDateRange } from "../_utils/icalExport";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { PlanWithContent } from "../_types/plan";

type CalendarExportProps = {
  plans: PlanWithContent[];
  minDate?: string;
  maxDate?: string;
  className?: string;
};

type ExportOption = "all" | "week" | "month" | "custom";

/**
 * 캘린더 내보내기 컴포넌트
 *
 * 플랜을 iCal(.ics) 형식으로 내보내기합니다.
 */
export function CalendarExport({
  plans,
  minDate,
  maxDate,
  className,
}: CalendarExportProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exportOption, setExportOption] = useState<ExportOption>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const today = formatDateString(new Date());
      let startDate: string;
      let endDate: string;

      switch (exportOption) {
        case "week": {
          const weekStart = new Date();
          const day = weekStart.getDay();
          weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          startDate = formatDateString(weekStart);
          endDate = formatDateString(weekEnd);
          break;
        }
        case "month": {
          const monthStart = new Date();
          monthStart.setDate(1);
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
          startDate = formatDateString(monthStart);
          endDate = formatDateString(monthEnd);
          break;
        }
        case "custom":
          if (!customStart || !customEnd) {
            alert("시작일과 종료일을 선택해주세요.");
            setIsExporting(false);
            return;
          }
          startDate = customStart;
          endDate = customEnd;
          break;
        case "all":
        default:
          startDate = minDate || today;
          endDate = maxDate || today;
          break;
      }

      exportPlansForDateRange(plans, startDate, endDate, "TimeLevelUp 학습 플랜");
      setIsExpanded(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert("내보내기에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    { value: "all" as const, label: "전체 플랜", description: "모든 활성 플랜 내보내기" },
    { value: "week" as const, label: "이번 주", description: "이번 주 플랜만 내보내기" },
    { value: "month" as const, label: "이번 달", description: "이번 달 플랜만 내보내기" },
    { value: "custom" as const, label: "기간 선택", description: "원하는 기간 선택" },
  ];

  return (
    <div className={cn("relative", className)}>
      {/* 내보내기 버튼 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">내보내기</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
      </button>

      {/* 내보내기 패널 */}
      {isExpanded && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">캘린더 내보내기</h3>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            iCal(.ics) 형식으로 내보내기하여 다른 캘린더 앱에서 사용할 수 있습니다.
          </p>

          {/* 옵션 선택 */}
          <div className="space-y-2 mb-4">
            {exportOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setExportOption(option.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  exportOption === option.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    exportOption === option.value
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300 dark:border-gray-600"
                  )}
                >
                  {exportOption === option.value && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* 사용자 정의 기간 선택 */}
          {exportOption === "custom" && (
            <div className="space-y-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart || minDate}
                  max={maxDate}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          {/* 플랜 수 표시 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            총 {plans.length}개의 플랜을 내보냅니다
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || plans.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isExporting ? (
                "내보내는 중..."
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  내보내기
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
