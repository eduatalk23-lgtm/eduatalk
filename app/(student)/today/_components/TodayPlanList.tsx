import { getPlansForStudent } from "@/lib/data/studentPlans";
import { getBooks, getLectures, getCustomContents } from "@/lib/data/studentContents";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { DraggablePlanList } from "./DraggablePlanList";
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

    const [plansResult, progressMapResult] = await Promise.allSettled([
      getPlansForStudent({
        studentId: user.userId,
        tenantId: tenantContext?.tenantId || null,
        planDate: todayDate,
      }),
      fetchProgressMap(user.userId),
    ]);

    const plans =
      plansResult.status === "fulfilled" ? plansResult.value : [];
    const progressMap =
      progressMapResult.status === "fulfilled"
        ? progressMapResult.value
        : {};

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

  const sessionMap = new Map<string, { isPaused: boolean }>();
  activeSessions?.forEach((session) => {
    if (session.plan_id) {
      const isPaused = !!session.paused_at && !session.resumed_at;
      sessionMap.set(session.plan_id, { isPaused });
    }
  });

  // 플랜 데이터를 DraggablePlanList에 전달할 형식으로 변환
  const plansWithContent = plans.map((plan) => {
    const contentKey = `${plan.content_type}:${plan.content_id}`;
    const content = contentMap.get(contentKey);
    const progress = progressMap[contentKey] ?? null;
    const session = sessionMap.get(plan.id);

    return {
      ...plan,
      content,
      progress,
      session: session ? { isPaused: session.isPaused } : undefined,
    };
  });

  return <DraggablePlanList plans={plansWithContent} planDate={todayDate} />;
  } catch (error) {
    console.error("[TodayPlanList] 컴포넌트 렌더링 실패", error);
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">⚠️</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            플랜을 불러오는 중 오류가 발생했습니다
          </h3>
          <p className="text-sm text-gray-500">
            잠시 후 다시 시도해주세요.
          </p>
        </div>
      </div>
    );
  }
}

