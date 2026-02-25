"use client";

/**
 * ContainerSection - 공통 컨테이너 섹션 컴포넌트
 *
 * 오늘 학습과 캘린더에서 공통으로 사용하는 컨테이너 섹션입니다.
 */

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { bgSurface } from "@/lib/utils/darkMode";

export type ContainerSectionType = "daily";

export interface ContainerSectionProps {
  /** 컨테이너 타입 */
  type: ContainerSectionType;
  /** 플랜 개수 */
  count: number;
  /** 완료 개수 (daily 타입에서 진행률 표시용) */
  completedCount?: number;
  /** 접기/펼치기 기능 활성화 */
  collapsible?: boolean;
  /** 초기 펼침 상태 */
  defaultExpanded?: boolean;
  /** 컨테이너 내용 */
  children: ReactNode;
  /** 추가 클래스 */
  className?: string;
  /** 헤더 오른쪽에 추가할 액션 버튼 */
  headerAction?: ReactNode;
}

/**
 * 컨테이너 타입별 설정
 */
export const containerConfig = {
  daily: {
    title: "오늘 할 일",
    icon: "🔵",
    borderColor: "border-blue-300 dark:border-blue-700",
    headerBg: "bg-blue-50 dark:bg-blue-900/20",
    headerBorder: "border-blue-200 dark:border-blue-800",
    headerText: "text-blue-700 dark:text-blue-300",
    priority: 1,
  },
} as const;

export function ContainerSection({
  type,
  count,
  completedCount,
  collapsible = false,
  defaultExpanded = true,
  children,
  className,
  headerAction,
}: ContainerSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = containerConfig[type];

  // 빈 컨테이너는 렌더링하지 않음
  if (count === 0) {
    return null;
  }

  const countDisplay =
    type === "daily" && completedCount !== undefined
      ? `${completedCount}/${count}`
      : `${count}`;

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-sm",
        config.borderColor,
        bgSurface,
        className
      )}
    >
      {/* 헤더 */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b-2 px-5 py-3",
          config.headerBorder,
          config.headerBg,
          collapsible && "cursor-pointer"
        )}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }
              }
            : undefined
        }
        aria-expanded={collapsible ? isExpanded : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <h3 className={cn("font-bold", config.headerText)}>
            {config.title} ({countDisplay})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {headerAction}
          {collapsible && (
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform",
                config.headerText,
                !isExpanded && "-rotate-90"
              )}
            />
          )}
        </div>
      </div>

      {/* 컨텐츠 */}
      {isExpanded && (
        <div className="flex flex-col gap-2 p-4">{children}</div>
      )}
    </div>
  );
}

/**
 * 컨테이너 타입별 아이템 테두리 스타일을 반환합니다.
 */
export function getContainerItemBorderClass(_type: ContainerSectionType): string {
  return "border-blue-200 dark:border-blue-800";
}
