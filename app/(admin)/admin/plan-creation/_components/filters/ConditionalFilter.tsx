"use client";

/**
 * 조건부 생성 필터 컴포넌트
 * 특정 조건에 맞는 학생만 선택/제외
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  Filter,
  ChevronDown,
  Check,
  X,
  Calendar,
  BookOpen,
  AlertCircle,
} from "lucide-react";

export interface FilterCondition {
  id: string;
  label: string;
  description: string;
  check: (student: StudentForFilter) => boolean;
}

// 필터링에 필요한 학생 정보
export interface StudentForFilter {
  id: string;
  name: string;
  grade?: number;
  hasPlanGroup?: boolean;
  hasRecentPlan?: boolean;
  lastPlanDate?: Date;
}

interface ConditionalFilterProps {
  conditions: FilterCondition[];
  activeConditionIds: string[];
  onConditionsChange: (ids: string[]) => void;
  className?: string;
}

// 기본 조건들
export const DEFAULT_CONDITIONS: FilterCondition[] = [
  {
    id: "no-plan-group",
    label: "플랜 그룹 없음",
    description: "아직 플랜 그룹이 없는 학생만 선택",
    check: (student) => !student.hasPlanGroup,
  },
  {
    id: "no-recent-plan",
    label: "최근 플랜 없음",
    description: "최근 7일 내 플랜이 없는 학생만 선택",
    check: (student) => {
      if (!student.lastPlanDate) return true;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return student.lastPlanDate < sevenDaysAgo;
    },
  },
  {
    id: "grade-elementary",
    label: "초등학생",
    description: "1~6학년 학생만 선택",
    check: (student) => (student.grade ?? 0) >= 1 && (student.grade ?? 0) <= 6,
  },
  {
    id: "grade-middle",
    label: "중학생",
    description: "7~9학년 학생만 선택",
    check: (student) => (student.grade ?? 0) >= 7 && (student.grade ?? 0) <= 9,
  },
  {
    id: "grade-high",
    label: "고등학생",
    description: "10~12학년 학생만 선택",
    check: (student) => (student.grade ?? 0) >= 10 && (student.grade ?? 0) <= 12,
  },
];

export function ConditionalFilter({
  conditions = DEFAULT_CONDITIONS,
  activeConditionIds,
  onConditionsChange,
  className,
}: ConditionalFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 조건 토글
  const toggleCondition = useCallback(
    (id: string) => {
      const newIds = activeConditionIds.includes(id)
        ? activeConditionIds.filter((cid) => cid !== id)
        : [...activeConditionIds, id];
      onConditionsChange(newIds);
    },
    [activeConditionIds, onConditionsChange]
  );

  // 모든 조건 제거
  const clearConditions = useCallback(() => {
    onConditionsChange([]);
  }, [onConditionsChange]);

  const activeCount = activeConditionIds.length;

  return (
    <div className={cn("relative", className)}>
      {/* 필터 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2.5",
          borderInput,
          "bg-white dark:bg-gray-800",
          textPrimary,
          "hover:bg-gray-50 dark:hover:bg-gray-700/50",
          "transition",
          activeCount > 0 && "border-purple-300 dark:border-purple-700"
        )}
      >
        <Filter
          className={cn(
            "h-4 w-4",
            activeCount > 0 ? "text-purple-600 dark:text-purple-400" : "text-gray-400"
          )}
        />
        <span className="text-sm">
          조건 필터
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* 메뉴 */}
          <div
            className={cn(
              "absolute left-0 top-full z-20 mt-1 w-72",
              "rounded-lg border shadow-lg",
              borderInput,
              "bg-white dark:bg-gray-800"
            )}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <span className={cn("text-sm font-medium", textPrimary)}>조건 필터</span>
              {activeCount > 0 && (
                <button
                  onClick={clearConditions}
                  className={cn("text-xs", textSecondary, "hover:text-red-500 transition")}
                >
                  모두 해제
                </button>
              )}
            </div>

            {/* 조건 목록 */}
            <div className="p-2 space-y-1">
              {conditions.map((condition) => {
                const isActive = activeConditionIds.includes(condition.id);

                return (
                  <button
                    key={condition.id}
                    onClick={() => toggleCondition(condition.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg p-3 text-left transition",
                      isActive
                        ? "bg-purple-50 dark:bg-purple-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    {/* 체크박스 */}
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        isActive
                          ? "border-purple-500 bg-purple-500 text-white"
                          : "border-gray-300 dark:border-gray-600"
                      )}
                    >
                      {isActive && <Check className="h-3 w-3" />}
                    </div>

                    {/* 라벨 및 설명 */}
                    <div>
                      <div className={cn("text-sm font-medium", textPrimary)}>
                        {condition.label}
                      </div>
                      <div className={cn("text-xs", textSecondary)}>{condition.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 안내 */}
            <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className={cn("flex items-start gap-2 text-xs", textSecondary)}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>선택한 조건을 모두 만족하는 학생만 생성 대상이 됩니다</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 학생 목록에 필터 적용
 */
export function applyConditions<T extends StudentForFilter>(
  students: T[],
  conditions: FilterCondition[],
  activeConditionIds: string[]
): T[] {
  if (activeConditionIds.length === 0) return students;

  const activeConditions = conditions.filter((c) => activeConditionIds.includes(c.id));

  return students.filter((student) => activeConditions.every((condition) => condition.check(student)));
}
