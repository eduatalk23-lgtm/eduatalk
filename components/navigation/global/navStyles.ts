/**
 * 네비게이션 공통 스타일 유틸리티
 * CategoryNav, Breadcrumbs에서 사용하는 반복적인 스타일 클래스를 통합 관리
 */

import { cn } from "@/lib/cn";

/**
 * 네비게이션 아이템 기본 스타일
 */
export const navItemStyles = {
  // 기본 스타일
  base: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
  
  // 포커스 스타일
  focus: "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1",
  
  // 활성 상태
  active: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-500",
  
  // 비활성 상태
  inactive: "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
  
  // 축소 모드
  collapsed: "justify-center px-2",
  
  // 텍스트 숨김 (축소 모드)
  textHidden: "opacity-0 w-0 overflow-hidden",
};

/**
 * 카테고리 헤더 스타일
 */
export const categoryHeaderStyles = {
  base: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
  focus: navItemStyles.focus,
  active: navItemStyles.active,
  inactive: navItemStyles.inactive,
  collapsed: navItemStyles.collapsed,
};

/**
 * 하위 메뉴 아이템 스타일
 */
export const subItemStyles = {
  base: "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
  focus: navItemStyles.focus,
  active: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-500",
  inactive: navItemStyles.inactive,
};

/**
 * 자식 메뉴 아이템 스타일 (3단계)
 */
export const childItemStyles = {
  base: "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
  focus: navItemStyles.focus,
  active: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-l-2 border-indigo-500",
  inactive: "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
};

/**
 * 네비게이션 아이템 클래스명 생성
 */
export function getNavItemClasses({
  isActive,
  isCollapsed = false,
  className,
}: {
  isActive: boolean;
  isCollapsed?: boolean;
  className?: string;
}) {
  return cn(
    navItemStyles.base,
    navItemStyles.focus,
    isCollapsed && navItemStyles.collapsed,
    isActive ? navItemStyles.active : navItemStyles.inactive,
    className
  );
}

/**
 * 카테고리 헤더 클래스명 생성
 */
export function getCategoryHeaderClasses({
  isActive,
  isCollapsed = false,
  className,
}: {
  isActive: boolean;
  isCollapsed?: boolean;
  className?: string;
}) {
  return cn(
    categoryHeaderStyles.base,
    categoryHeaderStyles.focus,
    isCollapsed && categoryHeaderStyles.collapsed,
    isActive ? categoryHeaderStyles.active : categoryHeaderStyles.inactive,
    className
  );
}

/**
 * 하위 메뉴 아이템 클래스명 생성
 */
export function getSubItemClasses({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  return cn(
    subItemStyles.base,
    subItemStyles.focus,
    isActive ? subItemStyles.active : subItemStyles.inactive,
    className
  );
}

/**
 * 자식 메뉴 아이템 클래스명 생성
 */
export function getChildItemClasses({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  return cn(
    childItemStyles.base,
    childItemStyles.focus,
    isActive ? childItemStyles.active : childItemStyles.inactive,
    className
  );
}

/**
 * Breadcrumbs 스타일
 */
export const breadcrumbStyles = {
  container: "flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700",
  list: "flex items-center gap-1 flex-wrap max-w-full",
  separator: "text-gray-400 dark:text-gray-500",
  link: "hover:text-gray-900 dark:hover:text-gray-100 truncate max-w-[150px] sm:max-w-[200px] transition",
  current: "font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px] sm:max-w-[200px]",
};

