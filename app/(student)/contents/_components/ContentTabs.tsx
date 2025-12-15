"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { borderDefault, getIndigoTextClasses, textSecondary } from "@/lib/utils/darkMode";

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
    <div className={cn("border-b", borderDefault, className)}>
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
                  ? cn("border-indigo-600 dark:border-indigo-400", getIndigoTextClasses("link"))
                  : cn(
                      "border-transparent",
                      textSecondary,
                      "hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300"
                    )
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
