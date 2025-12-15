/**
 * 학생 영역 카테고리 설정
 */

import type { NavigationCategory } from "../types";
import {
  BarChart3,
  Tent,
  ClipboardList,
  Calendar,
  CalendarDays,
  BookOpen,
  Clock,
  School,
  FileText,
  Pencil,
  TrendingUp,
  CheckCircle,
  Bell,
  Smartphone,
  Lock,
  User,
  Settings,
} from "lucide-react";

export const studentCategories: NavigationCategory[] = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      {
        id: "dashboard-main",
        label: "대시보드",
        href: "/dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "camp",
    label: "캠프 관리",
    icon: <Tent className="w-4 h-4" />,
    items: [
      {
        id: "camp-list",
        label: "캠프 목록",
        href: "/camp",
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        id: "camp-calendar",
        label: "캠프 플랜 캘린더",
        href: "/camp/calendar",
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        id: "camp-today",
        label: "캠프 학습관리",
        href: "/camp/today",
        icon: <CalendarDays className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "plan",
    label: "플랜 관리",
    icon: <ClipboardList className="w-4 h-4" />,
    items: [
      {
        id: "plan-list",
        label: "플랜 목록",
        href: "/plan",
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        id: "plan-calendar",
        label: "플랜 캘린더",
        href: "/plan/calendar",
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        id: "plan-today",
        label: "학습 관리",
        href: "/today",
        icon: <CalendarDays className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "contents",
    label: "콘텐츠 관리",
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      {
        id: "contents-list",
        label: "콘텐츠",
        href: "/contents",
        icon: <BookOpen className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "time",
    label: "시간 관리",
    icon: <Clock className="w-4 h-4" />,
    items: [
      {
        id: "blocks-sets",
        label: "블록 세트",
        href: "/blocks?tab=blocks",
        icon: <CalendarDays className="w-4 h-4" />,
        queryParams: { tab: "blocks" },
      },
      {
        id: "blocks-exclusions",
        label: "학습 제외 일정",
        href: "/blocks?tab=exclusions",
        icon: <Calendar className="w-4 h-4" />,
        queryParams: { tab: "exclusions" },
      },
      {
        id: "blocks-academy",
        label: "학원 일정",
        href: "/blocks?tab=academy",
        icon: <School className="w-4 h-4" />,
        queryParams: { tab: "academy" },
      },
    ],
  },
  {
    id: "scores",
    label: "성적 관리",
    icon: <FileText className="w-4 h-4" />,
    items: [
      {
        id: "scores-dashboard",
        label: "성적 대시보드",
        href: "/scores/dashboard/unified",
        icon: <BarChart3 className="w-4 h-4" />,
      },
      {
        id: "scores-input-internal",
        label: "내신 성적 입력",
        href: "/scores/input?tab=internal",
        icon: <Pencil className="w-4 h-4" />,
        queryParams: { tab: "internal" },
      },
      {
        id: "scores-input-mock",
        label: "모의고사 성적 입력",
        href: "/scores/input?tab=mock",
        icon: <FileText className="w-4 h-4" />,
        queryParams: { tab: "mock" },
      },
      {
        id: "scores-analysis",
        label: "상세 분석 보기",
        href: "/scores/analysis",
        icon: <TrendingUp className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "attendance",
    label: "출석 관리",
    icon: <CheckCircle className="w-4 h-4" />,
    items: [
      {
        id: "attendance-check-in",
        label: "출석 체크",
        href: "/attendance/check-in",
        icon: <CheckCircle className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "reports",
    label: "학습 리포트",
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      {
        id: "reports-weekly",
        label: "주간 리포트",
        href: "/reports?period=weekly",
        icon: <CalendarDays className="w-4 h-4" />,
        queryParams: { period: "weekly" },
      },
      {
        id: "reports-monthly",
        label: "월간 리포트",
        href: "/reports?period=monthly",
        icon: <Calendar className="w-4 h-4" />,
        queryParams: { period: "monthly" },
      },
      {
        id: "reports-weekly-detail",
        label: "상세 주간 리포트",
        href: "/report/weekly",
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        id: "reports-monthly-detail",
        label: "상세 월간 리포트",
        href: "/report/monthly",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "settings",
    label: "설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      {
        id: "settings-profile",
        label: "프로필",
        href: "/settings",
        icon: <User className="w-4 h-4" />,
      },
      {
        id: "settings-notifications",
        label: "알림 설정",
        href: "/settings/notifications",
        icon: <Bell className="w-4 h-4" />,
      },
      {
        id: "settings-devices",
        label: "로그인 기기 관리",
        href: "/settings/devices",
        icon: <Smartphone className="w-4 h-4" />,
      },
      {
        id: "settings-account",
        label: "계정 관리",
        href: "/settings/account",
        icon: <Lock className="w-4 h-4" />,
      },
    ],
  },
];

