"use client";

import { memo, useState, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================
// Types
// ============================================

export type Tab = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
};

export type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "line" | "pill";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
};

// ============================================
// Tabs 컴포넌트
// ============================================

const sizeClasses = {
  sm: "px-3 py-1.5 text-body-2",
  md: "px-4 py-2 text-body-2",
  lg: "px-6 py-3 text-body-1",
};

function TabsComponent({
  tabs,
  activeTab,
  onChange,
  variant = "line",
  size = "md",
  fullWidth = false,
  className,
}: TabsProps) {
  return (
    <div
      className={cn(
        "flex",
        variant === "line" && "border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
        variant === "pill" && "gap-1 rounded-lg bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-900))] p-1",
        fullWidth && "w-full",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              "inline-flex items-center justify-center gap-2 font-medium transition-colors",
              fullWidth && "flex-1",
              sizeClasses[size],
              variant === "line" && [
                "-mb-px border-b-2",
                isActive
                  ? "border-[var(--text-primary)] dark:border-[var(--text-primary)] text-[var(--text-primary)] dark:text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))] dark:hover:border-[rgb(var(--color-secondary-600))] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)]",
              ],
              variant === "pill" && [
                "rounded-md",
                isActive
                  ? "bg-white dark:bg-[rgb(var(--color-secondary-700))] text-[var(--text-primary)] dark:text-[var(--text-primary)] shadow-[var(--elevation-1)]"
                  : "text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)]",
              ],
              tab.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-body-2 font-medium",
                  isActive
                    ? "bg-[var(--text-primary)] dark:bg-[var(--text-primary)] text-white dark:text-[var(--text-primary)]"
                    : "bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] text-[var(--text-secondary)] dark:text-[var(--text-tertiary)]"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// TabPanel 컴포넌트
// ============================================

export type TabPanelProps = {
  children: ReactNode;
  tabId: string;
  activeTab: string;
  className?: string;
};

export function TabPanel({
  children,
  tabId,
  activeTab,
  className,
}: TabPanelProps) {
  if (tabId !== activeTab) return null;

  return <div className={cn("", className)}>{children}</div>;
}

export const Tabs = memo(TabsComponent);
export default Tabs;

