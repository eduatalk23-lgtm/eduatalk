/**
 * 학부모 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";
import {
  BarChart3,
  FileCheck,
  CalendarDays,
  Calendar,
  TrendingUp,
  Target,
  History,
  Settings,
} from "lucide-react";

export const parentCategories: NavigationCategory[] = [
  {
    id: "parent-dashboard",
    label: "대시보드",
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      {
        id: "parent-dashboard-main",
        label: "대시보드",
        href: "/parent/dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "parent-reports",
    label: "리포트",
    icon: <FileCheck className="w-4 h-4" />,
    items: [
      {
        id: "parent-reports-weekly",
        label: "주간 리포트",
        href: "/parent/report/weekly",
        icon: <CalendarDays className="w-4 h-4" />,
      },
      {
        id: "parent-reports-monthly",
        label: "월간 리포트",
        href: "/parent/report/monthly",
        icon: <Calendar className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "parent-performance",
    label: "성과",
    icon: <TrendingUp className="w-4 h-4" />,
    items: [
      {
        id: "parent-scores",
        label: "성적",
        href: "/parent/scores",
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        id: "parent-goals",
        label: "목표",
        href: "/parent/goals",
        icon: <Target className="w-4 h-4" />,
      },
      {
        id: "parent-history",
        label: "이력",
        href: "/parent/history",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "parent-settings",
    label: "설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      {
        id: "parent-settings-main",
        label: "설정",
        href: "/parent/settings",
        icon: <Settings className="w-4 h-4" />,
      },
    ],
  },
];

