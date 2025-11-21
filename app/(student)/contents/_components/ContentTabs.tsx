"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type TabItem = {
  key: string;
  label: string;
};

type ContentTabsProps = {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
};

export function ContentTabs({ tabs, defaultTab, className }: ContentTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!tabs || tabs.length === 0) return null;

  const activeTab = searchParams.get("tab") || defaultTab || tabs[0]?.key;

  const handleTabChange = (tabKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="-mb-px flex gap-2" aria-label="탭">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition",
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
