/**
 * 네비게이션 공통 스타일 유틸리티
 * CategoryNav, TopBar, WaffleMenu에서 사용하는 반복적인 스타일 클래스를 통합 관리
 */

import { cn } from "@/lib/cn";

/**
 * z-index 계층 구조 상수
 * 명확한 레이어링을 위한 중앙 집중식 관리
 */
export const zIndexLayers = {
  // 기본 레이어
  base: 0,

  // 사이드바 헤더/푸터
  sidebarHeader: 20,
  sidebarFooter: 20,

  // TopBar
  topBar: 40,

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
  fast: "duration-100",
  normal: "duration-150",
  slow: "duration-200",
} as const;

/**
 * 사이드바 너비 상수
 */
export const sidebarWidths = {
  collapsed: "w-16",
  expanded: "w-80",
} as const;

/**
 * 디자인 시스템 컬러 토큰
 */
export const designTokens = {
  colors: {
    primary: {
      bg50: "bg-[rgb(var(--color-primary-50))]",
      bg100: "bg-[rgb(var(--color-primary-100))]",
      text500: "text-[rgb(var(--color-primary-700))]",
      text700: "text-[rgb(var(--color-primary-700))]",
      text800: "text-[rgb(var(--color-primary-800))]",
      border: "border-[rgb(var(--color-primary-500))]",
      borderLight: "border-[rgb(var(--color-primary-200))]",
    },
    gray: {
      bg50: "bg-[rgb(var(--color-secondary-50))]",
      bg100: "bg-[rgb(var(--color-secondary-100))]",
      bg800: "bg-[rgb(var(--color-secondary-800))]",
      bg900: "bg-[var(--text-primary)]",
      text200: "text-[var(--text-tertiary)]",
      text400: "text-[var(--text-tertiary)]",
      text500: "text-[var(--text-tertiary)]",
      text600: "text-[var(--text-secondary)]",
      text700: "text-[var(--text-secondary)]",
      text900: "text-[var(--text-primary)]",
      hoverBg: "hover:bg-[rgb(var(--color-secondary-100))]",
      hoverText: "hover:text-[var(--text-primary)]",
      hoverBgLight: "hover:bg-[rgb(var(--color-secondary-50))]",
    },
  },
  focus: {
    ring: "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
  },
};

/**
 * 네비게이션 아이템 기본 스타일
 */
export const navItemStyles = {
  base: "flex items-center gap-2 rounded-lg px-3 py-2 text-body-2 font-medium transition border-l-2",
  focus: designTokens.focus.ring,
  active: `${designTokens.colors.primary.bg50} ${designTokens.colors.primary.text500} ${designTokens.colors.primary.border}`,
  inactive: `${designTokens.colors.gray.text700} ${designTokens.colors.gray.hoverBg} ${designTokens.colors.gray.hoverText} border-transparent`,
  collapsed: "justify-center px-2",
  textHidden: "opacity-0 w-0 overflow-hidden",
};

/**
 * 카테고리 헤더 스타일
 */
export const categoryHeaderStyles = {
  base: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-body-2 font-medium transition border-l-2",
  focus: navItemStyles.focus,
  active: navItemStyles.active,
  inactive: navItemStyles.inactive,
  collapsed: navItemStyles.collapsed,
};

/**
 * 하위 메뉴 아이템 스타일
 */
export const subItemStyles = {
  base: "flex items-center gap-2 rounded-lg px-4 py-2 text-body-2 font-medium transition border-l-2",
  focus: navItemStyles.focus,
  active: `${designTokens.colors.primary.bg50} ${designTokens.colors.primary.text500} ${designTokens.colors.primary.border}`,
  inactive: `${designTokens.colors.gray.text700} ${designTokens.colors.gray.hoverBg} ${designTokens.colors.gray.hoverText} border-transparent`,
};

/**
 * 자식 메뉴 아이템 스타일 (3단계)
 */
export const childItemStyles = {
  base: "flex items-center gap-2 rounded-lg px-4 py-1.5 text-body-2 font-medium transition border-l-2",
  focus: navItemStyles.focus,
  active: `${designTokens.colors.primary.bg100} ${designTokens.colors.primary.text800} ${designTokens.colors.primary.border}`,
  inactive: `${designTokens.colors.gray.text600} ${designTokens.colors.gray.hoverBgLight} ${designTokens.colors.gray.hoverText} border-transparent`,
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
 * 툴팁 스타일
 */
export const tooltipStyles = {
  base: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-body-2 text-white bg-[var(--text-primary)] rounded shadow-[var(--elevation-8)] whitespace-nowrap z-[50] pointer-events-none",
  side: "absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-body-2 font-medium text-white bg-[var(--text-primary)] rounded shadow-[var(--elevation-8)] whitespace-nowrap z-50 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-opacity pointer-events-none",
  arrow:
    "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]",
};

/**
 * TopBar 스타일
 */
export const topBarStyles = {
  container: "fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-[rgb(var(--color-secondary-50))] border-b border-[rgb(var(--color-secondary-200))]",
  searchPill: "flex items-center gap-2 px-4 py-2 rounded-full bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] text-body-2 cursor-pointer hover:bg-[rgb(var(--color-secondary-200))] transition-colors min-w-[200px] max-w-[600px]",
};

/**
 * Waffle Menu 스타일
 */
export const waffleStyles = {
  trigger: "flex items-center justify-center w-9 h-9 rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors",
  dropdown: "absolute right-0 top-full mt-2 w-[320px] rounded-xl bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] shadow-lg p-4",
  grid: "grid grid-cols-3 gap-2",
  item: "flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-[rgb(var(--color-secondary-100))] transition-colors cursor-pointer text-center",
};

/**
 * Profile Menu 스타일
 */
export const profileMenuStyles = {
  trigger: "flex items-center justify-center w-8 h-8 rounded-full bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-700))] hover:bg-[rgb(var(--color-primary-200))] transition-colors cursor-pointer",
  dropdown: "absolute right-0 top-full mt-2 w-[280px] rounded-xl bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] shadow-lg overflow-hidden",
};

/**
 * 레이아웃 공통 스타일 (RoleBasedLayout에서 사용)
 */
export const layoutStyles = {
  borderBottom: "border-b border-[rgb(var(--color-secondary-200))]",
  borderTop: "border-t border-[rgb(var(--color-secondary-200))]",
  borderRight: "border-r border-[rgb(var(--color-secondary-200))]",
  flexCenter: "flex items-center gap-2",
  flexBetween: "flex items-center justify-between gap-2",
  flexColCenter: "flex flex-col items-center gap-3",
  padding4: "p-4",
  padding3: "px-4 py-3",
  padding2: "px-3 py-2",
  bgGray50: "bg-[rgb(var(--color-secondary-50))]",
  bgWhite: "bg-[rgb(var(--color-secondary-50))]",
  textHeading: "text-[var(--text-primary)]",
  textMuted: "text-[var(--text-tertiary)]",
  textSecondary: "text-[var(--text-secondary)]",
  hoverBg: "hover:bg-[rgb(var(--color-secondary-100))]",
  hoverText: "hover:text-[var(--text-primary)]",
  transition: "transition-colors",
  transitionAll: `transition-all ${animationDurations.normal} ease-in-out`,
  focusRing: designTokens.focus.ring,
  scrollableContainer: "overflow-y-auto overscroll-y-contain",
  fullHeight: "h-screen",
};

/**
 * 사이드바 스타일
 */
export const sidebarStyles = {
  container: `${layoutStyles.bgWhite} ${layoutStyles.borderRight} ${layoutStyles.transitionAll} z-[10]`,
  header: `${layoutStyles.borderBottom} ${layoutStyles.padding4} sticky top-0 z-[20] ${layoutStyles.bgWhite}`,
  tenantInfo: `${layoutStyles.borderBottom} ${layoutStyles.bgGray50} ${layoutStyles.padding3}`,
  navSection: "px-3 py-4",
  footer: `${layoutStyles.borderTop} ${layoutStyles.padding4} sticky bottom-0 z-[20] ${layoutStyles.bgWhite}`,
  logoLink: `${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`,
  collapseButton: `p-2 rounded-md ${layoutStyles.hoverBg} ${layoutStyles.textSecondary} ${layoutStyles.hoverText} ${layoutStyles.transition} ${layoutStyles.focusRing}`,
  expandButton: `group relative w-full ${layoutStyles.flexCenter} justify-center p-3 rounded-lg ${designTokens.colors.primary.bg50} hover:bg-[rgb(var(--color-primary-100))] ${designTokens.colors.primary.text500} ${layoutStyles.transition} border ${designTokens.colors.primary.borderLight} ${layoutStyles.focusRing}`,
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
