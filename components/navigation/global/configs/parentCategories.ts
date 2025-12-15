/**
 * 학부모 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";

export const parentCategories: NavigationCategory[] = [
  {
    id: "parent-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "parent-dashboard-main",
        label: "대시보드",
        href: "/parent/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "parent-reports",
    label: "리포트",
    icon: "📄",
    items: [
      {
        id: "parent-reports-weekly",
        label: "주간 리포트",
        href: "/parent/report/weekly",
        icon: "📅",
      },
      {
        id: "parent-reports-monthly",
        label: "월간 리포트",
        href: "/parent/report/monthly",
        icon: "📆",
      },
    ],
  },
  {
    id: "parent-performance",
    label: "성과",
    icon: "📈",
    items: [
      {
        id: "parent-scores",
        label: "성적",
        href: "/parent/scores",
        icon: "📈",
      },
      {
        id: "parent-goals",
        label: "목표",
        href: "/parent/goals",
        icon: "🎯",
      },
      {
        id: "parent-history",
        label: "이력",
        href: "/parent/history",
        icon: "📜",
      },
    ],
  },
  {
    id: "parent-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "parent-settings-main",
        label: "설정",
        href: "/parent/settings",
        icon: "⚙️",
      },
    ],
  },
];

