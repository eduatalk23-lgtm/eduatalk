"use client";

import { useState, useCallback, useMemo } from "react";
import { useAdminPlanBasic } from "../context/AdminPlanContext";
import { usePlanGroupProgress } from "./progress/useProgressData";
import {
  generateProgressMarkdown,
  generateProgressTimetableMarkdown,
} from "./progress/progressUtils";
import { ProgressPlanGroupSelector } from "./progress/ProgressPlanGroupSelector";
import { ProgressSummaryBar } from "./progress/ProgressSummaryBar";
import { WeeklyAccordion } from "./progress/WeeklyAccordion";

interface ProgressTabProps {
  tab: "progress";
}

/**
 * 진도관리 탭
 *
 * 선택한 플랜 그룹의 전체 플랜을 주차별/날짜별로 조회하고
 * 완료 상태를 토글할 수 있는 뷰를 제공한다.
 *
 * 주차 그룹핑은 student_plan의 week 필드를 기반으로 하며,
 * 이는 WeeklyCalendar의 week_number와 동일한 값이다.
 */
export function ProgressTab({ tab: _tab }: ProgressTabProps) {
  const { studentId, allPlanGroups, toast } = useAdminPlanBasic();

  // 첫 번째 active 그룹으로 초기화
  const activeGroups = useMemo(
    () => allPlanGroups.filter((g) => g.status === "active"),
    [allPlanGroups]
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => activeGroups[0]?.id ?? null
  );

  const selectedGroup = useMemo(
    () => allPlanGroups.find((g) => g.id === selectedGroupId) ?? null,
    [allPlanGroups, selectedGroupId]
  );

  const periodStart = selectedGroup?.periodStart ?? "";
  const periodEnd = selectedGroup?.periodEnd ?? "";

  const { weeks, summary, isLoading, updatePlanStatusInCache, markDockStale } =
    usePlanGroupProgress(studentId, selectedGroupId);

  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const handleStatusChange = useCallback(
    (planId: string, newStatus: string) => {
      updatePlanStatusInCache(planId, newStatus);
      markDockStale();
    },
    [updatePlanStatusInCache, markDockStale]
  );

  const handleExportMarkdown = useCallback(
    (format: "checklist" | "timetable") => {
      if (!selectedGroup) return;

      const groupName = selectedGroup.name ?? "플랜 그룹";
      const period = { start: periodStart, end: periodEnd };

      const md =
        format === "timetable"
          ? generateProgressTimetableMarkdown(weeks, groupName, period)
          : generateProgressMarkdown(weeks, groupName, period);

      navigator.clipboard.writeText(md).then(
        () => toast.showSuccess("마크다운이 복사되었습니다"),
        () => toast.showError("복사에 실패했습니다")
      );
    },
    [weeks, selectedGroup, periodStart, periodEnd, toast]
  );

  // 플랜 그룹이 없을 때
  if (allPlanGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-secondary-400">
        <p className="text-sm">플랜 그룹이 없습니다.</p>
        <p className="text-xs">플래너 탭에서 플랜 그룹을 생성해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 플랜 그룹 선택 + 내보내기 */}
      <div className="flex items-center justify-between gap-4">
        <ProgressPlanGroupSelector
          planGroups={activeGroups}
          selectedId={selectedGroupId}
          onChange={setSelectedGroupId}
        />
        {selectedGroupId && weeks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExportMarkdown("checklist")}
              className="rounded-md border border-secondary-300 px-3 py-1.5 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-50"
            >
              체크리스트 복사
            </button>
            <button
              type="button"
              onClick={() => handleExportMarkdown("timetable")}
              className="rounded-md border border-secondary-300 px-3 py-1.5 text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-50"
            >
              시간표 복사
            </button>
          </div>
        )}
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* 선택된 그룹이 없을 때 */}
      {!selectedGroupId && !isLoading && (
        <p className="py-8 text-center text-sm text-secondary-400">
          플랜 그룹을 선택해주세요.
        </p>
      )}

      {/* 데이터 표시 */}
      {selectedGroupId && !isLoading && (
        <>
          <ProgressSummaryBar summary={summary} />
          <WeeklyAccordion
            key={selectedGroupId}
            weeks={weeks}
            currentDate={today}
            onStatusChange={handleStatusChange}
          />
        </>
      )}
    </div>
  );
}
