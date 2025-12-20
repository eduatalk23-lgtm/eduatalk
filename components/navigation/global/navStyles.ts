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
  expanded: "w-80",
} as const;

/**
 * 디자인 시스템 컬러 토큰
 *
 * 네비게이션 컴포넌트에서 사용하는 색상 토큰을 중앙 집중식으로 관리합니다.
 *
 * @remarks
 * 텍스트 색상과 배경 색상을 명확히 구분하여 정의합니다:
 * - `bg*` 접두사: 배경 색상 (예: bg50, bg100, bg800, bg900)
 * - `text*` 접두사: 텍스트 색상 (예: text400, text600, text700, text900)
 * - `hover*` 접두사: 호버 상태 색상 (예: hoverBg, hoverText, hoverBgLight)
 *
 * @example
 * ```tsx
 * // 올바른 사용법
 * <div className={designTokens.colors.gray.bg50}>
 *   <span className={designTokens.colors.gray.text700}>텍스트</span>
 * </div>
 * ```
 */
export const designTokens = {
  colors: {
    /**
     * Primary 색상 토큰 (Indigo 계열)
     * 네비게이션 활성 상태 등에 사용
     */
    primary: {
      // 배경 색상
      bg50: "bg-primary-50 dark:bg-primary-900/30",
      bg100: "bg-primary-100 dark:bg-primary-900/50",
      
      // 텍스트 색상
      text500: "text-primary-700 dark:text-primary-300",
      text700: "text-primary-700 dark:text-primary-300",
      text800: "text-primary-800 dark:text-primary-200",
      
      // 테두리
      border: "border-primary-500",
      borderLight: "border-primary-200 dark:border-primary-800",
    },
    /**
 * Gray 색상 토큰
 *
 * 텍스트와 배경 색상을 명확히 구분하여 정의합니다.
 * - 배경 색상: bg50, bg100, bg800, bg900
 * - 텍스트 색상: text200, text400, text500, text600, text700, text900
 * - 호버 색상: hoverBg, hoverText, hoverBgLight
 */
    gray: {
      // 배경 색상
      bg50: "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
      bg100: "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-900))]",
      bg800: "bg-[rgb(var(--color-secondary-800))] dark:bg-[rgb(var(--color-secondary-700))]",
      bg900: "bg-[var(--text-primary)] dark:bg-[var(--text-primary)]",

      // 텍스트 색상
      text200: "text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]",
      text400: "text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]",
      text500: "text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]",
      text600: "text-[var(--text-secondary)] dark:text-[var(--text-tertiary)]",
      text700: "text-[var(--text-secondary)] dark:text-[var(--text-primary)]",
      text900: "text-[var(--text-primary)] dark:text-[var(--text-primary)]",

      // 호버 색상
      hoverBg: "hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-900))]",
      hoverText: "hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]",
      hoverBgLight: "hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-900))]",
    },
  },
  focus: {
    ring: "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
  },
};

/**
 * 네비게이션 아이템 기본 스타일
 * 모든 아이템에 border-l-2를 기본으로 두어 활성/비활성 전환 시 레이아웃 시프트 방지
 */
export const navItemStyles = {
  // 기본 스타일 - border-l-2를 기본으로 두어 레이아웃 시프트 방지
  base: "flex items-center gap-2 rounded-lg px-3 py-2 text-body-2 font-medium transition border-l-2",

  // 포커스 스타일
  focus: designTokens.focus.ring,

  // 활성 상태
  active: `${designTokens.colors.primary.bg50} ${designTokens.colors.primary.text500} ${designTokens.colors.primary.border}`,

  // 비활성 상태 - 투명 보더로 레이아웃 유지
  inactive: `${designTokens.colors.gray.text700} ${designTokens.colors.gray.hoverBg} ${designTokens.colors.gray.hoverText} border-transparent`,

  // 축소 모드
  collapsed: "justify-center px-2",

  // 텍스트 숨김 (축소 모드)
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
 * 툴팁 스타일 (Breadcrumbs, CategoryNav 등에서 사용)
 *
 * @remarks
 * - `base`: 기본 툴팁 (Breadcrumbs 등에서 사용 - 위쪽에 표시)
 * - `side`: 사이드 툴팁 (CategoryNav collapsed 모드에서 사용 - 오른쪽에 표시, hover 시 표시)
 * - `arrow`: 툴팁 화살표 스타일
 *
 * @example
 * ```tsx
 * // Breadcrumbs에서 사용
 * <span className={tooltipStyles.base} role="tooltip">툴팁 내용</span>
 *
 * // CategoryNav collapsed 모드에서 사용
 * <span className={tooltipStyles.side} role="tooltip">카테고리 이름</span>
 * ```
 */
export const tooltipStyles = {
  /** 기본 툴팁 (Breadcrumbs 등에서 사용 - 위쪽에 표시) */
  base: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-body-2 text-white bg-[var(--text-primary)] dark:bg-[var(--text-primary)] dark:text-[var(--background)] rounded shadow-[var(--elevation-8)] whitespace-nowrap z-[50] pointer-events-none",
  /** 사이드 툴팁 (CategoryNav collapsed 모드에서 사용 - 오른쪽에 표시, hover 시 표시) */
  side: "absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-body-2 font-medium text-white bg-[var(--text-primary)] dark:bg-[var(--text-primary)] dark:text-[var(--background)] rounded shadow-[var(--elevation-8)] whitespace-nowrap z-50 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-opacity pointer-events-none",
  /** 툴팁 화살표 스타일 */
  arrow:
    "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)] dark:border-t-[var(--text-primary)]",
};

/**
 * Breadcrumbs 스타일
 *
 * @remarks
 * 브레드크럼 네비게이션 컴포넌트에서 사용하는 스타일을 정의합니다.
 * - `container`: 브레드크럼 컨테이너 (배경, 텍스트, 테두리 포함)
 * - `list`: 브레드크럼 리스트 레이아웃
 * - `separator`: 구분자 스타일
 * - `link`: 링크 항목 스타일 (hover 효과 포함)
 * - `current`: 현재 페이지 항목 스타일 (강조 표시)
 *
 * 모든 스타일은 다크 모드를 지원합니다.
 */
export const breadcrumbStyles = {
  container: `flex items-center gap-1 overflow-x-auto px-4 py-2 text-body-2 ${designTokens.colors.gray.text600} ${designTokens.colors.gray.bg50} border-b border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]`,
  list: "flex items-center gap-1 flex-wrap max-w-full",
  separator: designTokens.colors.gray.text400,
  link: `${designTokens.colors.gray.hoverText} truncate max-w-[120px] sm:max-w-[150px] md:max-w-[200px] transition`,
  current: `font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)] truncate max-w-[120px] sm:max-w-[150px] md:max-w-[200px]`,
};

/**
 * 레이아웃 공통 스타일 (RoleBasedLayout에서 사용)
 */
export const layoutStyles = {
  // Border 스타일
  borderBottom: "border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
  borderTop: "border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
  borderRight: "border-r border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",

  // Flex 레이아웃
  flexCenter: "flex items-center gap-2",
  flexBetween: "flex items-center justify-between gap-2",
  flexColCenter: "flex flex-col items-center gap-3",

  // Padding
  padding4: "p-4",
  padding3: "px-4 py-3",
  padding2: "px-3 py-2",

  // Background
  bgGray50: "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
  bgWhite: "bg-white dark:bg-[rgb(var(--color-secondary-900))]",

  // Text
  textHeading: "text-[var(--text-primary)] dark:text-[var(--text-primary)]",
  textMuted: "text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]",
  textSecondary: "text-[var(--text-secondary)] dark:text-[var(--text-tertiary)]",

  // Hover
  hoverBg: "hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]",
  hoverText: "hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]",

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
  navSection: "px-3 py-4",
  footer: `${layoutStyles.borderTop} ${layoutStyles.padding4} sticky bottom-0 z-[20] ${layoutStyles.bgWhite}`,
  logoLink: `${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`,
  collapseButton: `p-2 rounded-md ${layoutStyles.hoverBg} ${layoutStyles.textSecondary} ${layoutStyles.hoverText} ${layoutStyles.transition} ${layoutStyles.focusRing}`,
  expandButton: `group relative w-full ${layoutStyles.flexCenter} justify-center p-3 rounded-lg ${designTokens.colors.primary.bg50} hover:bg-primary-100 dark:hover:bg-primary-900/50 ${designTokens.colors.primary.text500} ${layoutStyles.transition} border ${designTokens.colors.primary.borderLight} ${layoutStyles.focusRing}`,
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
