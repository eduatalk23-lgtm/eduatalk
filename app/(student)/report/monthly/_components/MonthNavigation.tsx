"use client";

import { useRouter, useSearchParams } from "next/navigation";

type MonthNavigationProps = {
  currentMonth: Date;
};

export function MonthNavigation({ currentMonth }: MonthNavigationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

  const prevMonth = new Date(currentMonth);
  prevMonth.setMonth(prevMonth.getMonth() - 1);

  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const isNextMonthDisabled = nextMonth > currentMonthDate;

  const formatMonth = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  };

  const navigateToMonth = (month: Date) => {
    const monthStr = formatMonth(month);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthStr);
    router.push(`/report/monthly?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={() => navigateToMonth(prevMonth)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ◀ 지난달 보기
      </button>
      <button
        onClick={() => navigateToMonth(currentMonthDate)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        이번달 보기
      </button>
      <button
        onClick={() => navigateToMonth(nextMonth)}
        disabled={isNextMonthDisabled}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        다음달 보기 ▶
      </button>
    </div>
  );
}

