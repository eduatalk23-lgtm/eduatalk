"use client";

import { cn } from "@/lib/cn";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

type RecordYearSelectorProps = {
  value: "all" | number;
  onChange: (year: "all" | number) => void;
  studentGrade?: number;
  /** compact 모드: "전체|1|2|3" (사이드바 내부용) */
  compact?: boolean;
};

export function RecordYearSelector({ value, onChange, studentGrade, compact }: RecordYearSelectorProps) {
  const currentYear = calculateSchoolYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  function gradeLabel(year: number): string {
    if (!studentGrade) return `${year}학년도`;
    const offset = currentYear - year;
    const grade = studentGrade - offset;
    if (grade < 1) return `${year}학년도`;
    return compact ? `${grade}` : `${grade}학년(${year})`;
  }

  function gradeTitle(year: number): string {
    if (!studentGrade) return `${year}학년도`;
    const offset = currentYear - year;
    const grade = studentGrade - offset;
    if (grade < 1) return `${year}학년도`;
    return `${grade}학년 (${year}학년도)`;
  }

  const activeClass = "bg-white text-[var(--text-primary)] shadow-[var(--elevation-1)] dark:bg-secondary-700";
  const inactiveClass = "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]";

  const btnClass = compact
    ? "rounded-md px-2 py-1 text-xs font-medium transition-colors"
    : "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <div className={cn(
      "flex gap-1 rounded-lg bg-secondary-100 p-1 dark:bg-secondary-900",
      compact && "gap-0.5 p-0.5",
    )}>
      <button
        onClick={() => onChange("all")}
        title="전체 학년"
        className={cn(btnClass, value === "all" ? activeClass : inactiveClass)}
      >
        전체
      </button>
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onChange(year)}
          title={gradeTitle(year)}
          className={cn(btnClass, value === year ? activeClass : inactiveClass)}
        >
          {gradeLabel(year)}
        </button>
      ))}
    </div>
  );
}
