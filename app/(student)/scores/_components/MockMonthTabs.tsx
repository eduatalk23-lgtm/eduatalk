"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const months = [
  { value: "3", label: "3월" },
  { value: "4", label: "4월" },
  { value: "5", label: "5월" },
  { value: "6", label: "6월" },
  { value: "7", label: "7월" },
  { value: "8", label: "8월" },
  { value: "9", label: "9월" },
  { value: "10", label: "10월" },
  { value: "11", label: "11월" },
];

type MockMonthTabsProps = {
  basePath: string; // 예: "/scores/mock/1"
  currentMonth: string;
  additionalParams?: string[]; // 추가 파라미터 (예: exam-type)
};

export function MockMonthTabs({ 
  basePath, 
  currentMonth,
  additionalParams = [],
}: MockMonthTabsProps) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildHref = (month: string) => {
    const params = additionalParams.length > 0 
      ? `/${additionalParams.map(p => encodeURIComponent(p)).join("/")}` 
      : "";
    return `${basePath}/${month}${params}`;
  };

  const handleTabClick = useCallback((month: string) => {
    // 이미 활성화된 탭이면 무시
    if (month === currentMonth) return;

    // 이전 timeout 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 150ms debounce (연속 클릭 방지)
    timeoutRef.current = setTimeout(() => {
      router.push(buildHref(month));
    }, 150);
  }, [basePath, currentMonth, additionalParams, router]);

  return (
    <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
      {months.map((month) => {
        const active = currentMonth === month.value;
        return (
          <button
            key={month.value}
            onClick={() => handleTabClick(month.value)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {month.label}
          </button>
        );
      })}
    </div>
  );
}

