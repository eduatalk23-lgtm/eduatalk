/**
 * 네비게이션 타입 정의
 */

import type { ReactNode } from "react";

export type NavigationRole = "student" | "admin" | "parent" | "superadmin" | "consultant";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  children?: NavigationItem[];
  roles?: NavigationRole[]; // 특정 역할만 접근 가능 (없으면 모든 역할)
  exactMatch?: boolean; // 정확히 일치해야 활성화 (기본값: false, startsWith)
  queryParams?: Record<string, string>; // 쿼리 파라미터 매칭용 (예: { tab: "blocks" })
};

export type NavigationCategory = {
  id: string;
  label: string;
  icon?: ReactNode;
  items: NavigationItem[];
  roles?: NavigationRole[];
};

