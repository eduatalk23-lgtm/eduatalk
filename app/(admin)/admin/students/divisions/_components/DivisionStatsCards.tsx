"use client";

import { cn } from "@/lib/cn";
import type { StudentDivision } from "@/lib/constants/students";
import { bgSurface, borderDefault, textPrimary, textSecondary } from "@/lib/utils/darkMode";

type DivisionStats = {
  division: StudentDivision | null;
  count: number;
};

type DivisionStatsCardsProps = {
  stats: DivisionStats[];
  total: number;
  onDivisionClick?: (division: StudentDivision | null) => void;
  selectedDivision?: StudentDivision | null;
};

export function DivisionStatsCards({
  stats,
  total,
  onDivisionClick,
  selectedDivision,
}: DivisionStatsCardsProps) {
  const getDivisionLabel = (division: StudentDivision | null): string => {
    if (division === null) return "미설정";
    return division;
  };

  const getDivisionColor = (division: StudentDivision | null): string => {
    if (division === "고등부") {
      return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20";
    }
    if (division === "중등부") {
      return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20";
    }
    if (division === "기타") {
      return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20";
    }
    return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20";
  };

  const getPercentage = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  // 구분 순서: 고등부, 중등부, 기타, 미설정
  const orderedStats = [
    stats.find((s) => s.division === "고등부") || { division: "고등부" as StudentDivision, count: 0 },
    stats.find((s) => s.division === "중등부") || { division: "중등부" as StudentDivision, count: 0 },
    stats.find((s) => s.division === "기타") || { division: "기타" as StudentDivision, count: 0 },
    stats.find((s) => s.division === null) || { division: null, count: 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {orderedStats.map((stat) => {
        const isSelected = selectedDivision === stat.division;
        const percentage = getPercentage(stat.count);

        return (
          <button
            key={stat.division ?? "null"}
            type="button"
            onClick={() => onDivisionClick?.(stat.division)}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-6 text-left transition hover:shadow-md",
              getDivisionColor(stat.division),
              isSelected && "ring-2 ring-indigo-500 ring-offset-2",
              onDivisionClick && "cursor-pointer"
            )}
          >
            <div className={cn("text-body-2", textSecondary)}>
              {getDivisionLabel(stat.division)}
            </div>
            <div className={cn("text-h2", textPrimary)}>{stat.count}</div>
            {total > 0 && (
              <div className={cn("text-xs font-medium", textSecondary)}>
                전체의 {percentage}%
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

