"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isBefore,
  isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Plus, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  calendarViewEventsQueryOptions,
  calendarViewKeys,
} from "@/lib/query-options/calendarViewQueryOptions";
import {
  addExclusionEventAction,
  addRecurringEventAction,
  updateCalendarEventAction,
  deleteCalendarEventAction,
  deleteEventGroupAction,
  importTimeManagementAction,
} from "@/lib/domains/admin-plan/actions/calendarEvents";

import CalendarMonthGrid from "./CalendarMonthGrid";
import CalendarDayDetail from "./CalendarDayDetail";
import AddExclusionForm from "./AddExclusionForm";
import AddRecurringEventForm from "./AddRecurringEventForm";

export interface PlannerCalendarViewProps {
  calendarId: string;
  periodStart: string;
  periodEnd: string;
  studentId?: string;
  readOnly?: boolean;
}

type AddMode = null | "exclusion" | "recurring";

export default function PlannerCalendarView({
  calendarId,
  periodStart,
  periodEnd,
  studentId,
  readOnly = false,
}: PlannerCalendarViewProps) {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // 월 네비게이션 — 빈 문자열이나 유효하지 않은 날짜는 현재 날짜로 대체
  const now = new Date();
  const rawStart = periodStart ? parseISO(periodStart) : now;
  const rawEnd = periodEnd ? parseISO(periodEnd) : now;
  const parsedStart = isNaN(rawStart.getTime()) ? now : rawStart;
  const parsedEnd = isNaN(rawEnd.getTime()) ? now : rawEnd;
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(parsedStart));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);

  // 현재 월 데이터 조회
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const { data: events = [], isLoading } = useQuery(
    calendarViewEventsQueryOptions(calendarId, year, month)
  );

  // 선택된 날짜의 이벤트
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return events.filter((e) => e.planDate === dateKey);
  }, [selectedDate, events]);

  const invalidateMonth = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: calendarViewKeys.events(calendarId),
    });
  }, [queryClient, calendarId]);

  // 월 네비게이션
  const canGoPrev = !isBefore(subMonths(endOfMonth(currentMonth), 0), startOfMonth(parsedStart));
  const canGoNext = !isAfter(startOfMonth(addMonths(currentMonth, 1)), endOfMonth(parsedEnd));

  const goToPrevMonth = () => {
    if (canGoPrev) setCurrentMonth((m) => subMonths(m, 1));
  };
  const goToNextMonth = () => {
    if (canGoNext) setCurrentMonth((m) => addMonths(m, 1));
  };

  // CRUD 핸들러
  const handleAddExclusion = useCallback(
    (date: string, exclusionType: string, reason?: string) => {
      startTransition(async () => {
        try {
          await addExclusionEventAction(calendarId, date, exclusionType, reason);
          invalidateMonth();
          showSuccess("제외일이 추가되었습니다.");
          setAddMode(null);
        } catch (err) {
          showError(err instanceof Error ? err.message : "제외일 추가 실패");
        }
      });
    },
    [calendarId, invalidateMonth, showSuccess, showError]
  );

  const handleAddRecurring = useCallback(
    (pattern: {
      type: string;
      startTime: string;
      endTime: string;
      daysOfWeek: number[];
      label?: string;
    }) => {
      startTransition(async () => {
        try {
          const result = await addRecurringEventAction(calendarId, pattern);
          invalidateMonth();
          showSuccess(`반복 일정 ${result.count}개가 추가되었습니다.`);
          setAddMode(null);
        } catch (err) {
          showError(err instanceof Error ? err.message : "반복 일정 추가 실패");
        }
      });
    },
    [calendarId, invalidateMonth, showSuccess, showError]
  );

  const handleUpdateEvent = useCallback(
    (eventId: string, updates: { startTime?: string; endTime?: string; label?: string }) => {
      startTransition(async () => {
        try {
          await updateCalendarEventAction(eventId, updates);
          invalidateMonth();
          showSuccess("이벤트가 수정되었습니다.");
        } catch (err) {
          showError(err instanceof Error ? err.message : "이벤트 수정 실패");
        }
      });
    },
    [invalidateMonth, showSuccess, showError]
  );

  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      startTransition(async () => {
        try {
          await deleteCalendarEventAction(eventId);
          invalidateMonth();
          showSuccess("이벤트가 삭제되었습니다.");
        } catch (err) {
          showError(err instanceof Error ? err.message : "이벤트 삭제 실패");
        }
      });
    },
    [invalidateMonth, showSuccess, showError]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      startTransition(async () => {
        try {
          const result = await deleteEventGroupAction(calendarId, groupId);
          invalidateMonth();
          showSuccess(`반복 일정 ${result.deletedCount}개가 삭제되었습니다.`);
        } catch (err) {
          showError(err instanceof Error ? err.message : "반복 일정 삭제 실패");
        }
      });
    },
    [calendarId, invalidateMonth, showSuccess, showError]
  );

  const handleImport = useCallback(() => {
    if (!studentId) return;
    startTransition(async () => {
      try {
        const result = await importTimeManagementAction(calendarId, studentId);
        invalidateMonth();
        showSuccess(
          `마이그레이션 완료: 제외일 ${result.exclusionCount}개, 학원 ${result.academyCount}개`
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : "마이그레이션 실패");
      }
    });
  }, [calendarId, studentId, invalidateMonth, showSuccess, showError]);

  // 통계
  const stats = useMemo(() => {
    const exclusions = events.filter((e) => e.type === "제외일").length;
    const academies = events.filter((e) => e.type === "학원").length;
    const meals = events.filter((e) =>
      ["아침식사", "점심식사", "저녁식사"].includes(e.type)
    ).length;
    return { exclusions, academies, meals, total: events.length };
  }, [events]);

  return (
    <div className="space-y-4">
      {/* 헤더: 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">플래너 캘린더</h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            disabled={!canGoPrev}
            className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[rgb(var(--color-secondary-100))] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {format(currentMonth, "yyyy년 M월")}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={!canGoNext}
            className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[rgb(var(--color-secondary-100))] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 통계 바 */}
      <div className="flex gap-3 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-[rgb(var(--color-error-500))]" />
          제외일 {stats.exclusions}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-orange-500" />
          학원 {stats.academies}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          식사 {stats.meals}
        </span>
        <span className="text-[rgb(var(--color-secondary-300))] dark:text-[rgb(var(--color-secondary-600))]">|</span>
        <span>이번 달 총 {stats.total}건</span>
      </div>

      {/* 로딩 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      ) : (
        <>
          {/* 캘린더 그리드 */}
          <CalendarMonthGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            events={events}
            periodStart={periodStart}
            periodEnd={periodEnd}
            onDateSelect={setSelectedDate}
          />

          {/* 선택된 날짜 상세 */}
          {selectedDate && (
            <CalendarDayDetail
              date={selectedDate}
              events={selectedDateEvents}
              readOnly={readOnly}
              onClose={() => setSelectedDate(null)}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onDeleteGroup={handleDeleteGroup}
            />
          )}
        </>
      )}

      {/* 액션 버튼 + 폼 */}
      {!readOnly && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddMode(addMode === "exclusion" ? null : "exclusion")}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                addMode === "exclusion"
                  ? "bg-red-500 text-white"
                  : "bg-red-50 text-red-600 dark:text-red-400 hover:bg-red-100"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              제외일 추가
            </button>
            <button
              onClick={() => setAddMode(addMode === "recurring" ? null : "recurring")}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                addMode === "recurring"
                  ? "bg-blue-500 text-white"
                  : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/30"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              반복 일정 추가
            </button>
            {studentId && (
              <button
                onClick={handleImport}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
                시간관리 데이터 가져오기
              </button>
            )}
          </div>

          {/* 폼 영역 */}
          {addMode === "exclusion" && (
            <AddExclusionForm
              periodStart={periodStart}
              periodEnd={periodEnd}
              onAdd={handleAddExclusion}
              isLoading={isPending}
            />
          )}
          {addMode === "recurring" && (
            <AddRecurringEventForm
              onAdd={handleAddRecurring}
              isLoading={isPending}
            />
          )}
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          처리 중...
        </div>
      )}
    </div>
  );
}
