/**
 * 날짜 범위 선택 컴포넌트
 * 
 * 재조정할 날짜 범위를 선택합니다.
 * 완료된 플랜이 있는 날짜는 자동으로 제외됩니다.
 */

"use client";

import { useState, useMemo } from "react";
import { format, parseISO, isAfter, isBefore, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isCompletedPlan } from "@/lib/utils/planStatusUtils";

type DateRange = {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
};

type DateRangeSelectorProps = {
  groupPeriodStart: string; // YYYY-MM-DD
  groupPeriodEnd: string; // YYYY-MM-DD
  existingPlans: Array<{
    id: string;
    plan_date: string; // YYYY-MM-DD
    status: string | null;
    is_active: boolean | null;
  }>;
  onRangeChange: (range: DateRange) => void;
  initialRange?: DateRange;
};

export function DateRangeSelector({
  groupPeriodStart,
  groupPeriodEnd,
  existingPlans,
  onRangeChange,
  initialRange,
}: DateRangeSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const start = parseISO(groupPeriodStart);
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(
    initialRange || { from: null, to: null }
  );
  const [selectingStart, setSelectingStart] = useState(true);

  // 완료된 플랜이 있는 날짜 목록
  const completedPlanDates = useMemo(() => {
    const dates = new Set<string>();
    existingPlans.forEach((plan) => {
      if (isCompletedPlan({ status: plan.status as any })) {
        dates.add(plan.plan_date);
      }
    });
    return dates;
  }, [existingPlans]);

  // 플랜 그룹 기간 내의 모든 날짜
  const periodDates = useMemo(() => {
    const start = parseISO(groupPeriodStart);
    const end = parseISO(groupPeriodEnd);
    return eachDayOfInterval({ start, end });
  }, [groupPeriodStart, groupPeriodEnd]);

  // 날짜가 선택 가능한지 확인
  const isDateSelectable = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    // 완료된 플랜이 있는 날짜는 선택 불가
    if (completedPlanDates.has(dateStr)) {
      return false;
    }
    // 플랜 그룹 기간 내의 날짜만 선택 가능
    const dateInPeriod = periodDates.some((d) => isSameDay(d, date));
    return dateInPeriod;
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    if (!isDateSelectable(date)) {
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");

    if (selectingStart || !selectedRange.from) {
      // 시작 날짜 선택
      setSelectedRange({ from: dateStr, to: null });
      setSelectingStart(false);
      onRangeChange({ from: dateStr, to: null });
    } else {
      // 종료 날짜 선택
      const fromDate = parseISO(selectedRange.from!);
      
      if (isBefore(date, fromDate)) {
        // 종료 날짜가 시작 날짜보다 이전이면 시작 날짜로 변경
        setSelectedRange({ from: dateStr, to: null });
        setSelectingStart(false);
        onRangeChange({ from: dateStr, to: null });
      } else {
        // 정상적인 범위 선택
        const toDateStr = format(date, "yyyy-MM-dd");
        setSelectedRange({ from: selectedRange.from, to: toDateStr });
        setSelectingStart(true);
        onRangeChange({ from: selectedRange.from, to: toDateStr });
      }
    }
  };

  // 날짜가 선택된 범위에 포함되는지 확인
  const isDateInRange = (date: Date): boolean => {
    if (!selectedRange.from) return false;
    const dateStr = format(date, "yyyy-MM-dd");
    const fromDate = parseISO(selectedRange.from);
    
    if (!selectedRange.to) {
      return isSameDay(date, fromDate);
    }
    
    const toDate = parseISO(selectedRange.to);
    return (
      (isAfter(date, fromDate) || isSameDay(date, fromDate)) &&
      (isBefore(date, toDate) || isSameDay(date, toDate))
    );
  };

  // 날짜가 범위의 시작/종료인지 확인
  const isRangeStart = (date: Date): boolean => {
    if (!selectedRange.from) return false;
    return isSameDay(date, parseISO(selectedRange.from));
  };

  const isRangeEnd = (date: Date): boolean => {
    if (!selectedRange.to) return false;
    return isSameDay(date, parseISO(selectedRange.to));
  };

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const periodStart = parseISO(groupPeriodStart);
      if (isBefore(newMonth, startOfMonth(periodStart))) {
        return startOfMonth(periodStart);
      }
      return newMonth;
    });
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      const periodEnd = parseISO(groupPeriodEnd);
      if (isAfter(newMonth, endOfMonth(periodEnd))) {
        return endOfMonth(periodEnd);
      }
      return newMonth;
    });
  };

  // 캘린더 렌더링
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const days: (Date | null)[] = [];

    // 첫 주의 빈 셀
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return (
      <div className="w-full">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekdays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-10" />;
            }

            const dateStr = format(date, "yyyy-MM-dd");
            const isSelectable = isDateSelectable(date);
            const inRange = isDateInRange(date);
            const isStart = isRangeStart(date);
            const isEnd = isRangeEnd(date);
            const isCompleted = completedPlanDates.has(dateStr);
            const isToday = isSameDay(date, new Date());
            const isOutsidePeriod = !periodDates.some((d) => isSameDay(d, date));

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(date)}
                disabled={!isSelectable}
                className={`
                  h-10 rounded-lg text-sm font-medium transition
                  ${!isSelectable || isOutsidePeriod
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : isCompleted
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : inRange
                    ? isStart || isEnd
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : isToday
                    ? "bg-gray-200 text-gray-900 hover:bg-gray-300"
                    : "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200"
                  }
                `}
                title={
                  isCompleted
                    ? "완료된 플랜이 있어 선택할 수 없습니다"
                    : isOutsidePeriod
                    ? "플랜 그룹 기간 밖입니다"
                    : undefined
                }
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 선택된 범위 표시 */}
      {selectedRange.from && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">선택된 날짜 범위</p>
              <p className="text-sm text-blue-700">
                {selectedRange.from}
                {selectedRange.to ? ` ~ ${selectedRange.to}` : " (종료 날짜 선택 중...)"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRange({ from: null, to: null });
                setSelectingStart(true);
                onRangeChange({ from: null, to: null });
              }}
              className="rounded-lg px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
            >
              초기화
            </button>
          </div>
        </div>
      )}

      {/* 캘린더 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="rounded-lg p-2 hover:bg-gray-100 transition"
            disabled={
              isSameDay(
                startOfMonth(currentMonth),
                startOfMonth(parseISO(groupPeriodStart))
              )
            }
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, "yyyy년 M월")}
          </h3>
          <button
            type="button"
            onClick={goToNextMonth}
            className="rounded-lg p-2 hover:bg-gray-100 transition"
            disabled={
              isSameDay(
                endOfMonth(currentMonth),
                endOfMonth(parseISO(groupPeriodEnd))
              )
            }
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {renderCalendar()}
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          💡 시작 날짜를 클릭한 후 종료 날짜를 클릭하면 날짜 범위가 선택됩니다.
          <br />
          완료된 플랜이 있는 날짜는 회색으로 표시되며 선택할 수 없습니다.
        </p>
      </div>
    </div>
  );
}

