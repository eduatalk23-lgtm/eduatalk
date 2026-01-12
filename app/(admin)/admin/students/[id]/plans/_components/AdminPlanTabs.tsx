"use client";

import React from "react";
import { cn } from "@/lib/cn";
import {
  usePlanTabState,
  PLAN_TABS,
  type PlanTabKey,
} from "./hooks/usePlanTabState";

interface AdminPlanTabsProps {
  children: React.ReactNode;
}

/**
 * 플랜 관리 탭 네비게이션 컴포넌트
 *
 * URL 기반으로 탭 상태를 관리하며, children에서 tab prop이 일치하는 요소만 렌더링합니다.
 *
 * 사용 예시:
 * ```tsx
 * <AdminPlanTabs>
 *   <PlannerTab tab="planner" />
 *   <CalendarTab tab="calendar" />
 *   <AnalyticsTab tab="analytics" />
 *   <HistoryTab tab="history" />
 * </AdminPlanTabs>
 * ```
 */
export function AdminPlanTabs({ children }: AdminPlanTabsProps) {
  const { activeTab, handleTabChange } = usePlanTabState();

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-secondary-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {PLAN_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              <span className="pr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            typeof child.props === "object" &&
            child.props !== null &&
            "tab" in child.props &&
            (child.props as { tab?: PlanTabKey }).tab === activeTab
          ) {
            return child;
          }
          return null;
        })}
      </div>
    </div>
  );
}

/**
 * 탭 컨텐츠 래퍼 컴포넌트
 *
 * 각 탭 컴포넌트가 tab prop을 가지도록 하는 래퍼입니다.
 * 실제 렌더링 여부는 AdminPlanTabs에서 결정합니다.
 */
interface TabContentProps {
  tab: PlanTabKey;
  children: React.ReactNode;
}

export function TabContent({ children }: TabContentProps) {
  return <>{children}</>;
}
