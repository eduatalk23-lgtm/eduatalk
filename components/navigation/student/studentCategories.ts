import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  BookOpen,
  Users,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

export type StudentCategory = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const studentCategories: StudentCategory[] = [
  {
    label: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "오늘 학습",
    href: "/today",
    icon: Clock,
  },
  {
    label: "학습 계획",
    href: "/plan",
    icon: CalendarCheck,
  },
  {
    label: "학습 콘텐츠",
    href: "/contents",
    icon: BookOpen,
  },
  {
    label: "캠프 참여",
    href: "/camp",
    icon: Users,
  },
  {
    label: "출석 체크",
    href: "/attendance/check-in",
    icon: CheckCircle,
  },
];
