"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  name: string;
  label: string;
  options: FilterOption[];
  type?: "select" | "toggle";
}

interface FilterBarProps {
  filters: FilterConfig[];
  basePath?: string;
  className?: string;
  onFilterChange?: (filterName: string, value: string) => void;
  children?: ReactNode;
}

export function FilterBar({
  filters,
  basePath = "",
  className,
  onFilterChange,
  children,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    return params.toString();
  };

  const handleSelectChange = (filterName: string, value: string) => {
    const queryString = createQueryString(filterName, value);
    const newPath = `${basePath}${queryString ? `?${queryString}` : ""}`;
    
    if (onFilterChange) {
      onFilterChange(filterName, value);
    }
    
    router.push(newPath, { scroll: true });
  };

  const getCurrentValue = (filterName: string) => {
    return searchParams?.get(filterName) || "";
  };

  return (
    <form className={cn(
      "flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm",
      className
    )}>
      {filters.map((filter) => {
        const currentValue = getCurrentValue(filter.name);

        if (filter.type === "toggle") {
          // Toggle buttons (e.g., sorting)
          return (
            <div key={filter.name} className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">{filter.label}</span>
              <div className="flex gap-2">
                {filter.options.map((option) => (
                  <Link
                    key={option.value}
                    href={`${basePath}?${createQueryString(filter.name, option.value)}`}
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:shadow-sm",
                      currentValue === option.value || (!currentValue && option.value === filter.options[0].value)
                        ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                    )}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        }

        // Default: select dropdown
        return (
          <label key={filter.name} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{filter.label}</span>
            <select
              name={filter.name}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
              value={currentValue}
              onChange={(e) => handleSelectChange(filter.name, e.target.value)}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {children}
    </form>
  );
}

// Preset filter configurations
export const planPurposeFilter: FilterConfig = {
  name: "planPurpose",
  label: "플랜 목적",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "내신대비", label: "내신대비" },
    { value: "모의고사", label: "모의고사" },
    { value: "수능", label: "수능" },
    { value: "기타", label: "기타" },
  ],
};

export const sortOrderFilter: FilterConfig = {
  name: "sortOrder",
  label: "생성일 정렬",
  type: "toggle",
  options: [
    { value: "desc", label: "최신순" },
    { value: "asc", label: "오래된순" },
  ],
};

export const templateStatusFilter: FilterConfig = {
  name: "status",
  label: "상태",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "draft", label: "초안" },
    { value: "active", label: "활성" },
    { value: "archived", label: "보관" },
  ],
};

export const templateProgramTypeFilter: FilterConfig = {
  name: "program_type",
  label: "프로그램 유형",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "윈터캠프", label: "윈터캠프" },
    { value: "썸머캠프", label: "썸머캠프" },
    { value: "파이널캠프", label: "파이널캠프" },
    { value: "기타", label: "기타" },
  ],
};

// 플랜 그룹 상태 필터
export const planGroupStatusFilter: FilterConfig = {
  name: "status",
  label: "상태",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "draft", label: "초안" },
    { value: "saved", label: "저장됨" },
    { value: "active", label: "활성" },
    { value: "paused", label: "일시정지" },
    { value: "completed", label: "완료" },
    { value: "cancelled", label: "취소됨" },
  ],
};

// 진행률 필터
export const progressFilter: FilterConfig = {
  name: "progress",
  label: "진행률",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "0-25", label: "0~25%" },
    { value: "25-50", label: "25~50%" },
    { value: "50-75", label: "50~75%" },
    { value: "75-100", label: "75~100%" },
    { value: "100", label: "완료 (100%)" },
  ],
};

// 날짜 범위 프리셋 필터
export const dateRangeFilter: FilterConfig = {
  name: "dateRange",
  label: "기간",
  type: "select",
  options: [
    { value: "", label: "전체" },
    { value: "today", label: "오늘" },
    { value: "week", label: "이번 주" },
    { value: "month", label: "이번 달" },
    { value: "quarter", label: "최근 3개월" },
  ],
};

