"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

const dashboardTabs = [
  { value: "integrated", label: "통합", href: "/scores/dashboard/unified" },
  { value: "school", label: "내신", href: "/scores/dashboard/school" },
  { value: "mock", label: "모의고사", href: "/scores/dashboard/mock" },
];

export function DashboardSubTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = (href: string) => {
    if (href === "/scores/dashboard") {
      return pathname === "/scores/dashboard";
    }
    return pathname.startsWith(href);
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
      {dashboardTabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <button
            key={tab.value}
            onClick={() => handleTabClick(tab.href)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

