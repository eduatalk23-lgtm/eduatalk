"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const WEEKDAY_COUNT = 7;
const VALID_CONTENT_TYPES = ["book", "lecture", "custom"] as const;

type ContentType = (typeof VALID_CONTENT_TYPES)[number];

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type BlockRow = {
  id: string;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  block_index?: number | null;
};

type BlockOption = {
  id: string;
  dayOfWeek: number;
  blockIndex: number;
  startTime: string | null;
  endTime: string | null;
};

type PlanRow = {
  id: string;
  plan_date?: string | null;
  block_index?: number | null;
  content_type?: string | null;
  content_id?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
};

type PlanWithIndex = PlanRow & { normalizedBlockIndex: number };

type ContentRow = {
  id: string;
  title?: string | null;
  subject?: string | null;
  content_type?: string | null;
};

export type DailyScheduleRow = {
  block_id: string;
  block_index: number;
  start_time: string | null;
  end_time: string | null;
  content_type: ContentType;
  content_id: string;
  title: string;
  planned_start: number | null;
  planned_end: number | null;
};

type DailyScheduleInsertPayload = {
  student_id: string;
  tenant_id: string;
  schedule_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  planned_start: string | null; // time 타입 (HH:MM:SS 형식)
  planned_end: string | null; // time 타입 (HH:MM:SS 형식)
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
};

export async function generateDailySchedule(dateInput: string): Promise<void> {
  const normalizedDate = String(dateInput ?? "").trim();
  if (!normalizedDate) {
    throw new Error("생성할 날짜를 선택해주세요.");
  }

  const parsedDate = new Date(`${normalizedDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("올바른 날짜 형식을 입력해주세요.");
  }

  const scheduleDate = parsedDate.toISOString().slice(0, 10);

  const dayOfWeek = parsedDate.getUTCDay();
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek >= WEEKDAY_COUNT) {
    throw new Error("유효한 요일 정보를 확인할 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  try {
    const [
      blocks,
      plans,
      bookMap,
      lectureMap,
      customMap,
    ] = await Promise.all([
      fetchBlocksForDay(supabase, user.id, dayOfWeek),
      fetchPlansForDay(supabase, user.id, dayOfWeek),
      fetchContentMap(supabase, "books", user.id),
      fetchContentMap(supabase, "lectures", user.id),
      fetchContentMap(supabase, "student_custom_contents", user.id),
    ]);

    if (blocks.length === 0) {
      throw new Error("해당 요일에 사용할 블록이 없습니다. 먼저 시간 블록을 등록해주세요.");
    }

    if (plans.length === 0) {
      throw new Error("해당 요일에 연결된 플랜이 없습니다.");
    }

    const scheduleRows = buildDailyScheduleRows(blocks, plans, {
      book: bookMap,
      lecture: lectureMap,
      custom: customMap,
    });

    if (scheduleRows.length === 0) {
      throw new Error("매칭 가능한 블록과 플랜을 찾지 못했습니다.");
    }

    await replaceDailySchedule(supabase, user.id, scheduleDate, scheduleRows);
    await ensureContentProgress(supabase, user.id, scheduleRows);

    // schedule 페이지가 삭제되어 redirect 제거
    revalidatePath("/today");
  } catch (error) {
    console.error("[schedule/generate] 생성 실패", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("스케줄 생성 중 오류가 발생했습니다.");
  }
}

async function fetchBlocksForDay(
  supabase: SupabaseServerClient,
  studentId: string,
  dayOfWeek: number
): Promise<BlockOption[]> {
  try {
    const { data, error } = await supabase
      .from("student_block_schedule")
      .select("id,day_of_week,start_time,end_time")
      .eq("student_id", studentId)
      .eq("day_of_week", dayOfWeek)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;

    return normalizeBlocks(((data as BlockRow[] | null) ?? []).filter((row) => {
      const day = Number.isInteger(row.day_of_week) ? Number(row.day_of_week) : -1;
      return day === dayOfWeek;
    }));
  } catch (error) {
    console.error("[schedule] 블록 조회 실패", error);
    return [];
  }
}

async function fetchPlansForDay(
  supabase: SupabaseServerClient,
  studentId: string,
  dayOfWeek: number
): Promise<PlanWithIndex[]> {
  try {
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select(
          "id,plan_date,block_index,content_type,content_id,planned_start_page_or_time,planned_end_page_or_time"
        )
        .order("plan_date", { ascending: true })
        .order("block_index", { ascending: true });

    let { data, error } = await selectPlans().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectPlans());
    }
    if (error) throw error;

    const rows = (data as PlanRow[] | null) ?? [];
    const filtered = rows.filter((row) => {
      if (!row.plan_date) return false;
      const planDate = new Date(`${row.plan_date}T00:00:00Z`);
      if (Number.isNaN(planDate.getTime())) return false;
      return planDate.getUTCDay() === dayOfWeek;
    });

    return normalizePlans(filtered);
  } catch (error) {
    console.error("[schedule] 플랜 조회 실패", error);
    return [];
  }
}

async function fetchContentMap(
  supabase: SupabaseServerClient,
  table: "books" | "lectures" | "student_custom_contents",
  studentId: string
): Promise<Record<string, ContentRow>> {
  try {
    const selectContents = () =>
      supabase
        .from(table)
        .select("id,title,subject,content_type,created_at")
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
    console.error(`[schedule] ${table} 조회 실패`, error);
    return {};
  }
}

function normalizeBlocks(rows: BlockRow[]): BlockOption[] {
  const counters = new Map<number, number>();

  return rows.map((row) => {
    const day = Number.isInteger(row.day_of_week) ? Number(row.day_of_week) : 0;
    const previousIndex = counters.get(day) ?? 0;
    const fallbackIndex = previousIndex + 1;
    const finalIndex =
      typeof row.block_index === "number" && row.block_index > 0
        ? row.block_index
        : fallbackIndex;
    counters.set(day, finalIndex);

    return {
      id: row.id ? String(row.id) : `${day}-${finalIndex}`,
      dayOfWeek: day,
      blockIndex: finalIndex,
      startTime: row.start_time ?? null,
      endTime: row.end_time ?? null,
    };
  });
}

function normalizePlans(rows: PlanRow[]): PlanWithIndex[] {
  let fallbackCounter = 0;
  return rows
    .map((row) => {
      const normalizedBlockIndex =
        typeof row.block_index === "number" && row.block_index > 0
          ? row.block_index
          : ++fallbackCounter;
      return { ...row, normalizedBlockIndex };
    })
    .sort((a, b) => a.normalizedBlockIndex - b.normalizedBlockIndex);
}

function buildDailyScheduleRows(
  blocks: BlockOption[],
  plans: PlanWithIndex[],
  maps: {
    book: Record<string, ContentRow>;
    lecture: Record<string, ContentRow>;
    custom: Record<string, ContentRow>;
  }
): DailyScheduleRow[] {
  const planMap = new Map<number, PlanWithIndex>();

  plans.forEach((plan) => {
    if (plan.normalizedBlockIndex > 0 && !planMap.has(plan.normalizedBlockIndex)) {
      planMap.set(plan.normalizedBlockIndex, plan);
    }
  });

  return blocks
    .map((block) => {
      const plan = planMap.get(block.blockIndex);
      if (!plan || !plan.content_id) {
        return null;
      }

      const type = toContentType(plan.content_type);
      const contentMeta = resolveContentMeta(plan.content_id, type, maps);

      return {
        block_id: block.id,
        block_index: block.blockIndex,
        start_time: block.startTime,
        end_time: block.endTime,
        content_type: type,
        content_id: plan.content_id,
        title: contentMeta.title,
        planned_start: plan.planned_start_page_or_time ?? null,
        planned_end: plan.planned_end_page_or_time ?? null,
      };
    })
    .filter((row): row is DailyScheduleRow => Boolean(row));
}

function toContentType(raw?: string | null): ContentType {
  if (raw === "lecture" || raw === "custom") {
    return raw;
  }
  return "book";
}

function resolveContentMeta(
  contentId: string,
  contentType: ContentType,
  maps: {
    book: Record<string, ContentRow>;
    lecture: Record<string, ContentRow>;
    custom: Record<string, ContentRow>;
  }
) {
  const map = maps[contentType] ?? {};
  const row = map[contentId];

  if (!row) {
    return {
      title:
        contentType === "custom"
          ? "커스텀 콘텐츠"
          : contentType === "lecture"
          ? "강의 콘텐츠"
          : "책 콘텐츠",
    };
  }

  const fallbackTitle =
    contentType === "custom"
      ? "커스텀 콘텐츠"
      : contentType === "lecture"
      ? "강의 콘텐츠"
      : "책 콘텐츠";

  return {
    title: row.title ?? fallbackTitle,
  };
}

async function replaceDailySchedule(
  supabase: SupabaseServerClient,
  studentId: string,
  scheduleDate: string,
  rows: DailyScheduleRow[]
): Promise<void> {
  // student의 tenant_id 조회
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .single();

  if (!student || !student.tenant_id) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  const deleteQuery = () =>
    supabase
      .from("student_daily_schedule")
      .delete()
      .eq("schedule_date", scheduleDate);

  let { error: deleteError } = await deleteQuery().eq("student_id", studentId);
  if (deleteError && deleteError.code === "42703") {
    ({ error: deleteError } = await deleteQuery());
    if (deleteError && deleteError.code === "42703") {
      throw new Error("스케줄 테이블 없음");
    }
  }
  if (deleteError && deleteError.code !== "PGRST116") {
    throw new Error(deleteError.message);
  }

  const payloads: DailyScheduleInsertPayload[] = rows.map((row) => ({
    student_id: studentId,
    tenant_id: student.tenant_id,
    schedule_date: scheduleDate,
    block_index: row.block_index,
    content_type: row.content_type,
    content_id: row.content_id,
    planned_start: row.start_time, // block의 시작 시간
    planned_end: row.end_time, // block의 종료 시간
    planned_start_page_or_time: row.planned_start ?? null, // 페이지/시간
    planned_end_page_or_time: row.planned_end ?? null, // 페이지/시간
  }));

  if (payloads.length === 0) return;

  let { error: insertError } = await supabase
    .from("student_daily_schedule")
    .insert(payloads);

  if (insertError && insertError.code === "42703") {
    const fallbackPayloads = payloads.map(({ student_id, tenant_id, ...rest }) => rest);
    ({ error: insertError } = await supabase
      .from("student_daily_schedule")
      .insert(fallbackPayloads));
    if (insertError && insertError.code === "42703") {
      throw new Error("스케줄 테이블 없음");
    }
  }

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function ensureContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  rows: DailyScheduleRow[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  try {
    const uniqueContentIds = Array.from(
      new Set(rows.map((row) => row.content_id))
    );
    if (uniqueContentIds.length === 0) return;

    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("id,content_id,content_type,student_id")
        .in("content_id", uniqueContentIds);

    let { data, error } = await selectProgress().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress());
    }
    if (error) throw error;

    const existing = new Set<string>();
    ((data as { content_id: string; content_type?: string | null }[] | null) ??
      []
    ).forEach((row) => {
      const type = toContentType(row.content_type);
      existing.add(`${type}:${row.content_id}`);
    });

    const targets = rows.filter((row) => {
      const key = `${row.content_type}:${row.content_id}`;
      return !existing.has(key);
    });

    if (targets.length === 0) {
      return;
    }

    // student의 tenant_id 조회
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student || !student.tenant_id) {
      console.error("[schedule] 학생 정보를 찾을 수 없습니다.");
      return;
    }

    for (const target of targets) {
      const payload = {
        student_id: studentId,
        tenant_id: student.tenant_id,
        content_type: target.content_type,
        content_id: target.content_id,
      };

      let { error: insertError } = await supabase
        .from("student_content_progress")
        .insert(payload);

      if (insertError && insertError.code === "42703") {
        const { student_id: _studentId, tenant_id: _tenantId, ...fallbackPayload } = payload;
        void _studentId;
        void _tenantId;
        ({ error: insertError } = await supabase
          .from("student_content_progress")
          .insert(fallbackPayload));
      }

      if (insertError && insertError.code === "23505") {
        continue;
      }

      if (insertError) {
        throw insertError;
      }
    }
  } catch (error) {
    console.error("[schedule] 콘텐츠 진척도 초기화 실패", error);
  }
}


