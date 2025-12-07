import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ContentType = "book" | "lecture" | "custom";

// 오늘 날짜 기반 플랜 조회
export type TodayPlan = {
  id: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  title: string;
  subject: string | null;
  difficulty_level: string | null;
  start_time: string | null;
  end_time: string | null;
  progress: number | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  total_duration_seconds: number | null;
  paused_duration_seconds: number | null;
  pause_count: number | null;
};

// 활성 학습 중인 플랜 정보
export type ActivePlan = {
  id: string;
  title: string;
  contentType: ContentType;
  actualStartTime: string;
  pausedDurationSeconds: number;
  pauseCount: number;
  isPaused: boolean;
};

type PlanRow = {
  id: string;
  block_index?: number | null;
  content_type?: string | null;
  content_id?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
};

type ContentRow = {
  id: string;
  title?: string | null;
  subject?: string | null;
  difficulty_level?: string | null;
};

type BlockRow = {
  id: string;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  block_index?: number | null;
};

type ProgressRow = {
  id: string;
  content_type?: string | null;
  content_id?: string | null;
  progress?: number | null;
};

export async function fetchTodayPlans(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string,
  dayOfWeek: number
): Promise<TodayPlan[]> {
  try {
    // 1. 오늘 날짜의 플랜 조회 (timing 정보 포함하여 N+1 제거)
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select(
          "id,block_index,content_type,content_id,planned_start_page_or_time,planned_end_page_or_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count"
        )
        .eq("plan_date", todayDate)
        .order("block_index", { ascending: true });

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }
    if (error) throw error;

    const planRows = (plans as PlanRow[] | null) ?? [];
    if (planRows.length === 0) {
      return [];
    }

    // 2. 블록 정보 조회
    const blocks = await fetchBlocksForDay(supabase, studentId, dayOfWeek);
    const blockMap = new Map<number, BlockRow>();
    blocks.forEach((block) => {
      const blockIndex =
        typeof block.block_index === "number" && block.block_index > 0
          ? block.block_index
          : null;
      if (blockIndex) {
        blockMap.set(blockIndex, block);
      }
    });

    // 3. 콘텐츠 정보 조회
    const [bookMap, lectureMap, customMap] = await Promise.all([
      fetchContentMap(supabase, studentId, "books"),
      fetchContentMap(supabase, studentId, "lectures"),
      fetchContentMap(supabase, studentId, "student_custom_contents"),
    ]);

    // 4. 진행률 조회
    const progressMap = await fetchProgressMap(supabase, studentId);

    // 5. 플랜과 콘텐츠 매핑
    const todayPlans: TodayPlan[] = [];

    for (const plan of planRows) {
      const contentType = toContentType(plan.content_type);
      const contentId = plan.content_id;
      const blockIndex =
        typeof plan.block_index === "number" && plan.block_index > 0
          ? plan.block_index
          : null;

      if (!contentId || !blockIndex) {
        continue;
      }

      const block = blockMap.get(blockIndex);
      const contentMeta = resolveContentMeta(
        contentId,
        contentType,
        bookMap,
        lectureMap,
        customMap
      );

      const progressKey = `${contentType}:${contentId}`;
      const progress = progressMap[progressKey] ?? null;

      // N+1 제거: timing 정보는 이미 조회한 plan 객체에서 가져옴
      // 컬럼이 없는 경우 (42703 에러) null 값으로 처리
      const planWithTiming = plan as PlanRow & {
        actual_start_time?: string | null;
        actual_end_time?: string | null;
        total_duration_seconds?: number | null;
        paused_duration_seconds?: number | null;
        pause_count?: number | null;
      };

      todayPlans.push({
        id: plan.id,
        block_index: blockIndex,
        content_type: contentType,
        content_id: contentId,
        title: contentMeta.title,
        subject: contentMeta.subject,
        difficulty_level: contentMeta.difficulty_level,
        start_time: block?.start_time ?? null,
        end_time: block?.end_time ?? null,
        progress,
        planned_start_page_or_time: plan.planned_start_page_or_time ?? null,
        planned_end_page_or_time: plan.planned_end_page_or_time ?? null,
        actual_start_time: planWithTiming?.actual_start_time ?? null,
        actual_end_time: planWithTiming?.actual_end_time ?? null,
        total_duration_seconds: planWithTiming?.total_duration_seconds ?? null,
        paused_duration_seconds: planWithTiming?.paused_duration_seconds ?? null,
        pause_count: planWithTiming?.pause_count ?? null,
      });
    }

    return todayPlans.sort((a, b) => a.block_index - b.block_index);
  } catch (error) {
    console.error("[dashboard] 오늘 플랜 조회 실패", error);
    return [];
  }
}

async function fetchBlocksForDay(
  supabase: SupabaseServerClient,
  studentId: string,
  dayOfWeek: number
): Promise<BlockRow[]> {
  try {
    // 활성 블록 세트 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("active_block_set_id")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError && studentError.code !== "PGRST116") {
      console.warn("[dashboard] 학생 정보 조회 실패:", studentError);
    }

    const activeBlockSetId = student?.active_block_set_id;

    // 활성 블록 세트가 없으면 빈 배열 반환
    if (!activeBlockSetId) {
      return [];
    }

    // 블록 조회 (block_index 컬럼이 있을 수도 있고 없을 수도 있음)
    const selectBlocks = () => {
      const query = supabase
        .from("student_block_schedule")
        .select("id,day_of_week,start_time,end_time,block_index")
        .eq("day_of_week", dayOfWeek)
        .eq("block_set_id", activeBlockSetId)
        .eq("student_id", studentId);

      // block_index 컬럼이 있으면 정렬, 없으면 start_time으로 정렬
      return query.order("block_index", { ascending: true });
    };

    let { data, error } = await selectBlocks();
    
    // block_index 컬럼이 없는 경우 (42703 에러)
    if (error && error.code === "42703") {
      // block_index 없이 조회하고 start_time으로 정렬
      const fallbackQuery = supabase
        .from("student_block_schedule")
        .select("id,day_of_week,start_time,end_time")
        .eq("day_of_week", dayOfWeek)
        .eq("block_set_id", activeBlockSetId)
        .eq("student_id", studentId)
        .order("start_time", { ascending: true });

      const fallbackResult = await fallbackQuery;
      // block_index가 없는 경우 null로 채움
      data = fallbackResult.data?.map(block => ({ ...block, block_index: null })) ?? null;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("[dashboard] 블록 조회 실패:", {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        studentId,
        dayOfWeek,
        activeBlockSetId,
      });
      throw error;
    }

    const blocks = (data as BlockRow[] | null) ?? [];
    
    // block_index가 없는 경우 동적으로 계산
    if (blocks.length > 0 && (blocks[0].block_index === null || blocks[0].block_index === undefined)) {
      return blocks.map((block, index) => ({
        ...block,
        block_index: index + 1,
      }));
    }

    return blocks;
  } catch (error) {
    console.error("[dashboard] 블록 조회 실패:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      studentId,
      dayOfWeek,
    });
    return [];
  }
}

export async function fetchContentMap(
  supabase: SupabaseServerClient,
  studentId: string,
  table: "books" | "lectures" | "student_custom_contents"
): Promise<Record<string, ContentRow>> {
  try {
    const selectContents = () =>
      supabase
        .from(table)
        .select("id,title,subject,difficulty_level")
        .order("created_at", { ascending: false });

    let { data, error } = await selectContents().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectContents());
    }
    if (error) throw error;

    const rows = (data as ContentRow[] | null) ?? [];
    return rows.reduce<Record<string, ContentRow>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  } catch (error) {
    console.error(`[dashboard] ${table} 조회 실패`, error);
    return {};
  }
}

async function fetchProgressMap(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Record<string, number | null>> {
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
    return rows.reduce<Record<string, number | null>>((acc, row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        acc[key] = row.progress ?? null;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error("[dashboard] 진행률 조회 실패", error);
    return {};
  }
}

function resolveContentMeta(
  contentId: string,
  contentType: ContentType,
  bookMap: Record<string, ContentRow>,
  lectureMap: Record<string, ContentRow>,
  customMap: Record<string, ContentRow>
): {
  title: string;
  subject: string | null;
  difficulty_level: string | null;
} {
  const map =
    contentType === "book"
      ? bookMap
      : contentType === "lecture"
      ? lectureMap
      : customMap;

  const row = map[contentId];

  if (!row) {
    return {
      title:
        contentType === "custom"
          ? "커스텀 콘텐츠"
          : contentType === "lecture"
          ? "강의 콘텐츠"
          : "책 콘텐츠",
      subject: null,
      difficulty_level: null,
    };
  }

  return {
    title: row.title ?? "제목 없음",
    subject: row.subject ?? null,
    difficulty_level: row.difficulty_level ?? null,
  };
}

function toContentType(raw?: string | null): ContentType {
  if (raw === "lecture" || raw === "custom") {
    return raw;
  }
  return "book";
}

// 오늘 학습 진행률 계산
export function calculateTodayProgress(plans: TodayPlan[]): number {
  if (plans.length === 0) {
    return 0;
  }

  const totalProgress = plans.reduce((sum, plan) => {
    return sum + (plan.progress ?? 0);
  }, 0);

  return Math.round(totalProgress / plans.length);
}

// 전체 학습 통계
export type LearningStatistics = {
  weekProgress: number; // 이번 주 진행률 (평균)
  completedCount: number; // 완료된 콘텐츠 수 (progress = 100)
  inProgressCount: number; // 진행 중 콘텐츠 수 (0 < progress < 100)
  totalLearningAmount: number; // 누적 학습량
};

export async function fetchLearningStatistics(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<LearningStatistics> {
  try {
    // 이번 주 날짜 범위 계산 (월~일)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.toISOString().slice(0, 10);
    const weekEnd = sunday.toISOString().slice(0, 10);

    // 이번 주 플랜 조회
    const selectWeekPlans = () =>
      supabase
        .from("student_plan")
        .select("id,content_type,content_id")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd);

    let { data: weekPlans, error } = await selectWeekPlans().eq(
      "student_id",
      studentId
    );
    if (error && error.code === "42703") {
      ({ data: weekPlans, error } = await selectWeekPlans());
    }
    if (error) throw error;

    const planRows = (weekPlans as PlanRow[] | null) ?? [];

    // 모든 진행률 조회
    const progressMap = await fetchProgressMap(supabase, studentId);

    // 이번 주 진행률 계산
    let weekProgressSum = 0;
    let weekProgressCount = 0;

    planRows.forEach((plan) => {
      if (plan.content_type && plan.content_id) {
        const key = `${plan.content_type}:${plan.content_id}`;
        const progress = progressMap[key];
        if (progress !== null && progress !== undefined) {
          weekProgressSum += progress;
          weekProgressCount++;
        }
      }
    });

    const weekProgress =
      weekProgressCount > 0
        ? Math.round(weekProgressSum / weekProgressCount)
        : 0;

    // 완료/진행 중 콘텐츠 수 계산
    const progressValues = Object.values(progressMap);
    let completedCount = 0;
    let inProgressCount = 0;

    progressValues.forEach((progress) => {
      if (progress === 100) {
        completedCount++;
      } else if (progress !== null && progress > 0 && progress < 100) {
        inProgressCount++;
      }
    });

    // 누적 학습량 계산
    const totalLearningAmount = await calculateTotalLearningAmount(
      supabase,
      studentId,
      progressMap
    );

    return {
      weekProgress,
      completedCount,
      inProgressCount,
      totalLearningAmount,
    };
  } catch (error) {
    console.error("[dashboard] 통계 조회 실패", error);
    return {
      weekProgress: 0,
      completedCount: 0,
      inProgressCount: 0,
      totalLearningAmount: 0,
    };
  }
}

async function calculateTotalLearningAmount(
  supabase: SupabaseServerClient,
  studentId: string,
  progressMap: Record<string, number | null>
): Promise<number> {
  try {
    // 모든 진행률 레코드에서 completed_amount 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,completed_amount");

    let { data, error } = await selectProgress().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress());
    }
    if (error) throw error;

    const progressRows = (data as Array<{
      content_type?: string | null;
      content_id?: string | null;
      completed_amount?: number | null;
    }> | null) ?? [];

    // completed_amount 합계 계산 (누적 학습량)
    let totalAmount = 0;

    for (const row of progressRows) {
      const completedAmount = row.completed_amount ?? 0;
      totalAmount += completedAmount;
    }

    return totalAmount;
  } catch (error) {
    console.error("[dashboard] 누적 학습량 계산 실패", error);
    return 0;
  }
}

async function fetchContentTotal(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string
): Promise<number | null> {
  try {
    if (contentType === "book") {
      const selectBook = () =>
        supabase
          .from("books")
          .select("id,total_pages")
          .eq("id", contentId);

      let { data, error } = await selectBook().eq("student_id", studentId).maybeSingle<{ id: string; total_pages?: number | null }>();
      if (error && error.code === "42703") {
        ({ data, error } = await selectBook().maybeSingle<{ id: string; total_pages?: number | null }>());
      }
      if (error) throw error;

      return data?.total_pages ?? null;
    }

    if (contentType === "lecture") {
      const selectLecture = () =>
        supabase
          .from("lectures")
          .select("id,duration")
          .eq("id", contentId);

      let { data, error } = await selectLecture().eq("student_id", studentId).maybeSingle<{ id: string; duration?: number | null }>();
      if (error && error.code === "42703") {
        ({ data, error } = await selectLecture().maybeSingle<{ id: string; duration?: number | null }>());
      }
      if (error) throw error;

      return data?.duration ?? null;
    }

    if (contentType === "custom") {
      const selectCustom = () =>
        supabase
          .from("student_custom_contents")
          .select("id,total_page_or_time")
          .eq("id", contentId);

      let { data, error } = await selectCustom().eq("student_id", studentId).maybeSingle<{ id: string; total_page_or_time?: number | null }>();
      if (error && error.code === "42703") {
        ({ data, error } = await selectCustom().maybeSingle<{ id: string; total_page_or_time?: number | null }>());
      }
      if (error) throw error;

      return data?.total_page_or_time ?? null;
    }

    return null;
  } catch (error) {
    console.error("[dashboard] 콘텐츠 총량 조회 실패", error);
    return null;
  }
}

// 이번 주 요일별 계획 블록 카운트
export type WeeklyBlockCount = {
  dayOfWeek: number;
  dayLabel: string;
  blockCount: number;
};

export async function fetchWeeklyBlockCounts(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<WeeklyBlockCount[]> {
  try {
    // 이번 주 날짜 범위 계산 (월~일)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.toISOString().slice(0, 10);
    const weekEnd = sunday.toISOString().slice(0, 10);

    // 이번 주 플랜 조회
    const selectWeekPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,block_index")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd);

    let { data: weekPlans, error } = await selectWeekPlans().eq(
      "student_id",
      studentId
    );
    if (error && error.code === "42703") {
      ({ data: weekPlans, error } = await selectWeekPlans());
    }
    if (error) throw error;

    const planRows = (weekPlans as Array<{
      id: string;
      plan_date?: string | null;
      block_index?: number | null;
    }> | null) ?? [];

    // 요일별 블록 카운트 계산
    const dayCounts = new Map<number, Set<number>>();

    planRows.forEach((plan) => {
      if (!plan.plan_date) return;
      const planDate = new Date(`${plan.plan_date}T00:00:00Z`);
      if (Number.isNaN(planDate.getTime())) return;

      const planDayOfWeek = planDate.getUTCDay();
      const blockIndex =
        typeof plan.block_index === "number" && plan.block_index > 0
          ? plan.block_index
          : null;

      if (blockIndex !== null) {
        if (!dayCounts.has(planDayOfWeek)) {
          dayCounts.set(planDayOfWeek, new Set());
        }
        dayCounts.get(planDayOfWeek)!.add(blockIndex);
      }
    });

    const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
    const result: WeeklyBlockCount[] = [];

    for (let i = 0; i < 7; i++) {
      const blockSet = dayCounts.get(i) ?? new Set();
      result.push({
        dayOfWeek: i,
        dayLabel: weekdayLabels[i],
        blockCount: blockSet.size,
      });
    }

    return result;
  } catch (error) {
    console.error("[dashboard] 이번 주 블록 카운트 조회 실패", error);
    const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
    return weekdayLabels.map((label, index) => ({
      dayOfWeek: index,
      dayLabel: label,
      blockCount: 0,
    }));
  }
}

// 콘텐츠별 누적 진행률
export type ContentTypeProgress = {
  book: number;
  lecture: number;
  custom: number;
};

export async function fetchContentTypeProgress(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<ContentTypeProgress> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,progress");

    let { data, error } = await selectProgress().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress());
    }
    if (error) throw error;

    const rows = (data as Array<{
      content_type?: string | null;
      progress?: number | null;
    }> | null) ?? [];

    let bookSum = 0;
    let bookCount = 0;
    let lectureSum = 0;
    let lectureCount = 0;
    let customSum = 0;
    let customCount = 0;

    rows.forEach((row) => {
      const progress = row.progress ?? null;
      if (progress === null) return;

      if (row.content_type === "book") {
        bookSum += progress;
        bookCount++;
      } else if (row.content_type === "lecture") {
        lectureSum += progress;
        lectureCount++;
      } else if (row.content_type === "custom") {
        customSum += progress;
        customCount++;
      }
    });

    return {
      book: bookCount > 0 ? Math.round(bookSum / bookCount) : 0,
      lecture: lectureCount > 0 ? Math.round(lectureSum / lectureCount) : 0,
      custom: customCount > 0 ? Math.round(customSum / customCount) : 0,
    };
  } catch (error) {
    console.error("[dashboard] 콘텐츠별 진행률 조회 실패", error);
    return {
      book: 0,
      lecture: 0,
      custom: 0,
    };
  }
}

/**
 * 활성 학습 중인 플랜 조회 (오늘 날짜, 시작했지만 아직 완료하지 않은 플랜)
 */
export async function fetchActivePlan(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string,
  contentMaps?: {
    bookMap: Record<string, ContentRow>;
    lectureMap: Record<string, ContentRow>;
    customMap: Record<string, ContentRow>;
  }
): Promise<ActivePlan | null> {
  try {
    // 오늘 날짜의 플랜 중 시작했지만 완료하지 않은 플랜 조회
    const selectQuery = supabase
      .from("student_plan")
      .select(
        "id,actual_start_time,actual_end_time,paused_duration_seconds,pause_count,content_type,content_id"
      )
      .eq("student_id", studentId)
      .eq("plan_date", todayDate);

    // actual_start_time 컬럼이 있는지 확인하여 조건부로 필터링
    let { data: activePlans, error } = await selectQuery
      .not("actual_start_time", "is", null)
      .is("actual_end_time", null)
      .order("actual_start_time", { ascending: false })
      .limit(1);

    // 컬럼이 없는 경우 (42703 에러) 빈 결과 반환
    if (error && error.code === "42703") {
      console.warn("[dashboard] actual_start_time 컬럼이 없습니다. 마이그레이션을 실행해주세요.");
      return null;
    }

    if (error) throw error;
    if (!activePlans || activePlans.length === 0) {
      return null;
    }

    const plan = activePlans[0];
    if (!plan.content_type || !plan.content_id || !plan.actual_start_time) {
      return null;
    }

    // 활성 세션 조회하여 일시정지 상태 확인
    const { data: activeSession } = await supabase
      .from("student_study_sessions")
      .select("paused_at,resumed_at")
      .eq("plan_id", plan.id)
      .eq("student_id", studentId)
      .is("ended_at", null)
      .maybeSingle();

    const isPaused = activeSession?.paused_at && !activeSession?.resumed_at;

    // 콘텐츠 정보 조회 (재사용 또는 새로 조회)
    const contentType = toContentType(plan.content_type);
    let bookMap: Record<string, ContentRow>;
    let lectureMap: Record<string, ContentRow>;
    let customMap: Record<string, ContentRow>;

    if (contentMaps) {
      // 전달받은 콘텐츠 맵 재사용
      ({ bookMap, lectureMap, customMap } = contentMaps);
    } else {
      // fallback: 없으면 새로 조회
      [bookMap, lectureMap, customMap] = await Promise.all([
        fetchContentMap(supabase, "books", studentId),
        fetchContentMap(supabase, "lectures", studentId),
        fetchContentMap(supabase, "student_custom_contents", studentId),
      ]);
    }

    const contentMeta = resolveContentMeta(
      plan.content_id,
      contentType,
      bookMap,
      lectureMap,
      customMap
    );

    return {
      id: plan.id,
      title: contentMeta.title,
      contentType,
      actualStartTime: plan.actual_start_time,
      pausedDurationSeconds: plan.paused_duration_seconds || 0,
      pauseCount: plan.pause_count || 0,
      isPaused: !!isPaused,
    };
  } catch (error) {
    console.error("[dashboard] 활성 플랜 조회 실패", error);
    return null;
  }
}

