import { getPlansForStudent } from "@/lib/data/studentPlans";
import { getBooks, getLectures, getCustomContents } from "@/lib/data/studentContents";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { TodayPlanListView } from "./TodayPlanListView";
import { groupPlansByPlanNumber, PlanWithContent } from "../_utils/planGroupUtils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProgressRow = {
  content_type?: string | null;
  content_id?: string | null;
  progress?: number | null;
};

async function fetchProgressMap(
  studentId: string
): Promise<Record<string, number | null>> {
  const supabase = await createSupabaseServerClient();
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress");

    let { data, error } = await selectProgress().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress());
    }
    if (error) throw error;

    const rows = (data as ProgressRow[] | null) ?? [];
    const map: Record<string, number | null> = {};

    rows.forEach((row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        map[key] = row.progress ?? null;
      }
    });

    return map;
  } catch (error) {
    console.error("[today] 진행률 조회 실패", error);
    return {};
  }
}

/**
 * 날짜를 한국어 형식으로 포맷팅 (예: 2024년 1월 15일)
 */
function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 날짜 차이를 계산하여 상대적 표현 반환 (예: "내일", "3일 후")
 */
function getRelativeDateLabel(targetDateStr: string, todayDateStr: string): string {
  const target = new Date(targetDateStr + "T00:00:00");
  const today = new Date(todayDateStr + "T00:00:00");
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays === 2) return "모레";
  if (diffDays <= 7) return `${diffDays}일 후`;
  return formatDateKorean(targetDateStr);
}

export async function TodayPlanList() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return null;
    }

    const tenantContext = await getTenantContext();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    // 1. 오늘 플랜 조회
    const [todayPlansResult, progressMapResult] = await Promise.allSettled([
      getPlansForStudent({
        studentId: user.userId,
        tenantId: tenantContext?.tenantId || null,
        planDate: todayDate,
      }),
      fetchProgressMap(user.userId),
    ]);

    const todayPlans =
      todayPlansResult.status === "fulfilled" ? todayPlansResult.value : [];
    const progressMap =
      progressMapResult.status === "fulfilled"
        ? progressMapResult.value
        : {};

    let plans = todayPlans;
    let displayDate = todayDate;
    let isToday = true;

    // 2. 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기
    if (plans.length === 0) {
      // 먼저 30일 범위로 조회 (성능 최적화)
      const shortRangeEndDate = new Date(today);
      shortRangeEndDate.setDate(shortRangeEndDate.getDate() + 30);
      const shortRangeEndDateStr = shortRangeEndDate.toISOString().slice(0, 10);

      let futurePlansResult = await getPlansForStudent({
        studentId: user.userId,
        tenantId: tenantContext?.tenantId || null,
        dateRange: {
          start: todayDate,
          end: shortRangeEndDateStr,
        },
      });

      // 30일 범위에 플랜이 없으면 더 넓은 범위(180일)로 확장 조회
      if (futurePlansResult.length === 0) {
        const longRangeEndDate = new Date(today);
        longRangeEndDate.setDate(longRangeEndDate.getDate() + 180); // 180일 후까지 조회
        const longRangeEndDateStr = longRangeEndDate.toISOString().slice(0, 10);

        futurePlansResult = await getPlansForStudent({
          studentId: user.userId,
          tenantId: tenantContext?.tenantId || null,
          dateRange: {
            start: todayDate,
            end: longRangeEndDateStr,
          },
        });
      }

      if (futurePlansResult.length > 0) {
        // 가장 가까운 날짜 찾기 (plan_date 기준으로 정렬)
        const sortedPlans = futurePlansResult.sort((a, b) => {
          if (!a.plan_date || !b.plan_date) return 0;
          return a.plan_date.localeCompare(b.plan_date);
        });

        // 첫 번째 플랜의 날짜를 기준으로 해당 날짜의 모든 플랜 가져오기
        const nearestDate = sortedPlans[0].plan_date;
        if (nearestDate) {
          displayDate = nearestDate;
          isToday = false;
          plans = sortedPlans.filter((p) => p.plan_date === nearestDate);
        }
      }
    }

    // 3. 여전히 플랜이 없으면 빈 상태 표시
    if (plans.length === 0) {
      return (
        <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">📚</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              오늘 배울 내용이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              자동 스케줄러를 실행해보세요.
            </p>
          </div>
        </div>
      );
    }

  // 콘텐츠 정보 조회
  const bookIds = plans
    .filter((p) => p.content_type === "book" && p.content_id)
    .map((p) => p.content_id);
  const lectureIds = plans
    .filter((p) => p.content_type === "lecture" && p.content_id)
    .map((p) => p.content_id);
  const customIds = plans
    .filter((p) => p.content_type === "custom" && p.content_id)
    .map((p) => p.content_id);

  const [books, lectures, customContents] = await Promise.all([
    bookIds.length > 0
      ? getBooks(user.userId, tenantContext?.tenantId || null)
      : Promise.resolve([]),
    lectureIds.length > 0
      ? getLectures(user.userId, tenantContext?.tenantId || null)
      : Promise.resolve([]),
    customIds.length > 0
      ? getCustomContents(user.userId, tenantContext?.tenantId || null)
      : Promise.resolve([]),
  ]);

  const contentMap = new Map<string, any>();
  books.forEach((book) => contentMap.set(`book:${book.id}`, book));
  lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
  customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));

  // 활성 세션 조회 (일시정지 상태 확인용)
  const supabase = await createSupabaseServerClient();
  const { data: activeSessions } = await supabase
    .from("student_study_sessions")
    .select("plan_id,paused_at,resumed_at")
    .eq("student_id", user.userId)
    .is("ended_at", null);

  const sessionMap = new Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>();
  activeSessions?.forEach((session) => {
    if (session.plan_id) {
      const isPaused = !!session.paused_at && !session.resumed_at;
      sessionMap.set(session.plan_id, {
        isPaused,
        pausedAt: session.paused_at,
        resumedAt: session.resumed_at,
      });
    }
  });

  // 플랜 데이터를 PlanWithContent 형식으로 변환
  const plansWithContent: PlanWithContent[] = plans.map((plan) => {
    const contentKey = `${plan.content_type}:${plan.content_id}`;
    const content = contentMap.get(contentKey);
    const progress = progressMap[contentKey] ?? null;
    const session = sessionMap.get(plan.id);

    return {
      ...plan,
      content,
      progress,
      session: session ? { 
        isPaused: session.isPaused,
        pausedAt: session.pausedAt,
        resumedAt: session.resumedAt
      } : undefined,
    };
  });

  // 같은 plan_number를 가진 플랜들을 그룹화
  const groups = groupPlansByPlanNumber(plansWithContent);


  // 세션 맵 생성 (컴포넌트에 전달하기 위해 Map으로 변환)
  const sessionsMap = new Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>();
  sessionMap.forEach((value, key) => {
    sessionsMap.set(key, value);
  });

  // 메모 조회 (같은 plan_number를 가진 플랜들의 메모)
  // 같은 plan_number를 가진 플랜들은 같은 memo를 공유한다고 가정
  const memosMap = new Map<number | null, string | null>();
  const uniquePlanNumbers = new Set<number | null>(
    groups.map((g) => g.planNumber)
  );

  // 각 plan_number별로 플랜을 찾아서 memo 조회
  for (const planNumber of uniquePlanNumbers) {
    const plan = plans.find(
      (p) => (p.plan_number ?? null) === planNumber
    );
    if (plan) {
      // 플랜에서 memo 필드 조회
      const memo = plan.memo ?? null;
      memosMap.set(planNumber, memo);
    }
  }

  // plan_number가 null인 경우도 처리
  const nullPlanNumberPlans = plans.filter((p) => (p.plan_number ?? null) === null);
  if (nullPlanNumberPlans.length > 0) {
    const firstNullPlan = nullPlanNumberPlans[0];
    const memo = firstNullPlan.memo ?? null;
    memosMap.set(null, memo);
  }

  // 콘텐츠 총량 맵 생성
  const totalPagesMap = new Map<string, number>();
  books.forEach((book) => {
    const key = `book:${book.id}`;
    if (book.total_pages && book.total_pages > 0) {
      totalPagesMap.set(key, book.total_pages);
    }
  });
  lectures.forEach((lecture) => {
    const key = `lecture:${lecture.id}`;
    if (lecture.duration && lecture.duration > 0) {
      totalPagesMap.set(key, lecture.duration);
    }
  });
  customContents.forEach((custom) => {
    const key = `custom:${custom.id}`;
    if (custom.total_page_or_time && custom.total_page_or_time > 0) {
      totalPagesMap.set(key, custom.total_page_or_time);
    }
  });

  // 날짜 표시 레이블 생성
  const dateLabel = isToday 
    ? "오늘" 
    : getRelativeDateLabel(displayDate, todayDate);

  return (
    <div className="flex flex-col gap-4">
      {!isToday && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {dateLabel}의 플랜을 표시하고 있습니다
              </p>
              <p className="text-xs text-amber-700">
                {formatDateKorean(displayDate)} ({dateLabel})
              </p>
            </div>
          </div>
        </div>
      )}
      <TodayPlanListView
        groups={groups}
        sessions={sessionsMap}
        planDate={displayDate}
        memos={memosMap}
        totalPagesMap={totalPagesMap}
        initialMode="daily"
        initialSelectedPlanNumber={groups[0]?.planNumber ?? null}
      />
    </div>
  );
  } catch (error) {
    console.error("[TodayPlanList] 컴포넌트 렌더링 실패", error);
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">⚠️</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              플랜을 불러오는 중 오류가 발생했습니다
            </h3>
            <p className="text-sm text-gray-500">
              잠시 후 다시 시도해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }
}

