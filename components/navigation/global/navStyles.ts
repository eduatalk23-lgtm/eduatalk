/**
 * 네비게이션 공통 스타일 유틸리티
 * CategoryNav, Breadcrumbs에서 사용하는 반복적인 스타일 클래스를 통합 관리
 */

import { cn } from "@/lib/cn";

/**
 * z-index 계층 구조 상수
 * 명확한 레이어링을 위한 중앙 집중식 관리
 */
export const zIndexLayers = {
  // 기본 레이어
  base: 0,

  // 사이드바 레이어
  sidebar: 10,
  sidebarHeader: 20,
  sidebarFooter: 20,

  // 모바일 상단 네비게이션
  mobileNav: 40,

  // 오버레이 레이어
  overlay: 45,

  // 드로어 레이어
  drawer: 50,
  drawerHeader: 60,

  // 모달/팝오버 레이어
  modal: 50,
  popover: 50,
  tooltip: 50,

  // 최상위 레이어
  top: 100,
} as const;

/**
 * 애니메이션 duration 상수
 */
export const animationDurations = {
  fast: "duration-200",
  normal: "duration-300",
  slow: "duration-500",
} as const;

/**
 * 사이드바 너비 상수
 */
export const sidebarWidths = {
  collapsed: "w-16",
  expanded: "w-72",
} as const;

/**
 * 디자인 시스템 컬러 토큰
 */
export const designTokens = {
  colors: {
    primary: {
      50: "bg-indigo-50 dark:bg-indigo-900/30",
      100: "bg-indigo-100 dark:bg-indigo-900/50",
      500: "text-indigo-700 dark:text-indigo-300",
      700: "text-indigo-700 dark:text-indigo-300",
      800: "text-indigo-800 dark:text-indigo-200",
      border: "border-indigo-500",
      borderLight: "border-indigo-200 dark:border-indigo-800",
    },
    gray: {
      50: "bg-gray-50 dark:bg-gray-800",
      100: "bg-gray-100 dark:bg-gray-800",
      200: "text-gray-200 dark:text-gray-200",
      400: "text-gray-400 dark:text-gray-400",
      500: "text-gray-500 dark:text-gray-400",
      600: "text-gray-600 dark:text-gray-400",
      700: "text-gray-700 dark:text-gray-200",
      800: "bg-gray-800 dark:bg-gray-700",
      900: "bg-gray-900 dark:bg-gray-100",
      hoverBg: "hover:bg-gray-100 dark:hover:bg-gray-800",
      hoverText: "hover:text-gray-900 dark:hover:text-gray-100",
      hoverBgLight: "hover:bg-gray-50 dark:hover:bg-gray-800",
    },
  },
  focus: {
    ring: "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1",
  },
};

/**
 * 공통 활성 상태 스타일 (중복 제거)
 * border-l을 위한 padding-left와 border 스타일을 통합
 */
const activeBorderStyle = "pl-3 border-l-2";

/**
 * 하위 메뉴용 활성 상태 스타일
 * 하위 메뉴는 이미 들여쓰기가 있어 패딩을 조정
 */
const activeBorderStyleSubMenu = "pl-2.5 border-l-2";

/**
 * 네비게이션 아이템 기본 스타일
 */
export const navItemStyles = {
  // 기본 스타일
  base: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",

  // 포커스 스타일
  focus: designTokens.focus.ring,

  // 활성 상태 - border-l을 위한 padding-left 추가
  active: `${designTokens.colors.primary[50]} ${designTokens.colors.primary[500]} ${activeBorderStyle} ${designTokens.colors.primary.border}`,

  // 비활성 상태
  inactive: `${designTokens.colors.gray[700]} ${designTokens.colors.gray.hoverBg} ${designTokens.colors.gray.hoverText}`,

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
  base: "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
  focus: navItemStyles.focus,
  active: `${designTokens.colors.primary[50]} ${designTokens.colors.primary[500]} ${activeBorderStyleSubMenu} ${designTokens.colors.primary.border}`,
  inactive: navItemStyles.inactive,
};

/**
 * 자식 메뉴 아이템 스타일 (3단계)
 */
export const childItemStyles = {
  base: "flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition",
  focus: navItemStyles.focus,
  active: `${designTokens.colors.primary[100]} ${designTokens.colors.primary[800]} ${activeBorderStyleSubMenu} ${designTokens.colors.primary.border}`,
  inactive: `${designTokens.colors.gray[600]} ${designTokens.colors.gray.hoverBgLight} ${designTokens.colors.gray.hoverText}`,
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
 * 툴팁 스타일 (Breadcrumbs 등에서 사용)
 */
export const tooltipStyles = {
  base: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded shadow-lg whitespace-nowrap z-[50] pointer-events-none",
  arrow:
    "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100",
};

/**
 * Breadcrumbs 스타일
 */
export const breadcrumbStyles = {
  container: `flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm ${designTokens.colors.gray[600]} ${designTokens.colors.gray[50]} border-b border-gray-100 dark:border-gray-700`,
  list: "flex items-center gap-1 flex-wrap max-w-full",
  separator: designTokens.colors.gray[400],
  link: `${designTokens.colors.gray.hoverText} truncate max-w-[120px] sm:max-w-[150px] md:max-w-[200px] transition`,
  current: `font-medium ${designTokens.colors.gray[900]} truncate max-w-[120px] sm:max-w-[150px] md:max-w-[200px]`,
};

/**
 * 레이아웃 공통 스타일 (RoleBasedLayout에서 사용)
 */
export const layoutStyles = {
  // Border 스타일
  borderBottom: "border-b border-gray-200 dark:border-gray-700",
  borderTop: "border-t border-gray-200 dark:border-gray-700",
  borderRight: "border-r border-gray-200 dark:border-gray-700",

  // Flex 레이아웃
  flexCenter: "flex items-center gap-2",
  flexBetween: "flex items-center justify-between gap-2",
  flexColCenter: "flex flex-col items-center gap-3",

  // Padding
  padding4: "p-4",
  padding3: "px-4 py-3",
  padding2: "px-3 py-2",

  // Background
  bgGray50: "bg-gray-50 dark:bg-gray-800",
  bgWhite: "bg-white dark:bg-gray-800",

  // Text
  textHeading: "text-gray-900 dark:text-gray-100",
  textMuted: "text-gray-500 dark:text-gray-400",
  textSecondary: "text-gray-600 dark:text-gray-400",

  // Hover
  hoverBg: "hover:bg-gray-100 dark:hover:bg-gray-700",
  hoverText: "hover:text-gray-900 dark:hover:text-gray-100",

  // Transition
  transition: "transition-colors",
  transitionAll: `transition-all ${animationDurations.normal} ease-in-out`,

  // Focus
  focusRing: designTokens.focus.ring,

  // 스크롤 가능한 컨테이너
  scrollableContainer: "overflow-y-auto",

  // 전체 화면 높이
  fullHeight: "h-screen",
};

/**
 * 사이드바 스타일
 */
export const sidebarStyles = {
  container: `${layoutStyles.bgWhite} ${layoutStyles.borderRight} ${layoutStyles.transitionAll} z-[10]`,
  header: `${layoutStyles.borderBottom} ${layoutStyles.padding4} sticky top-0 z-[20] ${layoutStyles.bgWhite}`,
  tenantInfo: `${layoutStyles.borderBottom} ${layoutStyles.bgGray50} ${layoutStyles.padding3}`,
  navSection: "px-4 py-4",
  footer: `${layoutStyles.borderTop} ${layoutStyles.padding4} sticky bottom-0 z-[20] ${layoutStyles.bgWhite}`,
  logoLink: `${layoutStyles.flexCenter} text-lg font-semibold ${layoutStyles.textHeading}`,
  collapseButton: `p-2 rounded-md ${layoutStyles.hoverBg} ${layoutStyles.textSecondary} ${layoutStyles.hoverText} ${layoutStyles.transition} ${layoutStyles.focusRing}`,
  expandButton: `group relative w-full ${layoutStyles.flexCenter} justify-center p-3 rounded-lg ${designTokens.colors.primary[50]} hover:bg-indigo-100 dark:hover:bg-indigo-900/50 ${designTokens.colors.primary[500]} ${layoutStyles.transition} border ${designTokens.colors.primary.borderLight} ${layoutStyles.focusRing}`,
};

/**
 * 모바일 네비게이션 스타일
 */
export const mobileNavStyles = {
  overlay: "fixed inset-0 bg-black/50 z-[45] md:hidden",
  drawer: `${layoutStyles.bgWhite} ${layoutStyles.borderRight} z-[50] ${layoutStyles.transitionAll} motion-reduce:duration-0 md:hidden ${layoutStyles.scrollableContainer}`,
  header: `sticky top-0 ${layoutStyles.bgWhite} ${layoutStyles.borderBottom} ${layoutStyles.padding4} z-[60]`,
  hamburgerButton: `p-2 rounded-md ${layoutStyles.hoverBg} ${layoutStyles.textSecondary} ${layoutStyles.hoverText} ${layoutStyles.transition} md:hidden ${layoutStyles.focusRing}`,
  closeButton: `p-1.5 rounded-md ${layoutStyles.hoverBg} ${layoutStyles.textSecondary} ${layoutStyles.hoverText} ${layoutStyles.transition} ${layoutStyles.focusRing}`,
  tenantCard: `rounded-lg ${layoutStyles.bgGray50} ${layoutStyles.padding2}`,
};
