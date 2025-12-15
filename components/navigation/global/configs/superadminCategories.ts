/**
 * Super Admin 영역 카테고리 설정
 */

"use client";

import type { NavigationCategory } from "../types";
import {
  BarChart3,
  Building2,
  Users,
  User,
  Mail,
  Link2,
  Settings,
  BookOpen,
  FileText,
} from "lucide-react";

export const superadminCategories: NavigationCategory[] = [
  {
    id: "superadmin-dashboard",
    label: "대시보드",
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      {
        id: "superadmin-dashboard-main",
        label: "대시보드",
        href: "/superadmin/dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "superadmin-tenants",
    label: "기관 관리",
    icon: <Building2 className="w-4 h-4" />,
    items: [
      {
        id: "superadmin-tenants-main",
        label: "기관 관리",
        href: "/superadmin/tenants",
        icon: <Building2 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "superadmin-users",
    label: "사용자 관리",
    icon: <Users className="w-4 h-4" />,
    items: [
      {
        id: "superadmin-admin-users",
        label: "관리자 계정",
        href: "/superadmin/admin-users",
        icon: <User className="w-4 h-4" />,
      },
      {
        id: "superadmin-unverified-users",
        label: "미인증 가입 관리",
        href: "/superadmin/unverified-users",
        icon: <Mail className="w-4 h-4" />,
      },
      {
        id: "superadmin-tenantless-users",
        label: "테넌트 미할당 사용자",
        href: "/superadmin/tenantless-users",
        icon: <Link2 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "superadmin-settings",
    label: "설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      {
        id: "superadmin-settings-main",
        label: "설정",
        href: "/superadmin/settings",
        icon: <Settings className="w-4 h-4" />,
      },
      {
        id: "superadmin-curriculum-settings",
        label: "교육과정 설정",
        href: "/superadmin/curriculum-settings",
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        id: "superadmin-terms-management",
        label: "약관 관리",
        href: "/superadmin/terms-management",
        icon: <FileText className="w-4 h-4" />,
      },
    ],
  },
];

