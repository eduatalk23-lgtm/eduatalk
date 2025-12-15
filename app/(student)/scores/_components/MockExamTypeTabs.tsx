"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";

const examTypes = [
  { value: "평가원", label: "평가원" },
  { value: "교육청", label: "교육청" },
  { value: "사설", label: "사설" },
];

type MockExamTypeTabsProps = {
  basePath: string; // 예: "/scores/mock/1/3"
  currentExamType: string;
};

export function MockExamTypeTabs({
  basePath,
  currentExamType,
}: MockExamTypeTabsProps) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildHref = (examType: string) => {
    return `${basePath}/${encodeURIComponent(examType)}`;
  };

  const handleTabClick = useCallback((examType: string) => {
    const decodedCurrent = decodeURIComponent(currentExamType);
    // 이미 활성화된 탭이면 무시
    if (examType === decodedCurrent) return;

    // 이전 timeout 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 150ms debounce (연속 클릭 방지)
    timeoutRef.current = setTimeout(() => {
      router.push(buildHref(examType));
    }, 150);
  }, [basePath, currentExamType, router]);

  // cleanup: 컴포넌트 언마운트 시 timeout 정리
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {examTypes.map((examType) => {
        const active = decodeURIComponent(currentExamType) === examType.value;
        return (
          <button
            key={examType.value}
            onClick={() => handleTabClick(examType.value)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {examType.label}
          </button>
        );
      })}
    </div>
  );
}

