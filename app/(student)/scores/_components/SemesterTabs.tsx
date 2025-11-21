"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const semesters = [
  { value: "1", label: "1학기" },
  { value: "2", label: "2학기" },
];

type SemesterTabsProps = {
  basePath: string; // 예: "/scores/school/1"
  currentSemester: string;
  subjectGroup?: string; // 선택적 (구버전 호환성)
};

export function SemesterTabs({
  basePath,
  currentSemester,
  subjectGroup,
}: SemesterTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildHref = (semester: string) => {
    if (subjectGroup) {
      // 구버전 경로 지원
      return `${basePath}/${semester}/${encodeURIComponent(subjectGroup)}`;
    }
    // 신버전 경로
    return `${basePath}/${semester}`;
  };

  const handleTabClick = useCallback((semester: string) => {
    // 이미 활성화된 탭이면 무시
    if (semester === currentSemester) return;

    // 이전 timeout 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 150ms debounce (연속 클릭 방지)
    timeoutRef.current = setTimeout(() => {
      router.push(buildHref(semester));
    }, 150);
  }, [basePath, currentSemester, subjectGroup, router]);

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {semesters.map((semester) => {
        const active = currentSemester === semester.value;
        return (
          <button
            key={semester.value}
            onClick={() => handleTabClick(semester.value)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {semester.label}
          </button>
        );
      })}
    </div>
  );
}

