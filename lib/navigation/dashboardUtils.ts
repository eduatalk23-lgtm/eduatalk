/**
 * 대시보드 카테고리 유틸리티
 * NavigationCategory를 대시보드 카드용 형태로 변환
 */

import { getCategoriesForRole } from "@/components/navigation/global/categoryConfig";
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  BookOpen,
  Users,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

export type DashboardCategory = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * 이모지 → LucideIcon 매핑 테이블
 */
const iconMap: Record<string, LucideIcon> = {
  "📊": LayoutDashboard,
  "📅": Clock,
  "📋": CalendarCheck,
  "📚": BookOpen,
  "🏕️": Users,
  "✅": CheckCircle,
};

/**
 * 학생 카테고리를 대시보드 카드용 형태로 변환
 */
export function getDashboardCategories(): DashboardCategory[] {
  const categories = getCategoriesForRole("student");
  const result: DashboardCategory[] = [];

  for (const category of categories) {
    for (const item of category.items) {
      // 대시보드 제외
      if (item.href === "/dashboard") continue;

      // 아이콘이 있고 매핑이 존재하는 경우만 추가
      if (item.icon && iconMap[item.icon]) {
        result.push({
          label: item.label,
          href: item.href,
          icon: iconMap[item.icon],
        });
      }
    }
  }

  return result;
}

