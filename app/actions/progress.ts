"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordHistory } from "@/lib/history/record";
import { fetchContentTotal, type ContentType } from "@/lib/data/contentTotal";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type PlanRow = {
  id: string;
  content_type?: string | null;
  content_id?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
};

type ContentProgressRow = {
  id: string;
  content_type?: string | null;
  content_id?: string | null;
  completed_amount?: number | null;
  progress?: number | null;
};


export async function updateProgress(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const planIdInput = String(formData.get("plan_id") ?? "").trim();
  const completedAmountInput = formData.get("completed_amount");

  if (!planIdInput) {
    throw new Error("플랜 ID가 필요합니다.");
  }

  const completedAmount =
    completedAmountInput !== null
      ? Number(completedAmountInput)
      : null;

  if (completedAmount !== null && !Number.isFinite(completedAmount)) {
    throw new Error("올바른 완료량을 입력해주세요.");
  }

  try {
    // 1. student_plan 조회
    const plan = await fetchPlan(supabase, user.id, planIdInput);
    if (!plan || !plan.content_type || !plan.content_id) {
      throw new Error("플랜을 찾을 수 없습니다.");
    }

    const contentType = toContentType(plan.content_type);
    const contentId = plan.content_id;

    // 2. 콘텐츠별 총량 조회
    const totalAmount = await fetchContentTotal(
      supabase,
      user.id,
      contentType,
      contentId
    );

    if (totalAmount === null || totalAmount <= 0) {
      throw new Error("콘텐츠 총량을 확인할 수 없습니다.");
    }

    // 3. 기존 progress 레코드 조회
    const existingProgress = await fetchContentProgress(
      supabase,
      user.id,
      contentType,
      contentId
    );

    // 4. 완료량 계산
    const currentCompleted =
      existingProgress?.completed_amount ?? 0;
    const newCompletedAmount =
      completedAmount !== null
        ? currentCompleted + completedAmount
        : currentCompleted;

    // 5. 진행률 계산
    const progress = Math.min(
      Math.round((newCompletedAmount / totalAmount) * 100),
      100
    );

    // 6. insert 또는 update
    if (existingProgress) {
      await updateContentProgress(
        supabase,
        user.id,
        existingProgress.id,
        newCompletedAmount,
        progress
      );
    } else {
      await insertContentProgress(
        supabase,
        user.id,
        contentType,
        contentId,
        newCompletedAmount,
        progress
      );
    }

    // 히스토리 기록
    await recordHistory(supabase, user.id, "content_progress", {
      content_type: contentType,
      content_id: contentId,
      completed_amount: newCompletedAmount,
      progress,
      plan_id: planIdInput,
    });

    // 7. 오늘 페이지로 redirect
    revalidatePath("/today");
    redirect("/today");
  } catch (error) {
    console.error("[progress] 진행률 업데이트 실패", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("진행률 업데이트 중 오류가 발생했습니다.");
  }
}

async function fetchPlan(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<PlanRow | null> {
  try {
    const selectPlan = () =>
      supabase
        .from("student_plan")
        .select(
          "id,content_type,content_id,planned_start_page_or_time,planned_end_page_or_time"
        )
        .eq("id", planId);

    let { data, error } = await selectPlan().eq("student_id", studentId).maybeSingle<PlanRow>();
    if (error && error.code === "42703") {
      ({ data, error } = await selectPlan().maybeSingle<PlanRow>());
    }
    if (error) throw error;

    return data;
  } catch (error) {
    console.error("[progress] 플랜 조회 실패", error);
    return null;
  }
}


async function fetchContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string
): Promise<ContentProgressRow | null> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("id,content_type,content_id,completed_amount,progress")
        .eq("content_type", contentType)
        .eq("content_id", contentId);

    let { data, error } = await selectProgress().eq("student_id", studentId).maybeSingle<ContentProgressRow>();
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress().maybeSingle<ContentProgressRow>());
    }
    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("[progress] 진행률 조회 실패", error);
    return null;
  }
}

async function insertContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string,
  completedAmount: number,
  progress: number
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

  const payload = {
    student_id: studentId,
    tenant_id: student.tenant_id,
    content_type: contentType,
    content_id: contentId,
    completed_amount: completedAmount,
    progress: progress,
    last_updated: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("student_content_progress")
    .insert(payload);

  if (error && error.code === "42703") {
    const { student_id: _studentId, tenant_id: _tenantId, ...fallbackPayload } = payload;
    void _studentId;
    void _tenantId;
    ({ error } = await supabase
      .from("student_content_progress")
      .insert(fallbackPayload));
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function updateContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  progressId: string,
  completedAmount: number,
  progress: number
): Promise<void> {
  const payload = {
    completed_amount: completedAmount,
    progress: progress,
    last_updated: new Date().toISOString(),
  };

  const updateQuery = () =>
    supabase
      .from("student_content_progress")
      .update(payload)
      .eq("id", progressId);

  let { error } = await updateQuery().eq("student_id", studentId);
  if (error && error.code === "42703") {
    ({ error } = await updateQuery());
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePlanProgress(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const planIdInput = String(formData.get("plan_id") ?? "").trim();
  const progressInput = formData.get("progress");
  const startInput = formData.get("start_page_or_time");
  const endInput = formData.get("end_page_or_time");

  if (!planIdInput) {
    throw new Error("플랜 ID가 필요합니다.");
  }

  try {
    // 1. student_plan 조회
    const plan = await fetchPlanForProgress(supabase, user.id, planIdInput);
    if (!plan || !plan.content_type || !plan.content_id) {
      throw new Error("플랜을 찾을 수 없습니다.");
    }

    const contentType = toContentType(plan.content_type);
    const contentId = plan.content_id;

    // 2. 콘텐츠별 총량 조회
    const totalAmount = await fetchContentTotal(
      supabase,
      user.id,
      contentType,
      contentId
    );

    if (totalAmount === null || totalAmount <= 0) {
      throw new Error("콘텐츠 총량을 확인할 수 없습니다.");
    }

    // 3. 진행률 계산
    let progress: number;
    let startPageOrTime: number | null = null;
    let endPageOrTime: number | null = null;

    if (progressInput !== null && progressInput !== "") {
      // 진행률 직접 입력
      progress = Number(progressInput);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        throw new Error("진행률은 0-100 사이의 값이어야 합니다.");
      }
    } else if (startInput !== null && endInput !== null) {
      // 시작/종료로 계산
      const start = Number(startInput);
      const end = Number(endInput);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("올바른 시작/종료 값을 입력해주세요.");
      }

      if (start < 0 || end < start) {
        throw new Error("시작 값은 0 이상이어야 하며, 종료 값은 시작 값보다 커야 합니다.");
      }

      if (end > totalAmount) {
        throw new Error(`종료 값은 총량(${totalAmount})을 초과할 수 없습니다.`);
      }

      startPageOrTime = start;
      endPageOrTime = end;

      // 진행률 계산: ((end - start) / totalAmount) * 100
      const completedAmount = end - start;
      progress = Math.min(
        Math.round((completedAmount / totalAmount) * 100),
        100
      );
    } else {
      throw new Error("진행률 또는 시작/종료 값을 입력해주세요.");
    }

    // 4. 기존 progress 레코드 조회
    const existingProgress = await fetchPlanProgress(
      supabase,
      user.id,
      planIdInput
    );

    // 5. upsert
    if (existingProgress) {
      await updatePlanProgressRecord(
        supabase,
        user.id,
        existingProgress.id,
        progress,
        startPageOrTime,
        endPageOrTime
      );
    } else {
      await insertPlanProgress(
        supabase,
        user.id,
        planIdInput,
        progress,
        startPageOrTime,
        endPageOrTime
      );
    }

    // 6. revalidate
    revalidatePath("/plan");
  } catch (error) {
    console.error("[progress] 플랜 진행률 업데이트 실패", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("진행률 업데이트 중 오류가 발생했습니다.");
  }
}

async function fetchPlanForProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<PlanRow | null> {
  try {
    const selectPlan = () =>
      supabase
        .from("student_plan")
        .select(
          "id,content_type,content_id,planned_start_page_or_time,planned_end_page_or_time"
        )
        .eq("id", planId);

    let { data, error } = await selectPlan().eq("student_id", studentId).maybeSingle<PlanRow>();
    if (error && error.code === "42703") {
      ({ data, error } = await selectPlan().maybeSingle<PlanRow>());
    }
    if (error) throw error;

    return data;
  } catch (error) {
    console.error("[progress] 플랜 조회 실패", error);
    return null;
  }
}

type PlanProgressRow = {
  id: string;
  plan_id?: string | null;
  progress?: number | null;
  start_page_or_time?: number | null;
  end_page_or_time?: number | null;
};

async function fetchPlanProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<PlanProgressRow | null> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("id,plan_id,progress,start_page_or_time,end_page_or_time")
        .eq("plan_id", planId);

    let { data, error } = await selectProgress().eq("student_id", studentId).maybeSingle<PlanProgressRow>();
    if (error && error.code === "42703") {
      ({ data, error } = await selectProgress().maybeSingle<PlanProgressRow>());
    }
    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("[progress] 진행률 조회 실패", error);
    return null;
  }
}

async function insertPlanProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string,
  progress: number,
  startPageOrTime: number | null,
  endPageOrTime: number | null
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

  const payload = {
    student_id: studentId,
    tenant_id: student.tenant_id,
    plan_id: planId,
    progress: progress,
    start_page_or_time: startPageOrTime,
    end_page_or_time: endPageOrTime,
    last_updated: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("student_content_progress")
    .insert(payload);

  if (error && error.code === "42703") {
    const { student_id: _studentId, tenant_id: _tenantId, ...fallbackPayload } = payload;
    void _studentId;
    void _tenantId;
    ({ error } = await supabase
      .from("student_content_progress")
      .insert(fallbackPayload));
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function updatePlanProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  progressId: string,
  progress: number,
  startPageOrTime: number | null,
  endPageOrTime: number | null
): Promise<void> {
  const payload = {
    progress: progress,
    start_page_or_time: startPageOrTime,
    end_page_or_time: endPageOrTime,
    last_updated: new Date().toISOString(),
  };

  const updateQuery = () =>
    supabase
      .from("student_content_progress")
      .update(payload)
      .eq("id", progressId);

  let { error } = await updateQuery().eq("student_id", studentId);
  if (error && error.code === "42703") {
    ({ error } = await updateQuery());
  }

  if (error) {
    throw new Error(error.message);
  }
}

function toContentType(raw?: string | null): ContentType {
  if (raw === "lecture" || raw === "custom") {
    return raw;
  }
  return "book";
}

