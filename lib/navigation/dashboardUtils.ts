/**
 * 대시보드 카테고리 유틸리티
 * NavigationCategory를 대시보드 카드용 형태로 변환
 */

import {
  CalendarDays,
  ClipboardList,
  BookOpen,
  Tent,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

export type DashboardCategory = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * href → LucideIcon 매핑 테이블
 */
const hrefIconMap: Record<string, LucideIcon> = {
  "/today": CalendarDays,
  "/plan": ClipboardList,
  "/contents": BookOpen,
  "/camp": Tent,
  "/attendance/check-in": CheckCircle,
};

/**
 * href → label 매핑 테이블 (서버 컴포넌트에서 사용)
 */
const hrefLabelMap: Record<string, string> = {
  "/today": "학습 관리",
  "/plan": "플랜 관리",
  "/contents": "콘텐츠 관리",
  "/camp": "캠프 관리",
  "/attendance/check-in": "출석 관리",
};

/**
 * 학생 카테고리를 대시보드 카드용 형태로 변환
 * 서버 컴포넌트에서 사용 가능하도록 직접 매핑 사용
 */
export function getDashboardCategories(): DashboardCategory[] {
  const result: DashboardCategory[] = [];

  // 직접 매핑된 href들만 사용
  for (const [href, icon] of Object.entries(hrefIconMap)) {
    const label = hrefLabelMap[href];
    if (label) {
      result.push({
        label,
        href,
        icon,
      });
    }
  }

  return result;
}

