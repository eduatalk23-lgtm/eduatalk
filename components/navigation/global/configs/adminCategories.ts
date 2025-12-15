/**
 * 관리자 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";

export const adminCategories: NavigationCategory[] = [
  {
    id: "admin-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "admin-dashboard-main",
        label: "대시보드",
        href: "/admin/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "admin-students",
    label: "학생 관리",
    icon: "👥",
    items: [
      {
        id: "admin-students-list",
        label: "학생 목록",
        href: "/admin/students",
        icon: "👥",
      },
      {
        id: "admin-students-attendance",
        label: "출석 관리",
        href: "/admin/attendance",
        icon: "✓",
      },
      {
        id: "admin-attendance-qr-code",
        label: "QR 코드 생성",
        href: "/admin/attendance/qr-code",
        icon: "📱",
      },
      {
        id: "admin-attendance-settings",
        label: "출석 위치 설정",
        href: "/admin/attendance/settings",
        icon: "📍",
      },
      {
        id: "admin-parent-links",
        label: "학부모 연결 관리",
        href: "/admin/parent-links",
        icon: "👨‍👩‍👧",
      },
    ],
  },
  {
    id: "admin-consulting",
    label: "상담 노트",
    icon: "📝",
    items: [
      {
        id: "admin-consulting-list",
        label: "상담 노트",
        href: "/admin/consulting",
        icon: "📝",
      },
    ],
  },
  {
    id: "admin-communication",
    label: "SMS 관리",
    icon: "📱",
    items: [
      {
        id: "admin-sms-send",
        label: "SMS 발송",
        href: "/admin/sms/send",
        icon: "📤",
      },
      {
        id: "admin-sms-logs",
        label: "SMS 발송 이력",
        href: "/admin/sms/results",
        icon: "📱",
      },
    ],
  },
  {
    id: "admin-reports",
    label: "리포트",
    icon: "📄",
    items: [
      {
        id: "admin-reports-list",
        label: "리포트",
        href: "/admin/reports",
        icon: "📄",
      },
    ],
  },
  {
    id: "admin-compare",
    label: "비교 분석",
    icon: "📈",
    items: [
      {
        id: "admin-compare-main",
        label: "비교 분석",
        href: "/admin/compare",
        icon: "📈",
      },
    ],
  },
  {
    id: "admin-master-content",
    label: "서비스 마스터",
    icon: "📚",
    items: [
      {
        id: "admin-content-metadata",
        label: "콘텐츠 메타데이터",
        href: "/admin/content-metadata",
        icon: "📋",
      },
      {
        id: "admin-subjects",
        label: "교과/과목 관리",
        href: "/admin/subjects",
        icon: "📚",
      },
      {
        id: "admin-master-books",
        label: "교재 관리",
        href: "/admin/master-books",
        icon: "📖",
      },
      {
        id: "admin-master-lectures",
        label: "강의 관리",
        href: "/admin/master-lectures",
        icon: "🎧",
      },
      {
        id: "admin-schools",
        label: "학교 관리",
        href: "/admin/schools",
        icon: "🏫",
      },
    ],
  },
  {
    id: "admin-time-management",
    label: "시간 관리",
    icon: "⏰",
    items: [
      {
        id: "admin-time-management-main",
        label: "시간 관리",
        href: "/admin/time-management",
        icon: "⏰",
      },
    ],
  },
  {
    id: "admin-camp",
    label: "캠프 관리",
    icon: "🏕️",
    items: [
      {
        id: "admin-camp-templates",
        label: "캠프 템플릿",
        href: "/admin/camp-templates",
        icon: "🏕️",
      },
    ],
  },
  {
    id: "admin-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "admin-settings-main",
        label: "설정",
        href: "/admin/settings",
        icon: "⚙️",
      },
      {
        id: "admin-tenant-settings",
        label: "기관 설정",
        href: "/admin/tenant/settings",
        icon: "🏢",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-scheduler-settings",
        label: "스케줄러 설정",
        href: "/admin/settings/scheduler",
        icon: "📅",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-recommendation-settings",
        label: "추천 시스템 설정",
        href: "/admin/recommendation-settings",
        icon: "🎯",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tenant-users",
        label: "기관별 사용자 관리",
        href: "/admin/tenant/users",
        icon: "👥",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tools",
        label: "도구",
        href: "/admin/tools",
        icon: "🛠️",
      },
    ],
  },
];

