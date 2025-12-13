export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTodayProgress,
  fetchActivePlanSimple,
  type ActivePlan,
} from "./_utils";
import { ActiveLearningWidget } from "./_components/ActiveLearningWidget";
import { perfTime } from "@/lib/utils/perfLog";
import { studentCategories } from "@/components/navigation/student/studentCategories";
import { getContainerClass } from "@/lib/constants/layout";

type StudentRow = {
  id: string;
  name?: string | null;
};

export default async function DashboardPage() {
  const pageTimer = perfTime("[dashboard] render - page");
  const supabase = await createSupabaseServerClient();

  // 현재 로그인 사용자 가져오기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 안되어 있으면 로그인 페이지로 이동
  if (!user) redirect("/login");

  // 학생 정보 불러오기
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,name")
    .eq("id", user.id)
    .maybeSingle<StudentRow>();

  if (studentError) {
    console.error("[dashboard] 학생 정보 조회 실패", studentError);
    // 에러가 발생해도 페이지는 표시되도록 함
  }

  // 오늘 날짜 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 최소 데이터만 조회
  const dataTimer = perfTime("[dashboard] data - minimal");
  const [todayProgress, activePlan] = await Promise.all([
    fetchTodayProgress(supabase, user.id, todayDate),
    fetchActivePlanSimple(supabase, user.id, todayDate),
  ]);
  dataTimer.end();

  const studentName = student?.name ?? "학생";

  const renderTimer = perfTime("[dashboard] render - DashboardContent");
  const page = (
    <>
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6 md:gap-8">
          {/* 상단: 학생 인사 + 요약 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h1 className="text-h1 text-gray-900">
                  안녕하세요, {studentName}님
                </h1>
                  <p className="text-sm md:text-base text-gray-600">
                  오늘도 열심히 학습하시는 모습이 멋집니다!
                </p>
                </div>

                <div className="flex items-baseline gap-3 pt-2">
                  <span className="text-4xl md:text-5xl font-bold text-indigo-600">
                    {todayProgress}%
                  </span>
                  <span className="text-base md:text-lg text-gray-600">
                    오늘 학습 진행률
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 실시간 학습 중 위젯 */}
          {activePlan && <ActiveLearningWidget activePlan={activePlan} />}

          {/* 주요 기능 바로가기 */}
          <div className="flex flex-col gap-4 md:gap-6">
            <h2 className="text-h2 text-gray-900">주요 기능</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {studentCategories
                .filter((category) => category.href !== "/dashboard")
                .map((category) => {
                  let description = "";
                  let color: "indigo" | "blue" | "purple" | "orange" | "green" | "red" | "teal" | "cyan" | "amber" | "pink" | "violet" | "emerald" | "sky" = "indigo";

                  // 카테고리별 설명 및 색상 설정
                  switch (category.href) {
                    case "/today":
                      description = "오늘의 학습 계획을 확인하고 실행하세요";
                      color = "indigo";
                      break;
                    case "/plan":
                      description = "학습 계획을 조회하고 관리하세요";
                      color = "blue";
                      break;
                    case "/contents":
                      description = "책, 강의, 커스텀 콘텐츠를 등록하고 관리하세요";
                      color = "green";
                      break;
                    case "/camp":
                      description = "캠프에 참여하고 학습을 관리하세요";
                      color = "purple";
                      break;
                    case "/attendance/check-in":
                      description = "출석을 체크하고 기록을 확인하세요";
                      color = "cyan";
                      break;
                    default:
                      description = "기능을 이용하세요";
                  }

                  return (
                    <QuickActionCard
                      key={category.href}
                      href={category.href}
                      title={category.label}
                      description={description}
                      icon={
                        category.href === "/today"
                          ? "📅"
                          : category.href === "/plan"
                          ? "📋"
                          : category.href === "/contents"
                          ? "📚"
                          : category.href === "/camp"
                          ? "🏕️"
                          : category.href === "/attendance/check-in"
                          ? "✅"
                          : "🔗"
                      }
                      color={color}
                    />
                  );
                })}
              <QuickActionCard
                href="/scores/dashboard/unified"
                title="성적 관리"
                description="내신 및 모의고사 성적을 조회하고 관리하세요"
                icon="📝"
                color="red"
              />
              <QuickActionCard
                href="/report/weekly"
                title="학습 리포트"
                description="주간 및 월간 학습 리포트를 확인하세요"
                icon="📊"
                color="teal"
              />
              <QuickActionCard
                href="/blocks"
                title="시간블록 설정"
                description="학습 가능한 시간대를 설정하세요"
                icon="⏰"
                color="amber"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
  renderTimer.end();
  pageTimer.end();
  return page;
}


function QuickActionCard({
  href,
  title,
  description,
  icon,
  color,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  color: "indigo" | "blue" | "purple" | "orange" | "green" | "red" | "teal" | "cyan" | "amber" | "pink" | "violet" | "emerald" | "sky";
}) {
  const colorClasses = {
    indigo:
      "border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50 hover:from-indigo-100 hover:to-indigo-200/50 text-indigo-900 hover:shadow-lg",
    blue: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 text-blue-900 hover:shadow-lg",
    purple:
      "border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/50 text-purple-900 hover:shadow-lg",
    orange:
      "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-200/50 text-orange-900 hover:shadow-lg",
    green: "border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-200/50 text-green-900 hover:shadow-lg",
    red: "border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 hover:from-red-100 hover:to-red-200/50 text-red-900 hover:shadow-lg",
    teal: "border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/50 hover:from-teal-100 hover:to-teal-200/50 text-teal-900 hover:shadow-lg",
    cyan: "border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100/50 hover:from-cyan-100 hover:to-cyan-200/50 text-cyan-900 hover:shadow-lg",
    amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-200/50 text-amber-900 hover:shadow-lg",
    pink: "border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/50 hover:from-pink-100 hover:to-pink-200/50 text-pink-900 hover:shadow-lg",
    violet: "border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/50 hover:from-violet-100 hover:to-violet-200/50 text-violet-900 hover:shadow-lg",
    emerald: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-200/50 text-emerald-900 hover:shadow-lg",
    sky: "border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/50 hover:from-sky-100 hover:to-sky-200/50 text-sky-900 hover:shadow-lg",
  };

  return (
    <Link
      href={href}
      className={`h-full rounded-xl border-2 p-5 md:p-6 transition-all duration-200 hover:scale-[1.02] flex flex-col ${colorClasses[color]}`}
    >
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3 md:gap-4">
          <span className="text-2xl md:text-3xl flex-shrink-0">{icon}</span>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-semibold">{title}</h3>
            <p className="text-xs md:text-sm opacity-80 line-clamp-2">{description}</p>
          </div>
        </div>
        {/* mt-auto는 flexbox 내부에서 하단 정렬을 위해 사용 (Spacing-First 정책 예외 허용) */}
        <div className="flex justify-end mt-auto">
          <span className="text-lg md:text-xl">→</span>
        </div>
      </div>
    </Link>
  );
}
