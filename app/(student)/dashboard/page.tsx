
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// TODO: 비활성화된 섹션 재활성화 시 import 복원
// import { fetchTodayProgress } from "./_utils";
// import { SmartInsightsCard } from "./_components/SmartInsightsCard";
// import { LearningStatsCard } from "./_components/LearningStatsCard";
// TODO: AI 기능 정상화 후 재활성화
// import { MLPredictionCard } from "./_components/MLPredictionCard";
// import { AIRecommendationCard } from "./_components/AIRecommendationCard";
import { perfTime } from "@/lib/utils/perfLog";
import { getDashboardCategories } from "@/lib/navigation/dashboardUtils";
import { getContainerClass } from "@/lib/constants/layout";
import { bgSurfaceVar, textPrimaryVar, textSecondaryVar, borderDefaultVar, getGradientCardClasses, type GradientColor } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

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

  // TODO: 비활성화된 진행률 재활성화 시 복원
  // const today = new Date();
  // today.setHours(0, 0, 0, 0);
  // const todayDate = today.toISOString().slice(0, 10);

  // TODO: 비활성화된 진행률 재활성화 시 복원
  // const dataTimer = perfTime("[dashboard] data - minimal");
  // const todayProgress = await fetchTodayProgress(supabase, user.id, todayDate);
  // dataTimer.end();

  const studentName = student?.name ?? "학생";

  const renderTimer = perfTime("[dashboard] render - DashboardContent");
  const page = (
    <>
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6 md:gap-8">
          {/* 상단: 학생 인사 + 요약 */}
          <div className={cn("rounded-2xl border p-6 md:p-8 shadow-[var(--elevation-4)]", bgSurfaceVar, borderDefaultVar)}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h1 className={cn("text-h1", textPrimaryVar)}>
                  안녕하세요, {studentName}님
                </h1>
                  <p className={cn("text-sm md:text-base", textSecondaryVar)}>
                  오늘도 열심히 학습하시는 모습이 멋집니다!
                  </p>
                </div>

                {/* TODO: 오늘 학습 진행률 - 비활성화
                <div className="flex items-baseline gap-3 pt-2">
                  <span className={cn("text-4xl md:text-5xl font-bold", getIndigoTextClasses("heading"))}>
                    {todayProgress}%
                  </span>
                  <span className={cn("text-base md:text-lg", textSecondaryVar)}>
                    오늘 학습 진행률
                  </span>
                </div>
                */}
              </div>
            </div>
          </div>

          {/* TODO: 스마트 인사이트 & 학습 통계 - 비활성화
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <SmartInsightsCard />
            <LearningStatsCard />
          </div>
          */}

          {/* TODO: AI 기능 정상화 후 재활성화
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <MLPredictionCard studentId={user.id} />
            <AIRecommendationCard studentId={user.id} />
          </div>
          */}

          {/* 주요 기능 바로가기 */}
          <div className="flex flex-col gap-4 md:gap-6">
            <h2 className={cn("text-h2", textPrimaryVar)}>주요 기능</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {getDashboardCategories().map((category) => {
                let description = "";
                let color: "indigo" | "blue" | "purple" | "orange" | "green" | "red" | "teal" | "cyan" | "amber" | "pink" | "violet" | "emerald" | "sky" = "indigo";
                let iconEmoji = "🔗";

                // 카테고리별 설명 및 색상 설정
                switch (category.href) {
                  case "/today":
                    description = "오늘의 학습 계획을 확인하고 실행하세요";
                    color = "indigo";
                    iconEmoji = "📅";
                    break;
                  case "/plan":
                    description = "학습 계획을 조회하고 관리하세요";
                    color = "blue";
                    iconEmoji = "📋";
                    break;
                  case "/contents":
                    description = "책, 강의, 커스텀 콘텐츠를 등록하고 관리하세요";
                    color = "green";
                    iconEmoji = "📚";
                    break;
                  case "/camp":
                    description = "캠프에 참여하고 학습을 관리하세요";
                    color = "purple";
                    iconEmoji = "🏕️";
                    break;
                  case "/attendance/check-in":
                    description = "출석을 체크하고 기록을 확인하세요";
                    color = "cyan";
                    iconEmoji = "✅";
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
                    icon={iconEmoji}
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
  color: GradientColor;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "h-full rounded-xl border-2 p-5 md:p-6 transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-4)] flex flex-col",
        getGradientCardClasses(color)
      )}
    >
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3 md:gap-4">
          <span className="text-2xl md:text-3xl flex-shrink-0">{icon}</span>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* 텍스트 색상은 getGradientCardClasses에서 이미 포함됨 (예: text-indigo-900 dark:text-indigo-200) */}
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
