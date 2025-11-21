import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type Plan = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  chapter?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  completed_amount?: number | null;
  progress?: number | null;
  is_reschedulable: boolean;
  plan_group_id?: string | null;
  start_time?: string | null; // HH:mm 형식 - 플랜 생성 시 계산된 시작 시간
  end_time?: string | null; // HH:mm 형식 - 플랜 생성 시 계산된 종료 시간
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  total_duration_seconds?: number | null;
  paused_duration_seconds?: number | null;
  pause_count?: number | null;
  // 플랜 메타데이터 필드
  plan_number?: number | null;
  sequence?: number | null; // 플랜 그룹 내에서 같은 콘텐츠의 회차 번호
  day_type?: string | null;
  week?: number | null;
  day?: number | null;
  is_partial?: boolean | null;
  is_continued?: boolean | null;
  // Denormalized 필드 (조회 성능 향상)
  content_title?: string | null;
  content_subject?: string | null;
  content_subject_category?: string | null;
  content_category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PlanFilters = {
  studentId: string;
  tenantId?: string | null;
  dateRange?: {
    start: string;
    end: string;
  };
  planDate?: string;
  contentType?: "book" | "lecture" | "custom";
  planGroupIds?: string[]; // 플랜 그룹 ID 목록으로 필터링
};

/**
 * 학생의 플랜 목록 조회
 */
export async function getPlansForStudent(
  filters: PlanFilters
): Promise<Plan[]> {
  const supabase = await createSupabaseServerClient();

  const selectPlans = () =>
    supabase
      .from("student_plan")
      .select(
        "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,created_at,updated_at"
      )
      .eq("student_id", filters.studentId);

  let query = selectPlans();

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  if (filters.planDate) {
    // planDate를 문자열로 변환 (YYYY-MM-DD 형식)
    const planDateStr =
      typeof filters.planDate === "string"
        ? filters.planDate.slice(0, 10)
        : filters.planDate instanceof Date
        ? filters.planDate.toISOString().slice(0, 10)
        : String(filters.planDate).slice(0, 10);
    query = query.eq("plan_date", planDateStr);
  } else if (filters.dateRange) {
    // dateRange의 start와 end를 문자열로 변환 (YYYY-MM-DD 형식)
    const startStr =
      typeof filters.dateRange.start === "string"
        ? filters.dateRange.start.slice(0, 10)
        : filters.dateRange.start instanceof Date
        ? filters.dateRange.start.toISOString().slice(0, 10)
        : String(filters.dateRange.start).slice(0, 10);

    const endStr =
      typeof filters.dateRange.end === "string"
        ? filters.dateRange.end.slice(0, 10)
        : filters.dateRange.end instanceof Date
        ? filters.dateRange.end.toISOString().slice(0, 10)
        : String(filters.dateRange.end).slice(0, 10);

    query = query.gte("plan_date", startStr).lte("plan_date", endStr);
  }

  if (filters.contentType) {
    query = query.eq("content_type", filters.contentType);
  }

  if (filters.planGroupIds && filters.planGroupIds.length > 0) {
    // plan_group_id가 NULL이 아닌 값만 필터링
    // .in() 메서드는 배열의 값들 중 하나와 일치하는 행을 반환
    try {
      // planGroupIds가 유효한 UUID 배열인지 확인
      const validGroupIds = filters.planGroupIds.filter(
        (id) => id && typeof id === "string" && id.trim().length > 0
      );
      
      if (validGroupIds.length > 0) {
        query = query.in("plan_group_id", validGroupIds);
      } else {
        console.warn("[data/studentPlans] 유효한 planGroupIds가 없습니다:", filters.planGroupIds);
        return []; // 유효한 ID가 없으면 빈 배열 반환
      }
    } catch (filterError) {
      console.error("[data/studentPlans] planGroupIds 필터링 중 오류:", filterError);
      // 필터링 실패 시 전체 조회로 폴백
    }
  }

  query = query.order("plan_date", { ascending: true }).order("block_index", { ascending: true });

  let { data, error } = await query;

  if (error && error.code === "42703") {
    // fallback: tenant_id 컬럼이 없는 경우
    let fallbackQuery = supabase
      .from("student_plan")
      .select("*")
      .eq("student_id", filters.studentId);

    if (filters.tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", filters.tenantId);
    }

    if (filters.planDate) {
      // planDate를 문자열로 변환 (YYYY-MM-DD 형식)
      const planDateStr =
        typeof filters.planDate === "string"
          ? filters.planDate.slice(0, 10)
          : filters.planDate instanceof Date
          ? filters.planDate.toISOString().slice(0, 10)
          : String(filters.planDate).slice(0, 10);
      fallbackQuery = fallbackQuery.eq("plan_date", planDateStr);
    } else if (filters.dateRange) {
      // dateRange의 start와 end를 문자열로 변환 (YYYY-MM-DD 형식)
      const startStr =
        typeof filters.dateRange.start === "string"
          ? filters.dateRange.start.slice(0, 10)
          : filters.dateRange.start instanceof Date
          ? filters.dateRange.start.toISOString().slice(0, 10)
          : String(filters.dateRange.start).slice(0, 10);

      const endStr =
        typeof filters.dateRange.end === "string"
          ? filters.dateRange.end.slice(0, 10)
          : filters.dateRange.end instanceof Date
          ? filters.dateRange.end.toISOString().slice(0, 10)
          : String(filters.dateRange.end).slice(0, 10);

      fallbackQuery = fallbackQuery
        .gte("plan_date", startStr)
        .lte("plan_date", endStr);
    }

    if (filters.contentType) {
      fallbackQuery = fallbackQuery.eq("content_type", filters.contentType);
    }

    if (filters.planGroupIds && filters.planGroupIds.length > 0) {
      // fallback 쿼리에서도 유효한 ID만 사용
      const validGroupIds = filters.planGroupIds.filter(
        (id) => id && typeof id === "string" && id.trim().length > 0
      );
      if (validGroupIds.length > 0) {
        fallbackQuery = fallbackQuery.in("plan_group_id", validGroupIds);
      }
    }

    ({ data, error } = await fallbackQuery
      .order("plan_date", { ascending: true })
      .order("block_index", { ascending: true }));
  }

  if (error) {
    // 에러 정보를 더 자세히 로깅
    console.error("[data/studentPlans] 플랜 조회 실패");
    
    // 에러 객체 직접 출력 (여러 방식으로 시도)
    if (error instanceof Error) {
      console.error("에러 인스턴스:", error);
      console.error("에러 메시지:", error.message);
      console.error("에러 스택:", error.stack);
    } else {
      console.error("에러 객체:", error);
      console.error("에러 타입:", typeof error);
      
      // 에러 객체의 모든 속성 출력
      if (typeof error === "object" && error !== null) {
        console.error("에러 속성:", Object.keys(error));
        for (const key in error) {
          try {
            console.error(`  ${key}:`, (error as any)[key]);
          } catch (e) {
            console.error(`  ${key}: [접근 불가]`);
          }
        }
      }
    }
    
    // Supabase 에러 형식 확인
    const supabaseError = error as any;
    console.error("에러 코드:", supabaseError?.code);
    console.error("에러 메시지:", supabaseError?.message);
    console.error("에러 상세:", supabaseError?.details);
    console.error("에러 힌트:", supabaseError?.hint);
    
    console.error("필터 조건:", {
      studentId: filters.studentId,
      dateRange: filters.dateRange,
      planGroupIds: filters.planGroupIds,
      planGroupIdsLength: filters.planGroupIds?.length,
      planGroupIdsType: typeof filters.planGroupIds,
      planDate: filters.planDate,
      contentType: filters.contentType,
    });
    
    // 에러 객체를 문자열로 변환 시도
    try {
      const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      console.error("에러 JSON:", errorStr);
    } catch (e) {
      console.error("에러 JSON 변환 실패:", e);
    }
    
    // planGroupIds 필터링이 문제일 수 있으므로, 애플리케이션 레벨에서 폴백 시도
    if (filters.planGroupIds && filters.planGroupIds.length > 0) {
      console.warn("[data/studentPlans] planGroupIds 필터링 실패, 전체 조회로 폴백");
      
      // planGroupIds 없이 다시 시도 (날짜 형식도 명시적으로 변환)
      const fallbackFilters: PlanFilters = {
        studentId: filters.studentId,
        tenantId: filters.tenantId,
        planDate: filters.planDate
          ? typeof filters.planDate === "string"
            ? filters.planDate.slice(0, 10)
            : filters.planDate instanceof Date
            ? filters.planDate.toISOString().slice(0, 10)
            : String(filters.planDate).slice(0, 10)
          : undefined,
        dateRange: filters.dateRange
          ? {
              start:
                typeof filters.dateRange.start === "string"
                  ? filters.dateRange.start.slice(0, 10)
                  : filters.dateRange.start instanceof Date
                  ? filters.dateRange.start.toISOString().slice(0, 10)
                  : String(filters.dateRange.start).slice(0, 10),
              end:
                typeof filters.dateRange.end === "string"
                  ? filters.dateRange.end.slice(0, 10)
                  : filters.dateRange.end instanceof Date
                  ? filters.dateRange.end.toISOString().slice(0, 10)
                  : String(filters.dateRange.end).slice(0, 10),
            }
          : undefined,
        contentType: filters.contentType,
        // planGroupIds는 제외
      };
      
      try {
        const fallbackData = await getPlansForStudent(fallbackFilters);
        // 애플리케이션 레벨에서 필터링
        const activeGroupIdsSet = new Set(filters.planGroupIds);
        const filtered = fallbackData.filter(
          (plan) => plan.plan_group_id && activeGroupIdsSet.has(plan.plan_group_id)
        );
        return filtered;
      } catch (fallbackError) {
        console.error("[data/studentPlans] 폴백 조회도 실패:", fallbackError);
      }
    }
    
    return [];
  }

  return (data as Plan[] | null) ?? [];
}

/**
 * 플랜 ID로 플랜 조회
 */
export async function getPlanById(
  planId: string,
  studentId: string,
  tenantId?: string | null
): Promise<Plan | null> {
  const supabase = await createSupabaseServerClient();

  const selectPlan = () =>
    supabase
      .from("student_plan")
      .select(
        "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,created_at,updated_at"
      )
      .eq("id", planId)
      .eq("student_id", studentId);

  let query = selectPlan();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<Plan>();

  if (error && error.code === "42703") {
    ({ data, error } = await selectPlan().maybeSingle<Plan>());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentPlans] 플랜 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 생성
 */
export async function createPlan(
  plan: {
    tenant_id: string | null;
    student_id: string;
    plan_date: string;
    block_index: number;
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    chapter?: string | null;
    planned_start_page_or_time?: number | null;
    planned_end_page_or_time?: number | null;
    is_reschedulable: boolean;
  }
): Promise<{ success: boolean; planId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: plan.tenant_id,
    student_id: plan.student_id,
    plan_date: plan.plan_date,
    block_index: plan.block_index,
    content_type: plan.content_type,
    content_id: plan.content_id,
    chapter: plan.chapter || null,
    planned_start_page_or_time: plan.planned_start_page_or_time || null,
    planned_end_page_or_time: plan.planned_end_page_or_time || null,
    is_reschedulable: plan.is_reschedulable,
  };

  let { data, error } = await supabase
    .from("student_plan")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("student_plan")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentPlans] 플랜 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, planId: data?.id };
}

/**
 * 플랜 업데이트
 */
export async function updatePlan(
  planId: string,
  studentId: string,
  updates: {
    plan_date?: string;
    block_index?: number;
    content_type?: "book" | "lecture" | "custom";
    content_id?: string;
    chapter?: string | null;
    planned_start_page_or_time?: number | null;
    planned_end_page_or_time?: number | null;
    completed_amount?: number | null;
    progress?: number | null;
    is_reschedulable?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.plan_date !== undefined) payload.plan_date = updates.plan_date;
  if (updates.block_index !== undefined) payload.block_index = updates.block_index;
  if (updates.content_type !== undefined) payload.content_type = updates.content_type;
  if (updates.content_id !== undefined) payload.content_id = updates.content_id;
  if (updates.chapter !== undefined) payload.chapter = updates.chapter;
  if (updates.planned_start_page_or_time !== undefined)
    payload.planned_start_page_or_time = updates.planned_start_page_or_time;
  if (updates.planned_end_page_or_time !== undefined)
    payload.planned_end_page_or_time = updates.planned_end_page_or_time;
  if (updates.completed_amount !== undefined) payload.completed_amount = updates.completed_amount;
  if (updates.progress !== undefined) payload.progress = updates.progress;
  if (updates.is_reschedulable !== undefined) payload.is_reschedulable = updates.is_reschedulable;

  let { error } = await supabase
    .from("student_plan")
    .update(payload)
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_plan")
      .update(payload)
      .eq("id", planId));
  }

  if (error) {
    console.error("[data/studentPlans] 플랜 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 삭제
 */
export async function deletePlan(
  planId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_plan")
    .delete()
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase.from("student_plan").delete().eq("id", planId));
  }

  if (error) {
    console.error("[data/studentPlans] 플랜 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 여러 플랜 일괄 삭제
 */
export async function deletePlans(
  planIds: string[],
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (planIds.length === 0) {
    return { success: true };
  }

  // Supabase는 한 번에 최대 100개까지 삭제 가능
  const batchSize = 100;
  for (let i = 0; i < planIds.length; i += batchSize) {
    const batch = planIds.slice(i, i + batchSize);

    let { error } = await supabase
      .from("student_plan")
      .delete()
      .in("id", batch)
      .eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ error } = await supabase.from("student_plan").delete().in("id", batch));
    }

    if (error) {
      console.error("[data/studentPlans] 플랜 일괄 삭제 실패", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

