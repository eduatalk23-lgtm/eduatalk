"use client";

import { type ReactNode, memo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbItem {
  /** 표시 라벨 */
  label: string;
  /** 링크 경로 (없으면 현재 페이지) */
  href?: string;
  /** 아이콘 */
  icon?: ReactNode;
  /** 드롭다운 메뉴 (형제 페이지 등) */
  menu?: BreadcrumbMenuItem[];
}

export interface BreadcrumbMenuItem {
  label: string;
  href: string;
  icon?: ReactNode;
  description?: string;
}

export interface BreadcrumbProps {
  /** 브레드크럼 아이템 목록 */
  items: BreadcrumbItem[];
  /** 홈 아이콘 표시 */
  showHomeIcon?: boolean;
  /** 홈 경로 */
  homePath?: string;
  /** 구분자 스타일 */
  separator?: "chevron" | "slash" | "arrow";
  /** 최대 표시 개수 (넘으면 축소) */
  maxItems?: number;
  /** 컨테이너 클래스 */
  className?: string;
  /** 크기 */
  size?: "sm" | "md" | "lg";
}

// ============================================================================
// Constants
// ============================================================================

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const separators = {
  chevron: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  slash: <span className="mx-1">/</span>,
  arrow: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
};

const HomeIcon = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 브레드크럼 아이템
 */
const BreadcrumbItemComponent = memo(function BreadcrumbItemComponent({
  item,
  isLast,
  size,
}: {
  item: BreadcrumbItem;
  isLast: boolean;
  size: BreadcrumbProps["size"];
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const hasMenu = item.menu && item.menu.length > 0;

  const content = (
    <span className="flex items-center gap-1.5">
      {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
      <span className="truncate max-w-[200px]">{item.label}</span>
      {hasMenu && (
        <svg
          className={cn("size-3 transition-transform", isMenuOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </span>
  );

  // 현재 페이지 (마지막 아이템)
  if (isLast && !hasMenu) {
    return (
      <span
        className={cn(
          "font-medium text-gray-900 dark:text-gray-100",
          sizeClasses[size ?? "md"]
        )}
        aria-current="page"
      >
        {content}
      </span>
    );
  }

  // 메뉴가 있는 아이템
  if (hasMenu) {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "flex items-center gap-1",
            "text-gray-500 dark:text-gray-400",
            "hover:text-gray-700 dark:hover:text-gray-300",
            "transition-colors",
            sizeClasses[size ?? "md"],
            isLast && "font-medium text-gray-900 dark:text-gray-100"
          )}
        >
          {content}
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className={cn(
              "absolute top-full left-0 mt-1 z-50",
              "min-w-[200px] py-1",
              "bg-white dark:bg-gray-900",
              "rounded-lg shadow-lg",
              "border border-gray-200 dark:border-gray-700"
            )}
          >
            {item.menu!.map((menuItem) => (
              <Link
                key={menuItem.href}
                href={menuItem.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2",
                  "text-gray-700 dark:text-gray-300",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "transition-colors"
                )}
              >
                {menuItem.icon && (
                  <span className="text-gray-400 dark:text-gray-500">{menuItem.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{menuItem.label}</div>
                  {menuItem.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {menuItem.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 링크 아이템
  return (
    <Link
      href={item.href!}
      className={cn(
        "text-gray-500 dark:text-gray-400",
        "hover:text-gray-700 dark:hover:text-gray-300",
        "transition-colors",
        sizeClasses[size ?? "md"]
      )}
    >
      {content}
    </Link>
  );
});

/**
 * 축소된 아이템 (...)
 */
const CollapsedItems = memo(function CollapsedItems({
  items,
  size,
}: {
  items: BreadcrumbItem[];
  size: BreadcrumbProps["size"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "px-2 py-1 rounded",
          "text-gray-500 dark:text-gray-400",
          "hover:text-gray-700 dark:hover:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "transition-colors",
          sizeClasses[size ?? "md"]
        )}
        aria-label="숨겨진 경로 보기"
      >
        ...
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute top-full left-0 mt-1 z-50",
            "min-w-[200px] py-1",
            "bg-white dark:bg-gray-900",
            "rounded-lg shadow-lg",
            "border border-gray-200 dark:border-gray-700"
          )}
        >
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.href ?? "#"}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-2",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-100 dark:hover:bg-gray-800",
                "transition-colors text-sm"
              )}
            >
              {item.icon && (
                <span className="text-gray-400 dark:text-gray-500">{item.icon}</span>
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * Breadcrumb 컴포넌트
 *
 * 표준화된 빵가루 네비게이션을 제공합니다.
 *
 * @example
 * // 기본 사용
 * <Breadcrumb
 *   items={[
 *     { label: "학생 관리", href: "/admin/students" },
 *     { label: "김민수", href: "/admin/students/123" },
 *     { label: "플랜" }
 *   ]}
 * />
 *
 * @example
 * // 드롭다운 메뉴와 함께
 * <Breadcrumb
 *   items={[
 *     { label: "설정", href: "/settings" },
 *     {
 *       label: "알림",
 *       menu: [
 *         { label: "이메일 알림", href: "/settings/email" },
 *         { label: "푸시 알림", href: "/settings/push" },
 *         { label: "SMS 알림", href: "/settings/sms" },
 *       ]
 *     }
 *   ]}
 * />
 */
function BreadcrumbComponent({
  items,
  showHomeIcon = true,
  homePath = "/",
  separator = "chevron",
  maxItems = 4,
  className,
  size = "md",
}: BreadcrumbProps) {
  // 아이템 축소 로직
  const shouldCollapse = items.length > maxItems;
  const firstItem = items[0];
  const lastItems = shouldCollapse ? items.slice(-2) : items.slice(1);
  const collapsedItems = shouldCollapse ? items.slice(1, -2) : [];

  const separatorElement = (
    <span className="flex-shrink-0 text-gray-300 dark:text-gray-600 mx-1">
      {separators[separator]}
    </span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center flex-wrap", sizeClasses[size], className)}
    >
      <ol className="flex items-center flex-wrap">
        {/* Home */}
        {showHomeIcon && (
          <>
            <li className="flex items-center">
              <Link
                href={homePath}
                className={cn(
                  "text-gray-400 dark:text-gray-500",
                  "hover:text-gray-600 dark:hover:text-gray-400",
                  "transition-colors"
                )}
                aria-label="홈"
              >
                {HomeIcon}
              </Link>
            </li>
            {items.length > 0 && <li className="flex items-center">{separatorElement}</li>}
          </>
        )}

        {/* First Item (always visible) */}
        {items.length > 0 && (
          <>
            <li className="flex items-center">
              <BreadcrumbItemComponent
                item={firstItem}
                isLast={items.length === 1}
                size={size}
              />
            </li>
            {(shouldCollapse || items.length > 1) && (
              <li className="flex items-center">{separatorElement}</li>
            )}
          </>
        )}

        {/* Collapsed Items */}
        {shouldCollapse && collapsedItems.length > 0 && (
          <>
            <li className="flex items-center">
              <CollapsedItems items={collapsedItems} size={size} />
            </li>
            <li className="flex items-center">{separatorElement}</li>
          </>
        )}

        {/* Last Items */}
        {lastItems.map((item, index) => (
          <li key={index} className="flex items-center">
            <BreadcrumbItemComponent
              item={item}
              isLast={index === lastItems.length - 1}
              size={size}
            />
            {index < lastItems.length - 1 && separatorElement}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const Breadcrumb = memo(BreadcrumbComponent);

// ============================================================================
// Auto Breadcrumb Hook
// ============================================================================

/**
 * 경로 기반 자동 브레드크럼 생성 훅
 *
 * @example
 * const items = useAutoBreadcrumb({
 *   pathLabels: {
 *     admin: "관리자",
 *     students: "학생 관리",
 *     settings: "설정",
 *   }
 * });
 *
 * <Breadcrumb items={items} />
 */
export function useAutoBreadcrumb(options?: {
  pathLabels?: Record<string, string>;
  excludePaths?: string[];
}): BreadcrumbItem[] {
  const pathname = usePathname();
  const { pathLabels = {}, excludePaths = [] } = options ?? {};

  const segments = pathname
    .split("/")
    .filter((s) => s && !excludePaths.includes(s));

  const items: BreadcrumbItem[] = [];
  let currentPath = "";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // 동적 세그먼트 (숫자나 UUID)는 건너뛰거나 라벨 사용
    const isDynamic = /^[0-9a-f-]+$/i.test(segment);
    const label = pathLabels[segment] ?? (isDynamic ? segment : formatPathLabel(segment));

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return items;
}

/**
 * 경로 세그먼트를 사람이 읽을 수 있는 라벨로 변환
 */
function formatPathLabel(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * 관리자 브레드크럼 프리셋
 */
export function AdminBreadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <Breadcrumb
      items={items}
      showHomeIcon
      homePath="/admin/dashboard"
      separator="chevron"
      className={className}
    />
  );
}

/**
 * 학생 브레드크럼 프리셋
 */
export function StudentBreadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <Breadcrumb
      items={items}
      showHomeIcon
      homePath="/dashboard"
      separator="chevron"
      className={className}
    />
  );
}

export default Breadcrumb;
