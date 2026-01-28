/**
 * 학생 영역 카테고리 설정
 *
 * 구조 (7개 카테고리):
 * 1. 홈 - 대시보드
 * 2. 오늘 학습 - 핵심 기능 (독립 카테고리)
 * 3. 플랜 관리 - 플랜 + 콘텐츠 + 시간 통합
 * 4. 캠프 - 캠프 관련 기능
 * 5. 학습 분석 - 분석 + 리포트 통합
 * 6. 성적 관리 - 성적 입력 및 분석
 * 7. 설정 - 출석 + 프로필 + 계정 통합
 *
 * Note: 채팅은 플로팅 위젯(FloatingChatWidget)으로 제공
 */

"use client";

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
  Activity,
  AlertTriangle,
  Timer,
  Home,
  CalendarCheck,
  CalendarX,
} from "lucide-react";

export const studentCategories: NavigationCategory[] = [
  // 1. 홈
  {
    id: "home",
    label: "홈",
    icon: <Home className="w-4 h-4" />,
    items: [
      {
        id: "dashboard-main",
        label: "대시보드",
        href: "/dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },

  // 2. 오늘 학습 (핵심 기능 - 독립 카테고리로 승격)
  {
    id: "today",
    label: "오늘 학습",
    icon: <CalendarCheck className="w-4 h-4" />,
    items: [
      {
        id: "today-main",
        label: "오늘 학습",
        href: "/today",
        icon: <CalendarCheck className="w-4 h-4" />,
      },
    ],
  },

  // 3. 플랜 관리 (플랜 + 콘텐츠 + 시간 통합)
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
        id: "plan-adjust",
        label: "플랜 재조정",
        href: "/plan/adjust",
        icon: <CalendarDays className="w-4 h-4" />,
      },
      {
        id: "plan-stats",
        label: "학습 통계",
        href: "/plan/stats",
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        id: "contents-list",
        label: "콘텐츠",
        href: "/contents",
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        id: "blocks-sets",
        label: "블록 세트",
        href: "/blocks?tab=blocks",
        icon: <Clock className="w-4 h-4" />,
        queryParams: { tab: "blocks" },
      },
      {
        id: "blocks-exclusions",
        label: "학습 제외 일정",
        href: "/blocks?tab=exclusions",
        icon: <CalendarX className="w-4 h-4" />,
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

  // 4. 캠프
  {
    id: "camp",
    label: "캠프",
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
        label: "캠프 캘린더",
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

  // 5. 학습 분석 (분석 + 리포트 통합)
  {
    id: "analysis",
    label: "학습 분석",
    icon: <Activity className="w-4 h-4" />,
    items: [
      {
        id: "analysis-risk",
        label: "취약 과목 분석",
        href: "/analysis",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      {
        id: "analysis-pattern",
        label: "학습 패턴 분석",
        href: "/analysis/patterns",
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        id: "analysis-time",
        label: "시간 분석",
        href: "/analysis/time",
        icon: <Timer className="w-4 h-4" />,
      },
      {
        id: "reports-weekly",
        label: "주간 리포트",
        href: "/report/weekly",
        icon: <CalendarDays className="w-4 h-4" />,
      },
      {
        id: "reports-monthly",
        label: "월간 리포트",
        href: "/report/monthly",
        icon: <Calendar className="w-4 h-4" />,
      },
    ],
  },

  // 6. 성적 관리
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
        label: "성적 분석",
        href: "/scores/analysis",
        icon: <TrendingUp className="w-4 h-4" />,
      },
    ],
  },

  // 7. 설정 (출석 + 프로필 + 계정 통합)
  {
    id: "settings",
    label: "설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      {
        id: "attendance-check-in",
        label: "출석 체크",
        href: "/attendance/check-in",
        icon: <CheckCircle className="w-4 h-4" />,
      },
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
