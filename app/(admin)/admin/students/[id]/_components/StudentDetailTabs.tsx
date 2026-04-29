"use client";

import { useTransition, useId, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SectionSkeleton } from "./SectionSkeleton";

type TabKey =
  | "content"
  | "session"
  | "analysis"
  | "attendance"
  | "risk"
  | "files";

type Tab = {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const tabs: Tab[] = [
  { key: "content", label: "콘텐츠", icon: BookOpen },
  { key: "session", label: "학습기록", icon: Clock },
  { key: "analysis", label: "분석 리포트", icon: TrendingUp },
  { key: "attendance", label: "출석", icon: CheckCircle2 },
  { key: "risk", label: "위험도/추천", icon: AlertTriangle },
  { key: "files", label: "파일", icon: FolderOpen },
];

export function StudentDetailTabs({
  defaultTab = "content",
  children,
}: {
  defaultTab?: TabKey;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const tablistId = useId();
  const tablistRef = useRef<HTMLDivElement>(null);

  const activeTab = (searchParams.get("tab") as TabKey) || defaultTab;

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  // 화살표 키 + Home/End — Linear/WAI-ARIA tablist 표준 패턴
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="tab"]',
      );
      if (!buttons || buttons.length === 0) return;
      const idx = Array.from(buttons).indexOf(
        document.activeElement as HTMLButtonElement,
      );

      const move = (delta: number) => {
        const next = (idx + delta + buttons.length) % buttons.length;
        buttons[next]?.focus();
        buttons[next]?.click();
      };

      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        buttons[0]?.focus();
        buttons[0]?.click();
      } else if (e.key === "End") {
        e.preventDefault();
        buttons[buttons.length - 1]?.focus();
        buttons[buttons.length - 1]?.click();
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="학생 상세 탭"
        onKeyDown={handleKeyDown}
        className="border-b border-border"
      >
        <nav className="-mb-px flex gap-8 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`${tablistId}-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`${tablistId}-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-t-sm",
                  isActive
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-text-tertiary hover:border-border hover:text-text-primary",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden={true} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 탭 컨텐츠 — 활성 탭만 렌더 */}
      <div
        role="tabpanel"
        id={`${tablistId}-panel-${activeTab}`}
        aria-labelledby={`${tablistId}-tab-${activeTab}`}
      >
        {isPending ? <SectionSkeleton rows={4} /> : children}
      </div>
    </div>
  );
}
