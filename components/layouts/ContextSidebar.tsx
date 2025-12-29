"use client";

import {
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
  useState,
  useCallback,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  shortcut?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  icon?: ReactNode;
  type?: "info" | "success" | "warning" | "error";
  onClick?: () => void;
}

export interface SidebarSection {
  id: string;
  title: string;
  content: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface ContextSidebarProps {
  /** 퀵 액션 목록 */
  quickActions?: QuickAction[];
  /** 최근 활동 목록 */
  activities?: ActivityItem[];
  /** 커스텀 섹션들 */
  sections?: SidebarSection[];
  /** 알림/알럿 컴포넌트 */
  alerts?: ReactNode;
  /** 헤더 제목 */
  title?: string;
  /** 접이식 모드 */
  collapsible?: boolean;
  /** 초기 접힘 상태 */
  defaultCollapsed?: boolean;
  /** 위치 */
  position?: "left" | "right";
  /** 너비 */
  width?: "sm" | "md" | "lg";
  /** 컨테이너 클래스 */
  className?: string;
  /** 고정 여부 */
  sticky?: boolean;
  /** 상단 여백 (sticky일 때) */
  stickyTop?: number;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const widthClasses = {
  sm: "w-64", // 256px
  md: "w-80", // 320px
  lg: "w-96", // 384px
};

const actionVariantClasses = {
  default: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
  primary: "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
  danger: "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30",
};

const activityTypeColors = {
  info: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 섹션 컴포넌트
 */
const Section = memo(function Section({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = useCallback(() => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev);
    }
  }, [collapsible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (collapsible && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        toggleCollapse();
      }
    },
    [collapsible, toggleCollapse]
  );

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 last:border-b-0">
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          collapsible && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        )}
        onClick={toggleCollapse}
        onKeyDown={handleKeyDown}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        {collapsible && (
          <svg
            className={cn(
              "size-4 text-gray-400 transition-transform duration-200",
              isCollapsed && "-rotate-90"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
      {!isCollapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
});

/**
 * 퀵 액션 목록
 */
const QuickActionList = memo(function QuickActionList({
  actions,
}: {
  actions: QuickAction[];
}) {
  return (
    <div className="space-y-1">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
            "text-sm font-medium",
            "transition-colors",
            actionVariantClasses[action.variant ?? "default"],
            action.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {action.icon && <span className="size-4 flex-shrink-0">{action.icon}</span>}
          <span className="flex-1 text-left">{action.label}</span>
          {action.shortcut && (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              {action.shortcut}
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
});

/**
 * 활동 타임라인
 */
const ActivityTimeline = memo(function ActivityTimeline({
  activities,
}: {
  activities: ActivityItem[];
}) {
  const formatTime = (timestamp: string | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const isClickable = !!activity.onClick;
        const Content = (
          <>
            <div
              className={cn(
                "flex items-center justify-center size-8 rounded-full flex-shrink-0",
                activityTypeColors[activity.type ?? "info"]
              )}
            >
              {activity.icon || (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {activity.title}
              </p>
              {activity.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {activity.description}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formatTime(activity.timestamp)}
              </p>
            </div>
          </>
        );

        if (isClickable) {
          return (
            <button
              key={activity.id}
              type="button"
              onClick={activity.onClick}
              className={cn(
                "flex items-start gap-3 w-full p-2 -m-2 rounded-lg",
                "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                "transition-colors text-left"
              )}
            >
              {Content}
            </button>
          );
        }

        return (
          <div key={activity.id} className="flex items-start gap-3">
            {Content}
          </div>
        );
      })}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * ContextSidebar 컴포넌트
 *
 * 현재 페이지의 컨텍스트에 맞는 퀵 액션, 최근 활동, 알림 등을 표시하는
 * 보조 사이드바입니다.
 *
 * @example
 * // 기본 사용
 * <ContextSidebar
 *   quickActions={[
 *     { id: "new", label: "새로 만들기", icon: <PlusIcon />, onClick: handleNew },
 *     { id: "export", label: "내보내기", onClick: handleExport },
 *   ]}
 *   activities={recentActivities}
 * />
 *
 * @example
 * // 커스텀 섹션과 함께
 * <ContextSidebar
 *   title="학생 관리"
 *   sections={[
 *     { id: "stats", title: "통계", content: <StatsWidget /> },
 *     { id: "filter", title: "필터", content: <FilterForm /> },
 *   ]}
 *   alerts={<ImportantAlert />}
 * />
 */
function ContextSidebarComponent({
  quickActions,
  activities,
  sections,
  alerts,
  title,
  collapsible = false,
  defaultCollapsed = false,
  position = "right",
  width = "md",
  className,
  sticky = true,
  stickyTop = 0,
  emptyMessage = "표시할 항목이 없습니다",
}: ContextSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { getDensityClasses } = useDensityOptional();

  const toggleCollapse = useCallback(() => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev);
    }
  }, [collapsible]);

  const hasContent =
    (quickActions && quickActions.length > 0) ||
    (activities && activities.length > 0) ||
    (sections && sections.length > 0) ||
    alerts;

  // 접힌 상태
  if (collapsible && isCollapsed) {
    return (
      <div
        className={cn(
          "flex-shrink-0 w-12",
          "bg-gray-50 dark:bg-gray-900/50",
          "border-gray-200 dark:border-gray-800",
          position === "left" ? "border-r" : "border-l",
          sticky && "sticky",
          className
        )}
        style={sticky ? { top: stickyTop } : undefined}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            "w-full p-3",
            "flex items-center justify-center",
            "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "transition-colors"
          )}
          aria-label="사이드바 열기"
        >
          <svg
            className={cn("size-5", position === "left" ? "" : "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex-shrink-0",
        widthClasses[width],
        "bg-white dark:bg-gray-900",
        "border-gray-200 dark:border-gray-800",
        position === "left" ? "border-r" : "border-l",
        sticky && "sticky self-start",
        className
      )}
      style={sticky ? { top: stickyTop, maxHeight: `calc(100vh - ${stickyTop}px)` } : undefined}
    >
      <div className={cn("flex flex-col h-full", sticky && "overflow-y-auto")}>
        {/* Header */}
        {(title || collapsible) && (
          <div
            className={cn(
              "flex items-center justify-between",
              "border-b border-gray-200 dark:border-gray-800",
              getDensityClasses("padding"),
              collapsible && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
            onClick={collapsible ? toggleCollapse : undefined}
            role={collapsible ? "button" : undefined}
            tabIndex={collapsible ? 0 : undefined}
          >
            {title && (
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  toggleCollapse();
                }}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="사이드바 접기"
              >
                <svg
                  className={cn("size-4", position === "left" ? "rotate-180" : "")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Alerts */}
        {alerts && <div className="p-4 border-b border-gray-200 dark:border-gray-800">{alerts}</div>}

        {/* Content */}
        <div className="flex-1">
          {!hasContent ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              {quickActions && quickActions.length > 0 && (
                <Section title="퀵 액션">
                  <QuickActionList actions={quickActions} />
                </Section>
              )}

              {/* Custom Sections */}
              {sections?.map((section) => (
                <Section
                  key={section.id}
                  title={section.title}
                  collapsible={section.collapsible}
                  defaultCollapsed={section.defaultCollapsed}
                >
                  {section.content}
                </Section>
              ))}

              {/* Recent Activity */}
              {activities && activities.length > 0 && (
                <Section title="최근 활동" collapsible defaultCollapsed={false}>
                  <ActivityTimeline activities={activities} />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export const ContextSidebar = memo(ContextSidebarComponent);

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * 관리자 컨텍스트 사이드바
 */
export function AdminContextSidebar({
  quickActions,
  alerts,
  className,
}: {
  quickActions?: QuickAction[];
  alerts?: ReactNode;
  className?: string;
}) {
  return (
    <ContextSidebar
      title="관리"
      quickActions={quickActions}
      alerts={alerts}
      width="sm"
      className={className}
    />
  );
}

/**
 * 학생 컨텍스트 사이드바
 */
export function StudentContextSidebar({
  activities,
  sections,
  className,
}: {
  activities?: ActivityItem[];
  sections?: SidebarSection[];
  className?: string;
}) {
  return (
    <ContextSidebar
      title="내 활동"
      activities={activities}
      sections={sections}
      width="sm"
      className={className}
    />
  );
}

export default ContextSidebar;
