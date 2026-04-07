"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

interface DesiredUniversityChipsProps {
  studentId: string;
  onSelect: (name: string) => void;
  selectedName?: string;
  className?: string;
}

/**
 * 학생 프로필의 희망대학(1~3순위)을 칩 버튼으로 표시.
 * 클릭 시 대학명을 onSelect로 전달하여 폼 자동 입력.
 */
export function DesiredUniversityChips({
  studentId,
  onSelect,
  selectedName,
  className,
}: DesiredUniversityChipsProps) {
  const { data: universities } = useQuery({
    queryKey: ["studentRecord", "desiredUniversities", studentId],
    queryFn: async () => {
      const { fetchDesiredUniversitiesAction } = await import(
        "@/lib/domains/student-record/actions/strategy"
      );
      return fetchDesiredUniversitiesAction(studentId);
    },
    staleTime: 10 * 60_000,
  });

  if (!universities || universities.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[10px] text-[var(--text-tertiary)]">희망대학:</span>
      {universities.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => onSelect(u.name)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            selectedName === u.name
              ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
          )}
        >
          {u.rank}순위 {u.name}
        </button>
      ))}
    </div>
  );
}
