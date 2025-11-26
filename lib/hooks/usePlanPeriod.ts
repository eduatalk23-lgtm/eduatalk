"use client";

/**
 * 플랜 기간 관리 훅
 *
 * UI 컴포넌트에서 플랜 기간 관련 비즈니스 로직을 분리했습니다.
 * Step1BasicInfo 등에서 사용합니다.
 */

import { useState, useCallback, useEffect } from "react";
import {
  getTodayParts,
  parseDateString,
  formatDateString,
  getDaysInMonth,
  calculateDday,
  isValidDateRange,
  getWeeksDifference,
  calculateEndDate,
} from "@/lib/utils/date";

export type PeriodInputType = "dday" | "direct" | "weeks";

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type DirectPeriodState = {
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
};

export type DdayState = {
  date: string;
  calculated: boolean;
};

export type WeeksState = {
  startDate: string;
  weeks: number;
};

export type UsePlanPeriodOptions = {
  initialPeriodStart?: string;
  initialPeriodEnd?: string;
  initialTargetDate?: string;
};

export type UsePlanPeriodReturn = {
  // 상태
  periodInputType: PeriodInputType;
  directState: DirectPeriodState;
  ddayState: DdayState;
  weeksState: WeeksState;

  // 계산된 값
  periodStart: string;
  periodEnd: string;
  dday: number | null;

  // 유효성
  isValid: boolean;
  errorMessage: string | null;

  // 액션
  setPeriodInputType: (type: PeriodInputType) => void;
  setDirectState: (state: Partial<DirectPeriodState>) => void;
  setDdayState: (state: Partial<DdayState>) => void;
  setWeeksState: (state: Partial<WeeksState>) => void;
  reset: () => void;

  // 헬퍼
  getDaysInMonth: (year: number, month: number) => number;
};

/**
 * 플랜 기간 관리 훅
 */
export function usePlanPeriod(
  options: UsePlanPeriodOptions = {}
): UsePlanPeriodReturn {
  const { initialPeriodStart, initialPeriodEnd, initialTargetDate } = options;

  // 기본 상태 초기화
  const today = getTodayParts();

  const [periodInputType, setPeriodInputType] = useState<PeriodInputType>(() => {
    if (initialTargetDate) return "dday";
    if (initialPeriodStart && initialPeriodEnd) {
      const weeks = getWeeksDifference(initialPeriodStart, initialPeriodEnd);
      const days =
        (new Date(initialPeriodEnd).getTime() -
          new Date(initialPeriodStart).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days % 7 === 0 && weeks >= 4) return "weeks";
    }
    return "direct";
  });

  const [directState, setDirectStateInternal] = useState<DirectPeriodState>(() => {
    const startParts = initialPeriodStart
      ? parseDateString(initialPeriodStart)
      : today;
    const endParts = initialPeriodEnd
      ? parseDateString(initialPeriodEnd)
      : today;

    return {
      startYear: startParts.year,
      startMonth: startParts.month,
      startDay: startParts.day,
      endYear: endParts.year,
      endMonth: endParts.month,
      endDay: endParts.day,
    };
  });

  const [ddayState, setDdayStateInternal] = useState<DdayState>({
    date: initialTargetDate || "",
    calculated: !!initialTargetDate,
  });

  const [weeksState, setWeeksStateInternal] = useState<WeeksState>(() => {
    if (initialPeriodStart && initialPeriodEnd && !initialTargetDate) {
      const weeks = getWeeksDifference(initialPeriodStart, initialPeriodEnd);
      return { startDate: initialPeriodStart, weeks: weeks >= 4 ? weeks : 4 };
    }
    return { startDate: "", weeks: 4 };
  });

  // 계산된 기간 값
  const periodStart = useCallback((): string => {
    switch (periodInputType) {
      case "direct":
        return formatDateString(
          directState.startYear,
          directState.startMonth,
          directState.startDay
        );
      case "weeks":
        return weeksState.startDate || formatDateString(today.year, today.month, today.day);
      case "dday":
        return formatDateString(today.year, today.month, today.day);
      default:
        return "";
    }
  }, [periodInputType, directState, weeksState, today]);

  const periodEnd = useCallback((): string => {
    switch (periodInputType) {
      case "direct":
        return formatDateString(
          directState.endYear,
          directState.endMonth,
          directState.endDay
        );
      case "weeks":
        return weeksState.startDate
          ? calculateEndDate(weeksState.startDate, weeksState.weeks)
          : "";
      case "dday":
        return ddayState.date || "";
      default:
        return "";
    }
  }, [periodInputType, directState, weeksState, ddayState]);

  // D-day 계산
  const dday = useCallback((): number | null => {
    const end = periodEnd();
    if (!end) return null;
    return calculateDday(end);
  }, [periodEnd]);

  // 유효성 검사
  const validation = useCallback((): {
    isValid: boolean;
    errorMessage: string | null;
  } => {
    const start = periodStart();
    const end = periodEnd();

    if (!start || !end) {
      return { isValid: false, errorMessage: "기간을 입력해주세요." };
    }

    if (!isValidDateRange(start, end)) {
      return { isValid: false, errorMessage: "시작일이 종료일보다 늦을 수 없습니다." };
    }

    return { isValid: true, errorMessage: null };
  }, [periodStart, periodEnd]);

  // 액션
  const setDirectState = useCallback(
    (state: Partial<DirectPeriodState>) => {
      setDirectStateInternal((prev) => ({ ...prev, ...state }));
    },
    []
  );

  const setDdayState = useCallback((state: Partial<DdayState>) => {
    setDdayStateInternal((prev) => ({ ...prev, ...state }));
  }, []);

  const setWeeksState = useCallback((state: Partial<WeeksState>) => {
    setWeeksStateInternal((prev) => ({ ...prev, ...state }));
  }, []);

  const reset = useCallback(() => {
    const today = getTodayParts();
    setPeriodInputType("direct");
    setDirectStateInternal({
      startYear: today.year,
      startMonth: today.month,
      startDay: today.day,
      endYear: today.year,
      endMonth: today.month,
      endDay: today.day,
    });
    setDdayStateInternal({ date: "", calculated: false });
    setWeeksStateInternal({ startDate: "", weeks: 4 });
  }, []);

  const { isValid, errorMessage } = validation();

  return {
    // 상태
    periodInputType,
    directState,
    ddayState,
    weeksState,

    // 계산된 값
    periodStart: periodStart(),
    periodEnd: periodEnd(),
    dday: dday(),

    // 유효성
    isValid,
    errorMessage,

    // 액션
    setPeriodInputType,
    setDirectState,
    setDdayState,
    setWeeksState,
    reset,

    // 헬퍼
    getDaysInMonth,
  };
}

