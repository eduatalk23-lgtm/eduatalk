"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useEffect, type KeyboardEvent } from "react";

const scoreTypes = [
  { value: "dashboard", label: "대시보드", href: "/scores/dashboard/unified" },
  { value: "school", label: "내신", href: "/scores/school/1/1" },
  { value: "mock", label: "모의고사", href: "/scores/mock/1/3/" + encodeURIComponent("평가원") },
];

export function ScoreTypeTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = (href: string) => {
    return pathname.startsWith(href.split("/").slice(0, 3).join("/"));
  };

  const handleTabClick = useCallback((href: string) => {
    // 현재 활성화된 탭이면 무시
    if (isActive(href)) return;

    // 이전 timeout 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 150ms debounce (연속 클릭 방지)
    timeoutRef.current = setTimeout(() => {
      router.push(href);
    }, 150);
  }, [pathname, router]);

  // cleanup: 컴포넌트 언마운트 시 timeout 정리
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = index > 0 ? index - 1 : scoreTypes.length - 1;
      handleTabClick(scoreTypes[prevIndex].href);
      (e.currentTarget.parentElement?.children[prevIndex] as HTMLElement)?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = index < scoreTypes.length - 1 ? index + 1 : 0;
      handleTabClick(scoreTypes[nextIndex].href);
      (e.currentTarget.parentElement?.children[nextIndex] as HTMLElement)?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      handleTabClick(scoreTypes[0].href);
      (e.currentTarget.parentElement?.children[0] as HTMLElement)?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const lastIndex = scoreTypes.length - 1;
      handleTabClick(scoreTypes[lastIndex].href);
      (e.currentTarget.parentElement?.children[lastIndex] as HTMLElement)?.focus();
    }
  };

  return (
    <div className="flex gap-2 border-b border-gray-200" role="tablist" aria-label="성적 타입 선택">
      {scoreTypes.map((type, index) => {
        const active = isActive(type.href);
        return (
          <button
            key={type.value}
            onClick={() => handleTabClick(type.href)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="tab"
            aria-selected={active}
            aria-controls={`tabpanel-${type.value}`}
            tabIndex={active ? 0 : -1}
            className={`px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}

