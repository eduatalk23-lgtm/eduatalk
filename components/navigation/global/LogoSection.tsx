"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { layoutStyles, sidebarStyles } from "./navStyles";

type LogoSectionProps = {
  dashboardHref: string;
  roleLabel: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  variant?: "desktop" | "mobile";
};

export function LogoSection({
  dashboardHref,
  roleLabel,
  isCollapsed,
  onToggleCollapse,
  variant = "desktop",
}: LogoSectionProps) {
  if (variant === "mobile") {
    return (
      <div className={layoutStyles.flexBetween}>
        <a
          href={dashboardHref}
          className={`${layoutStyles.flexCenter} text-lg font-semibold ${layoutStyles.textHeading}`}
        >
          <span>⏱️</span>
          <span>TimeLevelUp</span>
          <span className={`ml-2 text-xs ${layoutStyles.textMuted}`}>{roleLabel}</span>
        </a>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className={layoutStyles.flexColCenter}>
        <a
          href={dashboardHref}
          className={`${layoutStyles.flexCenter} justify-center w-10 h-10 text-lg rounded-md ${layoutStyles.hoverBg} ${layoutStyles.transition}`}
          aria-label="TimeLevelUp"
          title="TimeLevelUp"
        >
          <span>⏱️</span>
        </a>
        <button
          onClick={onToggleCollapse}
          className={sidebarStyles.expandButton}
          aria-label="메뉴 펼치기"
          aria-expanded={false}
          title="메뉴 펼치기"
        >
          <ChevronRight className="w-6 h-6 flex-shrink-0 text-indigo-700 dark:text-indigo-300" strokeWidth={2.5} />
          {/* 툴팁 */}
          <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden w-24 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-xs text-white dark:text-gray-900 opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 whitespace-nowrap z-50">
            메뉴 펼치기
            <div className="absolute right-full top-1/2 -translate-y-1/2">
              <div className="border-4 border-transparent border-r-gray-900 dark:border-r-gray-100"></div>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={layoutStyles.flexBetween}>
      <a
        href={dashboardHref}
        className={`${layoutStyles.flexCenter} text-lg font-semibold ${layoutStyles.textHeading}`}
      >
        <span>⏱️</span>
        <span>TimeLevelUp</span>
        <span className={`text-xs ${layoutStyles.textMuted}`}>{roleLabel}</span>
      </a>
      <button
        onClick={onToggleCollapse}
        className={sidebarStyles.collapseButton}
        aria-label="메뉴 축소"
        aria-expanded={true}
        title="메뉴 축소"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

