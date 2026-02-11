"use client";

import { cn } from "@/lib/cn";
import type { StudentDivision } from "@/lib/constants/students";
import type { DivisionStatItem } from "@/lib/data/students";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";

type DivisionStatsCardsProps = {
  stats: DivisionStatItem[];
  total: number;
  onDivisionClick?: (division: StudentDivision | null) => void;
  selectedDivision?: StudentDivision | null;
};

const GRADE_PREFIX: Record<string, string> = {
  고등부: "고",
  중등부: "중",
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
    if (division === "졸업") {
      return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20";
    }
    return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20";
  };

  const getPercentage = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  // 순서: 고등부, 중등부, 졸업, 미설정
  const orderedStats = [
    stats.find((s) => s.division === "고등부") || { division: "고등부" as StudentDivision, count: 0, gradeBreakdown: {} },
    stats.find((s) => s.division === "중등부") || { division: "중등부" as StudentDivision, count: 0, gradeBreakdown: {} },
    stats.find((s) => s.division === "졸업") || { division: "졸업" as StudentDivision, count: 0, gradeBreakdown: {} },
    stats.find((s) => s.division === null) || { division: null, count: 0, gradeBreakdown: {} },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {orderedStats.map((stat) => {
        const isSelected = selectedDivision === stat.division;
        const percentage = getPercentage(stat.count);
        const prefix = stat.division ? GRADE_PREFIX[stat.division] : null;

        // 학년 1,2,3 (0명 포함)
        const gradeEntries = [1, 2, 3].map((g) => ({
          grade: g,
          count: stat.gradeBreakdown[g] ?? 0,
        }));

        const getGradePercent = (count: number): number => {
          if (stat.count === 0) return 0;
          return Math.round((count / stat.count) * 100);
        };

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
            {/* 학년 분포 */}
            {prefix && (
              <div className={cn("flex gap-3 pt-1 text-xs", textSecondary)}>
                {gradeEntries.map((e) => (
                  <span key={e.grade}>
                    {prefix}{e.grade} {e.count}명({getGradePercent(e.count)}%)
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
