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
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
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
        variant === "line" && "border-b border-gray-200",
        variant === "pill" && "gap-1 rounded-lg bg-gray-100 p-1",
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
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              ],
              variant === "pill" && [
                "rounded-md",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ],
              tab.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-medium",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-200 text-gray-600"
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

