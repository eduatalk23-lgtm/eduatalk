"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

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

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {scoreTypes.map((type) => {
        const active = isActive(type.href);
        return (
          <button
            key={type.value}
            onClick={() => handleTabClick(type.href)}
            className={`px-4 py-2 text-sm font-medium transition ${
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

