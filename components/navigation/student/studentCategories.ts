import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  BookOpen,
  LineChart,
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
    label: "학습 분석",
    href: "/analysis",
    icon: LineChart,
  },
];

