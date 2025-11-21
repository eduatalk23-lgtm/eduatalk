"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const grades = [
  { value: "1", label: "1학년" },
  { value: "2", label: "2학년" },
  { value: "3", label: "3학년" },
];

type GradeTabsProps = {
  basePath: string; // 예: "/scores/school" 또는 "/scores/mock"
  currentGrade: string;
  additionalParams?: string[]; // 예: ["1", "국어"] (semester, subject-group 등)
};

export function GradeTabs({
  basePath,
  currentGrade,
  additionalParams = [],
}: GradeTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildHref = (grade: string) => {
    const encodedParams = additionalParams.map((p) => encodeURIComponent(p)).join("/");
    return `${basePath}/${grade}${additionalParams.length > 0 ? `/${encodedParams}` : ""}`;
  };

  const handleTabClick = useCallback((grade: string) => {
    // 이미 활성화된 탭이면 무시
    if (grade === currentGrade) return;

    // 이전 timeout 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 150ms debounce (연속 클릭 방지)
    timeoutRef.current = setTimeout(() => {
      router.push(buildHref(grade));
    }, 150);
  }, [basePath, currentGrade, additionalParams, router]);

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {grades.map((grade) => {
        const active = currentGrade === grade.value;
        return (
          <button
            key={grade.value}
            onClick={() => handleTabClick(grade.value)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {grade.label}
          </button>
        );
      })}
    </div>
  );
}

