/**
 * 네비게이션 타입 정의
 */

export type NavigationRole = "student" | "admin" | "parent" | "superadmin";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];
  roles?: NavigationRole[]; // 특정 역할만 접근 가능 (없으면 모든 역할)
  exactMatch?: boolean; // 정확히 일치해야 활성화 (기본값: false, startsWith)
};

export type NavigationCategory = {
  id: string;
  label: string;
  icon?: string;
  items: NavigationItem[];
  roles?: NavigationRole[];
};

