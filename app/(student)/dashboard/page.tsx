
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { perfTime } from "@/lib/utils/perfLog";
import { DailyCheckInCard } from "./_components/DailyCheckInCard";
import { getContainerClass } from "@/lib/constants/layout";
import { bgSurfaceVar, textPrimaryVar, textSecondaryVar, borderDefaultVar } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import {
  CalendarDays,
  ClipboardList,
  BookOpen,
  Tent,
  CheckCircle,
  BarChart3,
  FileText,
  Clock,
  type LucideIcon,
} from "lucide-react";

type StudentRow = {
  id: string;
  name?: string | null;
};

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: "/plan/calendar",
    title: "학습 관리",
    description: "오늘의 학습 계획을 확인하고 실행하세요",
    icon: CalendarDays,
  },
  {
    href: "/plan",
    title: "플랜 관리",
    description: "학습 계획을 조회하고 관리하세요",
    icon: ClipboardList,
  },
  {
    href: "/contents",
    title: "콘텐츠 관리",
    description: "책, 강의, 커스텀 콘텐츠를 관리하세요",
    icon: BookOpen,
  },
  {
    href: "/camp",
    title: "캠프 관리",
    description: "캠프에 참여하고 학습을 관리하세요",
    icon: Tent,
  },
  {
    href: "/attendance/check-in",
    title: "출석 관리",
    description: "출석을 체크하고 기록을 확인하세요",
    icon: CheckCircle,
  },
  {
    href: "/scores/dashboard/unified",
    title: "성적 관리",
    description: "내신 및 모의고사 성적을 관리하세요",
    icon: BarChart3,
  },
  {
    href: "/report/weekly",
    title: "학습 리포트",
    description: "주간 및 월간 학습 리포트를 확인하세요",
    icon: FileText,
  },
  {
    href: "/blocks",
    title: "시간블록 설정",
    description: "학습 가능한 시간대를 설정하세요",
    icon: Clock,
  },
];

function getFormattedDate(): string {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = days[now.getDay()];
  return `${month}월 ${date}일 ${day}요일`;
}

export default async function DashboardPage() {
  const pageTimer = perfTime("[dashboard] render - page");
  const supabase = await createSupabaseServerClient();

  const currentUser = await getCurrentUser();

  if (!currentUser) redirect("/login");

  const { data: student, error: studentError } = await supabase
    .from("user_profiles")
    .select("id,name")
    .eq("id", currentUser.userId)
    .maybeSingle<StudentRow>();

  if (studentError) {
    console.error("[dashboard] 학생 정보 조회 실패", studentError);
  }

  const studentName = student?.name ?? "학생";
  const formattedDate = getFormattedDate();

  const renderTimer = perfTime("[dashboard] render - DashboardContent");
  const page = (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6 md:gap-8">
        {/* 상단: 인사 + 날짜 + 출석 통합 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
            <h1 className={cn("text-xl md:text-2xl font-semibold", textPrimaryVar)}>
              안녕하세요, {studentName}님
            </h1>
            <span className={cn("text-sm", textSecondaryVar)}>
              {formattedDate}
            </span>
          </div>
          <DailyCheckInCard />
        </div>

        {/* 주요 기능 그리드 */}
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-base font-medium", textSecondaryVar)}>
            주요 기능
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard key={action.href} {...action} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
  renderTimer.end();
  pageTimer.end();
  return page;
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: QuickAction) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3.5 rounded-xl border p-4 md:p-5",
        "transition-colors duration-150",
        "hover:bg-secondary-50 dark:hover:bg-secondary-800/50",
        bgSurfaceVar,
        borderDefaultVar,
      )}
    >
      <div className="flex-shrink-0 rounded-lg bg-secondary-100 dark:bg-secondary-800 p-2.5">
        <Icon className={cn("h-5 w-5 text-secondary-500 dark:text-secondary-400")} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={cn(
          "text-sm font-semibold",
          textPrimaryVar,
        )}>
          {title}
        </span>
        <span className={cn(
          "text-xs leading-relaxed line-clamp-2",
          textSecondaryVar,
        )}>
          {description}
        </span>
      </div>
    </Link>
  );
}
