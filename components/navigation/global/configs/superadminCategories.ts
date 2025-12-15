/**
 * Super Admin 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";

export const superadminCategories: NavigationCategory[] = [
  {
    id: "superadmin-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "superadmin-dashboard-main",
        label: "대시보드",
        href: "/superadmin/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "superadmin-tenants",
    label: "기관 관리",
    icon: "🏛️",
    items: [
      {
        id: "superadmin-tenants-main",
        label: "기관 관리",
        href: "/superadmin/tenants",
        icon: "🏛️",
      },
    ],
  },
  {
    id: "superadmin-users",
    label: "사용자 관리",
    icon: "👥",
    items: [
      {
        id: "superadmin-admin-users",
        label: "관리자 계정",
        href: "/superadmin/admin-users",
        icon: "👤",
      },
      {
        id: "superadmin-unverified-users",
        label: "미인증 가입 관리",
        href: "/superadmin/unverified-users",
        icon: "✉️",
      },
      {
        id: "superadmin-tenantless-users",
        label: "테넌트 미할당 사용자",
        href: "/superadmin/tenantless-users",
        icon: "🔗",
      },
    ],
  },
  {
    id: "superadmin-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "superadmin-settings-main",
        label: "설정",
        href: "/superadmin/settings",
        icon: "⚙️",
      },
      {
        id: "superadmin-curriculum-settings",
        label: "교육과정 설정",
        href: "/superadmin/curriculum-settings",
        icon: "📚",
      },
      {
        id: "superadmin-terms-management",
        label: "약관 관리",
        href: "/superadmin/terms-management",
        icon: "📄",
      },
    ],
  },
];

