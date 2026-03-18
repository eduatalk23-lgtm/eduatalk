"use client";

import { cn } from "@/lib/cn";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

type RecordYearSelectorProps = {
  value: "all" | number;
  onChange: (year: "all" | number) => void;
  studentGrade?: number;
};

export function RecordYearSelector({ value, onChange, studentGrade }: RecordYearSelectorProps) {
  const currentYear = calculateSchoolYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  function gradeLabel(year: number): string {
    if (!studentGrade) return `${year}학년도`;
    const offset = currentYear - year;
    const grade = studentGrade - offset;
    if (grade < 1) return `${year}학년도`;
    return `${grade}학년(${year})`;
  }

  const activeClass = "bg-white text-[var(--text-primary)] shadow-[var(--elevation-1)] dark:bg-secondary-700";
  const inactiveClass = "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]";

  return (
    <div className="flex gap-1 rounded-lg bg-secondary-100 p-1 dark:bg-secondary-900">
      <button
        onClick={() => onChange("all")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          value === "all" ? activeClass : inactiveClass,
        )}
      >
        전체
      </button>
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onChange(year)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === year ? activeClass : inactiveClass,
          )}
        >
          {gradeLabel(year)}
        </button>
      ))}
    </div>
  );
}
