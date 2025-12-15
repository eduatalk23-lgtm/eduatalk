/**
 * 학생 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";

export const studentCategories: NavigationCategory[] = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "dashboard-main",
        label: "대시보드",
        href: "/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "camp",
    label: "캠프 관리",
    icon: "🏕️",
    items: [
      {
        id: "camp-list",
        label: "캠프 목록",
        href: "/camp",
        icon: "📋",
      },
      {
        id: "camp-calendar",
        label: "캠프 플랜 캘린더",
        href: "/camp/calendar",
        icon: "🗓️",
      },
      {
        id: "camp-today",
        label: "캠프 학습관리",
        href: "/camp/today",
        icon: "📅",
      },
    ],
  },
  {
    id: "plan",
    label: "플랜 관리",
    icon: "📋",
    items: [
      {
        id: "plan-list",
        label: "플랜 목록",
        href: "/plan",
        icon: "📋",
      },
      {
        id: "plan-calendar",
        label: "플랜 캘린더",
        href: "/plan/calendar",
        icon: "🗓️",
      },
      {
        id: "plan-today",
        label: "학습 관리",
        href: "/today",
        icon: "📅",
      },
    ],
  },
  {
    id: "contents",
    label: "콘텐츠 관리",
    icon: "📚",
    items: [
      {
        id: "contents-list",
        label: "콘텐츠",
        href: "/contents",
        icon: "📚",
      },
    ],
  },
  {
    id: "time",
    label: "시간 관리",
    icon: "⏰",
    items: [
      {
        id: "blocks-sets",
        label: "블록 세트",
        href: "/blocks?tab=blocks",
        icon: "📅",
        queryParams: { tab: "blocks" },
      },
      {
        id: "blocks-exclusions",
        label: "학습 제외 일정",
        href: "/blocks?tab=exclusions",
        icon: "🗓️",
        queryParams: { tab: "exclusions" },
      },
      {
        id: "blocks-academy",
        label: "학원 일정",
        href: "/blocks?tab=academy",
        icon: "🏫",
        queryParams: { tab: "academy" },
      },
    ],
  },
  {
    id: "scores",
    label: "성적 관리",
    icon: "📝",
    items: [
      {
        id: "scores-dashboard",
        label: "성적 대시보드",
        href: "/scores/dashboard/unified",
        icon: "📊",
      },
      {
        id: "scores-input-internal",
        label: "내신 성적 입력",
        href: "/scores/input?tab=internal",
        icon: "✏️",
        queryParams: { tab: "internal" },
      },
      {
        id: "scores-input-mock",
        label: "모의고사 성적 입력",
        href: "/scores/input?tab=mock",
        icon: "📝",
        queryParams: { tab: "mock" },
      },
      {
        id: "scores-analysis",
        label: "상세 분석 보기",
        href: "/scores/analysis",
        icon: "📈",
      },
    ],
  },
  {
    id: "attendance",
    label: "출석 관리",
    icon: "✅",
    items: [
      {
        id: "attendance-check-in",
        label: "출석 체크",
        href: "/attendance/check-in",
        icon: "✅",
      },
    ],
  },
  {
    id: "reports",
    label: "학습 리포트",
    icon: "📊",
    items: [
      {
        id: "reports-weekly",
        label: "주간 리포트",
        href: "/reports?period=weekly",
        icon: "📅",
        queryParams: { period: "weekly" },
      },
      {
        id: "reports-monthly",
        label: "월간 리포트",
        href: "/reports?period=monthly",
        icon: "📆",
        queryParams: { period: "monthly" },
      },
      {
        id: "reports-weekly-detail",
        label: "상세 주간 리포트",
        href: "/report/weekly",
        icon: "📈",
      },
      {
        id: "reports-monthly-detail",
        label: "상세 월간 리포트",
        href: "/report/monthly",
        icon: "📊",
      },
    ],
  },
  {
    id: "settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "settings-profile",
        label: "프로필",
        href: "/settings",
        icon: "👤",
      },
      {
        id: "settings-notifications",
        label: "알림 설정",
        href: "/settings/notifications",
        icon: "🔔",
      },
      {
        id: "settings-devices",
        label: "로그인 기기 관리",
        href: "/settings/devices",
        icon: "📱",
      },
      {
        id: "settings-account",
        label: "계정 관리",
        href: "/settings/account",
        icon: "🔐",
      },
    ],
  },
];

