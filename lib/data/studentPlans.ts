import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 플랜 쿼리 필터 옵션 (공통)
 */
type PlanQueryOptions = {
  studentId: string;
  tenantId?: string | null;
  planDate?: string;
  dateRange?: { start: string; end: string };
  planGroupIds?: string[];
  contentType?: string;
};

/**
 * 공통 플랜 쿼리 빌더
 * getPlansForStudent와 getPlansFromView에서 공통으로 사용
 */
export function buildPlanQuery(
  supabase: SupabaseServerClient,
  tableName: "student_plan" | "today_plan_view",
  selectFields: string,
  options: PlanQueryOptions
) {
  let query = supabase
    .from(tableName)
    .select(selectFields)
    .eq("student_id", options.studentId);

  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  }

  if (options.planDate) {
    const planDateStr =
      typeof options.planDate === "string"
        ? options.planDate.slice(0, 10)
        : String(options.planDate).slice(0, 10);
    query = query.eq("plan_date", planDateStr);
  } else if (options.dateRange) {
    const startStr =
      typeof options.dateRange.start === "string"
        ? options.dateRange.start.slice(0, 10)
        : String(options.dateRange.start).slice(0, 10);
    const endStr =
      typeof options.dateRange.end === "string"
        ? options.dateRange.end.slice(0, 10)
        : String(options.dateRange.end).slice(0, 10);
    query = query.gte("plan_date", startStr).lte("plan_date", endStr);
  }

  if (options.contentType) {
    query = query.eq("content_type", options.contentType);
  }

  if (options.planGroupIds && options.planGroupIds.length > 0) {
    const validGroupIds = options.planGroupIds.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validGroupIds.length > 0) {
      query = query.in("plan_group_id", validGroupIds);
    }
  }

  return query
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });
}

// ============================================
// 플랜 업데이트 제한 정책 (Phase 2)
// ============================================

/**
 * student_plan에서 허용되는 업데이트 필드
 * - 실행 관련: 타이머, 진행률, 완료량
 * - 일정 조정: 날짜 변경 (미루기)
 * - 범위 조정: 페이지/시간 미세 조정
 * - 메타데이터: 메모
 */
export type AllowedPlanUpdates = {
  // 일정 조정
  plan_date?: string;
  block_index?: number; // 미루기 시 함께 변경 가능
  // 범위 미세 조정
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  // 실행 관련
  completed_amount?: number | null;
  progress?: number | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  total_duration_seconds?: number | null;
  paused_duration_seconds?: number | null;
  pause_count?: number | null;
  // 메타데이터
  memo?: string | null;
  is_reschedulable?: boolean;
  chapter?: string | null; // 챕터 정보 업데이트 허용
};

/**
 * student_plan에서 금지되는 업데이트 필드
 * 구조적 변경은 플랜그룹 레벨에서 처리해야 함
 */
export type ForbiddenPlanUpdateFields =
  | "content_type"
  | "content_id"
  | "plan_group_id"
  | "student_id"
  | "tenant_id"
  | "origin_plan_item_id"
  | "plan_number";

/**
 * 금지된 필드 목록
 */
const FORBIDDEN_UPDATE_FIELDS: ForbiddenPlanUpdateFields[] = [
  "content_type",
  "content_id",
  "plan_group_id",
  "student_id",
  "tenant_id",
  "origin_plan_item_id",
  "plan_number",
];

// ============================================
// 삭제 정책 (Phase 2 - P2-9)
// ============================================

/**
 * student_plan 삭제 정책
 *
 * 1. **개별 플랜 삭제 (deletePlan)**
 *    - 학생이 직접 삭제 가능
 *    - 관련 study_sessions는 plan_id가 NULL로 설정됨 (ON DELETE SET NULL)
 *
 * 2. **플랜 그룹 삭제 시 (plan_groups DELETE)**
 *    - DB: student_plan.plan_group_id는 ON DELETE SET NULL
 *    - 앱 레벨: deletePlanGroupByInvitationId에서 명시적으로 student_plan 먼저 삭제
 *
 * 3. **논리 플랜 삭제 시 (plan_group_items DELETE)**
 *    - DB: student_plan.origin_plan_item_id는 ON DELETE SET NULL
 *    - 연결만 끊기고 실행 데이터는 보존
 *
 * 4. **완료된 플랜 보호**
 *    - actual_end_time이 설정된 플랜은 삭제 전 확인 필요
 *    - 통계 데이터 보존을 위해 soft delete 권장 (향후 구현)
 *
 * @see docs/refactoring/03_phase_todo_list.md [P2-9]
 */
export const PLAN_DELETE_POLICY = {
  /** 완료된 플랜 삭제 허용 여부 (현재: 허용) */
  allowDeleteCompleted: true,
  /** 타이머 진행 중 플랜 삭제 허용 여부 (현재: 허용) */
  allowDeleteInProgress: true,
  /** soft delete 사용 여부 (현재: hard delete) */
  useSoftDelete: false,
} as const;

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
  memo?: string | null; // 플랜 메모 (같은 plan_number를 가진 플랜들은 공유)
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

  // planGroupIds 유효성 검사
  if (filters.planGroupIds && filters.planGroupIds.length > 0) {
    const validGroupIds = filters.planGroupIds.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validGroupIds.length === 0) {
      console.warn(
        "[data/studentPlans] 유효한 planGroupIds가 없습니다:",
        filters.planGroupIds
      );
      return [];
    }
  }

  // 공통 쿼리 빌더 사용
  const query = buildPlanQuery(
    supabase,
    "student_plan",
    "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at",
    {
      studentId: filters.studentId,
      tenantId: filters.tenantId,
      planDate: filters.planDate,
      dateRange: filters.dateRange,
      planGroupIds: filters.planGroupIds,
      contentType: filters.contentType,
    }
  );

  let { data, error } = await query;

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id 컬럼이 없는 경우
    // 필요한 컬럼만 선택하여 성능 최적화
    let fallbackQuery = supabase
      .from("student_plan")
      .select("id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at")
      .eq("student_id", filters.studentId);

    if (filters.tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", filters.tenantId);
    }

    if (filters.planDate) {
      // planDate를 문자열로 변환 (YYYY-MM-DD 형식)
      const planDateStr =
        typeof filters.planDate === "string"
          ? filters.planDate.slice(0, 10)
          : String(filters.planDate).slice(0, 10);
      fallbackQuery = fallbackQuery.eq("plan_date", planDateStr);
    } else if (filters.dateRange) {
      // dateRange의 start와 end를 문자열로 변환 (YYYY-MM-DD 형식)
      const startStr =
        typeof filters.dateRange.start === "string"
          ? filters.dateRange.start.slice(0, 10)
          : String(filters.dateRange.start).slice(0, 10);

      const endStr =
        typeof filters.dateRange.end === "string"
          ? filters.dateRange.end.slice(0, 10)
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
    const supabaseError = error as PostgrestError;
    const errorMessage = supabaseError?.message || String(error);

    // HTML 응답이 반환된 경우 (500 에러 등) 감지
    const isHtmlError =
      typeof errorMessage === "string" &&
      errorMessage.includes("<!DOCTYPE html>");
    const isServerError =
      isHtmlError ||
      supabaseError?.code === "500";

    // 서버 에러인 경우 재시도 로직
    if (isServerError) {
      console.warn("[data/studentPlans] 서버 에러 발생, 재시도 중...", {
        errorCode: supabaseError?.code,
        isHtmlError,
      });

      // 최대 2번 재시도 (총 3번 시도)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          // 재시도 전 대기 (지수 백오프: 1초, 2초)
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));

          // 간단한 쿼리로 재시도
          const retryQuery = supabase
            .from("student_plan")
            .select("*")
            .eq("student_id", filters.studentId)
            .limit(1000); // 제한을 두어 복잡한 쿼리 방지

          if (filters.tenantId) {
            retryQuery.eq("tenant_id", filters.tenantId);
          }

          if (filters.planDate) {
            const planDateStr =
              typeof filters.planDate === "string"
                ? filters.planDate.slice(0, 10)
                : String(filters.planDate).slice(0, 10);
            retryQuery.eq("plan_date", planDateStr);
          } else if (filters.dateRange) {
            const startStr =
              typeof filters.dateRange.start === "string"
                ? filters.dateRange.start.slice(0, 10)
                : String(filters.dateRange.start).slice(0, 10);
            const endStr =
              typeof filters.dateRange.end === "string"
                ? filters.dateRange.end.slice(0, 10)
                : String(filters.dateRange.end).slice(0, 10);
            retryQuery.gte("plan_date", startStr).lte("plan_date", endStr);
          }

          const { data: retryData, error: retryError } = await retryQuery
            .order("plan_date", { ascending: true })
            .order("block_index", { ascending: true });

          if (!retryError && retryData) {
            // 애플리케이션 레벨에서 추가 필터링
            let filtered = retryData as Plan[];

            if (filters.contentType) {
              filtered = filtered.filter(
                (plan) => plan.content_type === filters.contentType
              );
            }

            if (filters.planGroupIds && filters.planGroupIds.length > 0) {
              const activeGroupIdsSet = new Set(filters.planGroupIds);
              filtered = filtered.filter(
                (plan) =>
                  plan.plan_group_id &&
                  activeGroupIdsSet.has(plan.plan_group_id)
              );
            }

            return filtered;
          }
        } catch (retryError) {
          console.warn(
            `[data/studentPlans] 재시도 ${attempt}번째 실패:`,
            retryError
          );
        }
      }

      console.error("[data/studentPlans] 모든 재시도 실패, 빈 배열 반환");
      return [];
    }

    // 일반 에러 처리
    console.error("[data/studentPlans] 플랜 조회 실패", {
      errorCode: supabaseError?.code,
      errorMessage: isHtmlError
        ? "서버 에러 (HTML 응답)"
        : errorMessage.substring(0, 200),
      filters: {
        studentId: filters.studentId,
        dateRange: filters.dateRange,
        planDate: filters.planDate,
        contentType: filters.contentType,
        planGroupIdsCount: filters.planGroupIds?.length || 0,
      },
    });

    // planGroupIds 필터링이 문제일 수 있으므로, 애플리케이션 레벨에서 폴백 시도
    if (filters.planGroupIds && filters.planGroupIds.length > 0) {
      console.warn(
        "[data/studentPlans] planGroupIds 필터링 실패, 전체 조회로 폴백"
      );

      // planGroupIds 없이 다시 시도
      const fallbackFilters: PlanFilters = {
        studentId: filters.studentId,
        tenantId: filters.tenantId,
        planDate: filters.planDate
          ? typeof filters.planDate === "string"
            ? filters.planDate.slice(0, 10)
            : String(filters.planDate).slice(0, 10)
          : undefined,
        dateRange: filters.dateRange
          ? {
              start:
                typeof filters.dateRange.start === "string"
                  ? filters.dateRange.start.slice(0, 10)
                  : String(filters.dateRange.start).slice(0, 10),
              end:
                typeof filters.dateRange.end === "string"
                  ? filters.dateRange.end.slice(0, 10)
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
          (plan) =>
            plan.plan_group_id && activeGroupIdsSet.has(plan.plan_group_id)
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
        "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at"
      )
      .eq("id", planId)
      .eq("student_id", studentId);

  let query = selectPlan();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<Plan>();

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ data, error } = await selectPlan().maybeSingle<Plan>());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentPlans] 플랜 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 생성 입력 타입
 */
export type CreatePlanInput = {
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
  /** 논리 플랜 아이템 ID (plan_group_items 테이블 참조) */
  origin_plan_item_id?: string | null;
  /** 플랜 그룹 ID */
  plan_group_id?: string | null;
  /** 시작 시간 (HH:mm) */
  start_time?: string | null;
  /** 종료 시간 (HH:mm) */
  end_time?: string | null;
};

/**
 * 플랜 생성
 *
 * @param plan - 플랜 생성 정보
 * @returns 생성 결과
 *
 * @see docs/refactoring/plan_flow_documentation.md
 */
export async function createPlan(
  plan: CreatePlanInput
): Promise<{ success: boolean; planId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {
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

  // origin_plan_item_id가 있으면 추가 (논리 플랜 연결)
  if (plan.origin_plan_item_id) {
    payload.origin_plan_item_id = plan.origin_plan_item_id;
  }

  // plan_group_id가 있으면 추가
  if (plan.plan_group_id) {
    payload.plan_group_id = plan.plan_group_id;
  }

  // 시간 정보가 있으면 추가 (Time 모드)
  if (plan.start_time) {
    payload.start_time = plan.start_time;
  }
  if (plan.end_time) {
    payload.end_time = plan.end_time;
  }

  let { data, error } = await supabase
    .from("student_plan")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const {
      tenant_id: _tenantId,
      student_id: _studentId,
      ...fallbackPayload
    } = payload;
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
 * 플랜 업데이트 (안전 버전)
 * - 허용된 필드만 업데이트 가능
 * - 구조적 변경(content_type, content_id 등)은 금지
 * @see docs/refactoring/03_phase_todo_list.md [P2-8]
 */
export async function updatePlanSafe(
  planId: string,
  studentId: string,
  updates: AllowedPlanUpdates
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  if (updates.plan_date !== undefined) payload.plan_date = updates.plan_date;
  if (updates.block_index !== undefined)
    payload.block_index = updates.block_index;
  if (updates.planned_start_page_or_time !== undefined)
    payload.planned_start_page_or_time = updates.planned_start_page_or_time;
  if (updates.planned_end_page_or_time !== undefined)
    payload.planned_end_page_or_time = updates.planned_end_page_or_time;
  if (updates.completed_amount !== undefined)
    payload.completed_amount = updates.completed_amount;
  if (updates.progress !== undefined) payload.progress = updates.progress;
  if (updates.actual_start_time !== undefined)
    payload.actual_start_time = updates.actual_start_time;
  if (updates.actual_end_time !== undefined)
    payload.actual_end_time = updates.actual_end_time;
  if (updates.total_duration_seconds !== undefined)
    payload.total_duration_seconds = updates.total_duration_seconds;
  if (updates.paused_duration_seconds !== undefined)
    payload.paused_duration_seconds = updates.paused_duration_seconds;
  if (updates.pause_count !== undefined)
    payload.pause_count = updates.pause_count;
  if (updates.memo !== undefined) payload.memo = updates.memo;
  if (updates.is_reschedulable !== undefined)
    payload.is_reschedulable = updates.is_reschedulable;
  if (updates.chapter !== undefined) payload.chapter = updates.chapter;

  if (Object.keys(payload).length === 0) {
    return { success: true }; // 업데이트할 내용 없음
  }

  let { error } = await supabase
    .from("student_plan")
    .update(payload)
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase
      .from("student_plan")
      .update(payload)
      .eq("id", planId));
  }

  if (error) {
    console.error("[data/studentPlans] 플랜 업데이트 실패 (safe)", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 업데이트 (레거시 - 하위 호환성용)
 * @deprecated updatePlanSafe 사용을 권장합니다
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

  // 금지된 필드 사용 경고
  const forbiddenUsed = Object.keys(updates).filter((key) =>
    FORBIDDEN_UPDATE_FIELDS.includes(key as ForbiddenPlanUpdateFields)
  );
  if (forbiddenUsed.length > 0) {
    console.warn(
      `[data/studentPlans] 구조적 필드 업데이트 시도: ${forbiddenUsed.join(
        ", "
      )}. ` +
        `이 필드들은 플랜그룹 레벨에서 처리해야 합니다. updatePlanSafe() 사용을 권장합니다.`
    );
  }

  const payload: Record<string, unknown> = {};
  if (updates.plan_date !== undefined) payload.plan_date = updates.plan_date;
  if (updates.block_index !== undefined)
    payload.block_index = updates.block_index;
  if (updates.content_type !== undefined)
    payload.content_type = updates.content_type;
  if (updates.content_id !== undefined) payload.content_id = updates.content_id;
  if (updates.chapter !== undefined) payload.chapter = updates.chapter;
  if (updates.planned_start_page_or_time !== undefined)
    payload.planned_start_page_or_time = updates.planned_start_page_or_time;
  if (updates.planned_end_page_or_time !== undefined)
    payload.planned_end_page_or_time = updates.planned_end_page_or_time;
  if (updates.completed_amount !== undefined)
    payload.completed_amount = updates.completed_amount;
  if (updates.progress !== undefined) payload.progress = updates.progress;
  if (updates.is_reschedulable !== undefined)
    payload.is_reschedulable = updates.is_reschedulable;

  let { error } = await supabase
    .from("student_plan")
    .update(payload)
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
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

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ error } = await supabase
        .from("student_plan")
        .delete()
        .in("id", batch));
    }

    if (error) {
      console.error("[data/studentPlans] 플랜 일괄 삭제 실패", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}
