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
  Radio,
  AlertTriangle,
  UserCircle,
  Sparkles,
  UserPlus,
  GraduationCap,
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
        label: "학생 조회",
        href: "/admin/students",
        icon: <Users className="w-4 h-4" />,
      },
      {
        id: "admin-students-divisions",
        label: "학생 구분 관리",
        href: "/admin/students/divisions",
        icon: <UsersRound className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-attendance",
    label: "출석 관리",
    icon: <CheckCircle className="w-4 h-4" />,
    items: [
      {
        id: "admin-attendance-records",
        label: "출석 기록",
        href: "/admin/attendance",
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-statistics",
        label: "출석 통계",
        href: "/admin/attendance/statistics",
        icon: <BarChart3 className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-qr-code",
        label: "QR 코드 관리",
        href: "/admin/attendance/qr-code",
        icon: <Smartphone className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-settings",
        label: "출석 설정",
        href: "/admin/attendance/settings",
        icon: <Settings className="w-4 h-4" />,
      },
      {
        id: "admin-attendance-sms-logs",
        label: "SMS 로그",
        href: "/admin/attendance/sms-logs",
        icon: <MessageSquare className="w-4 h-4" />,
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
    id: "admin-chat",
    label: "채팅",
    icon: <MessageSquare className="w-4 h-4" />,
    items: [
      {
        id: "admin-chat-list",
        label: "채팅",
        href: "/admin/chat",
        icon: <MessageSquare className="w-4 h-4" />,
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
        id: "admin-master-instructors",
        label: "강사 추천 관리",
        href: "/admin/master-instructors",
        icon: <GraduationCap className="w-4 h-4" />,
      },
      {
        id: "admin-book-recommendations",
        label: "교재 추천 관리",
        href: "/admin/book-recommendations",
        icon: <Sparkles className="w-4 h-4" />,
      },
      {
        id: "admin-lecture-recommendations",
        label: "강의 추천 관리",
        href: "/admin/lecture-recommendations",
        icon: <Sparkles className="w-4 h-4" />,
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
      {
        id: "admin-camp-live",
        label: "실시간 모니터링",
        href: "/admin/camp-live",
        icon: <Radio className="w-4 h-4" />,
      },
      {
        id: "admin-camp-attendance",
        label: "출석 통합 관리",
        href: "/admin/camp-attendance",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        id: "admin-camp-plans",
        label: "플랜 통합 관리",
        href: "/admin/camp-plans",
        icon: <ClipboardList className="w-4 h-4" />,
      },
      {
        id: "admin-camp-alerts",
        label: "이상 징후 감지",
        href: "/admin/camp-alerts",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      {
        id: "admin-camp-students",
        label: "학생 통합 관리",
        href: "/admin/camp-students",
        icon: <UserCircle className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-crm",
    label: "세일즈 관리",
    icon: <Target className="w-4 h-4" />,
    items: [
      {
        id: "admin-crm-pipeline",
        label: "파이프라인",
        href: "/admin/crm",
        icon: <BarChart3 className="w-4 h-4" />,
      },
      {
        id: "admin-crm-leads",
        label: "리드 목록",
        href: "/admin/crm/leads",
        icon: <Users className="w-4 h-4" />,
      },
{
        id: "admin-crm-tasks",
        label: "태스크 센터",
        href: "/admin/crm/tasks",
        icon: <CheckCircle className="w-4 h-4" />,
      },
    ],
  },
  {
    id: "admin-team",
    label: "팀 관리",
    icon: <UserPlus className="w-4 h-4" />,
    items: [
      {
        id: "admin-team-list",
        label: "팀원 관리",
        href: "/admin/team",
        icon: <UsersRound className="w-4 h-4" />,
      },
      {
        id: "admin-team-invite",
        label: "팀원 초대",
        href: "/admin/team/invite",
        icon: <UserPlus className="w-4 h-4" />,
        roles: ["admin"], // admin만 접근
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
        id: "admin-cold-start",
        label: "콜드 스타트 관리",
        href: "/admin/cold-start",
        icon: <Sparkles className="w-4 h-4" />,
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

