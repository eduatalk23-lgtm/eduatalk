/**
 * 관리자 영역 카테고리 설정
 */

"use client";

import type { NavigationCategory } from "../types";
import {
  BarChart3,
  Users,
  CheckCircle,
  Smartphone,
  MapPin,
  UsersRound,
  FileText,
  MessageSquare,
  Send,
  FileCheck,
  TrendingUp,
  BookOpen,
  ClipboardList,
  Book,
  Headphones,
  School,
  Clock,
  Tent,
  Settings,
  Building2,
  CalendarDays,
  Target,
  Wrench,
} from "lucide-react";

export const adminCategories: NavigationCategory[] = [
  {
    id: "admin-dashboard",
    label: "대시보드",
    icon: <BarChart3 className="w-4 h-4" />,
    items: [
      {
        id: "admin-dashboard-main",
        label: "대시보드",
        href: "/admin/dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-students",
    label: "학생 관리",
    icon: <Users className="w-4 h-4" />,
    items: [
      {
        id: "admin-students-list",
        label: "학생 목록",
        href: "/admin/students",
        icon: <Users className="w-4 h-4" />,
      },
      {
        id: "admin-students-attendance",
        label: "출석 관리",
        href: "/admin/attendance",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-qr-code",
        label: "QR 코드 생성",
        href: "/admin/attendance/qr-code",
        icon: <Smartphone className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-settings",
        label: "출석 위치 설정",
        href: "/admin/attendance/settings",
        icon: <MapPin className="w-4 h-4" />,
      },
      {
        id: "admin-parent-links",
        label: "학부모 연결 관리",
        href: "/admin/parent-links",
        icon: <UsersRound className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-consulting",
    label: "상담 노트",
    icon: <FileText className="w-4 h-4" />,
    items: [
      {
        id: "admin-consulting-list",
        label: "상담 노트",
        href: "/admin/consulting",
        icon: <FileText className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-communication",
    label: "SMS 관리",
    icon: <Smartphone className="w-4 h-4" />,
    items: [
      {
        id: "admin-sms-send",
        label: "SMS 발송",
        href: "/admin/sms/send",
        icon: <Send className="w-4 h-4" />,
      },
      {
        id: "admin-sms-logs",
        label: "SMS 발송 이력",
        href: "/admin/sms/results",
        icon: <Smartphone className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-reports",
    label: "리포트",
    icon: <FileCheck className="w-4 h-4" />,
    items: [
      {
        id: "admin-reports-list",
        label: "리포트",
        href: "/admin/reports",
        icon: <FileCheck className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-compare",
    label: "비교 분석",
    icon: <TrendingUp className="w-4 h-4" />,
    items: [
      {
        id: "admin-compare-main",
        label: "비교 분석",
        href: "/admin/compare",
        icon: <TrendingUp className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-master-content",
    label: "서비스 마스터",
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      {
        id: "admin-content-metadata",
        label: "콘텐츠 메타데이터",
        href: "/admin/content-metadata",
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        id: "admin-subjects",
        label: "교과/과목 관리",
        href: "/admin/subjects",
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        id: "admin-master-books",
        label: "교재 관리",
        href: "/admin/master-books",
        icon: <Book className="w-4 h-4" />,
      },
      {
        id: "admin-master-lectures",
        label: "강의 관리",
        href: "/admin/master-lectures",
        icon: <Headphones className="w-4 h-4" />,
      },
      {
        id: "admin-schools",
        label: "학교 관리",
        href: "/admin/schools",
        icon: <School className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-time-management",
    label: "시간 관리",
    icon: <Clock className="w-4 h-4" />,
    items: [
      {
        id: "admin-time-management-main",
        label: "시간 관리",
        href: "/admin/time-management",
        icon: <Clock className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-camp",
    label: "캠프 관리",
    icon: <Tent className="w-4 h-4" />,
    items: [
      {
        id: "admin-camp-templates",
        label: "캠프 템플릿",
        href: "/admin/camp-templates",
        icon: <Tent className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-settings",
    label: "설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      {
        id: "admin-settings-main",
        label: "설정",
        href: "/admin/settings",
        icon: <Settings className="w-4 h-4" />,
      },
      {
        id: "admin-tenant-settings",
        label: "기관 설정",
        href: "/admin/tenant/settings",
        icon: <Building2 className="w-4 h-4" />,
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-scheduler-settings",
        label: "스케줄러 설정",
        href: "/admin/settings/scheduler",
        icon: <CalendarDays className="w-4 h-4" />,
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-recommendation-settings",
        label: "추천 시스템 설정",
        href: "/admin/recommendation-settings",
        icon: <Target className="w-4 h-4" />,
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tenant-users",
        label: "기관별 사용자 관리",
        href: "/admin/tenant/users",
        icon: <Users className="w-4 h-4" />,
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tools",
        label: "도구",
        href: "/admin/tools",
        icon: <Wrench className="w-4 h-4" />,
      },
    ],
  },
];

