import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";
import type { ContentType } from "@/lib/types/common";

// Database 타입에서 테이블 타입 추출
type PlanRowRaw = Database["public"]["Tables"]["student_plan"]["Row"];
type PlanInsert = Database["public"]["Tables"]["student_plan"]["Insert"];
type PlanUpdate = Database["public"]["Tables"]["student_plan"]["Update"];

// content_type을 올바른 리터럴 타입으로 오버라이드
type PlanRow = Omit<PlanRowRaw, "content_type"> & {
  content_type: ContentType;
};

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

// Plan 타입은 Database 타입과 일치 (수동 타입 정의 제거)
export type Plan = PlanRow;

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
    "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at,is_virtual,slot_index,virtual_subject_category,virtual_description",
    {
      studentId: filters.studentId,
      tenantId: filters.tenantId,
      planDate: filters.planDate,
      dateRange: filters.dateRange,
      planGroupIds: filters.planGroupIds,
      contentType: filters.contentType,
    }
  );

  // fallback 쿼리 빌더
  const buildFallbackQuery = () => {
    let fallbackQuery = supabase
      .from("student_plan")
      .select("id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at,is_virtual,slot_index,virtual_subject_category,virtual_description")
      .eq("student_id", filters.studentId);

    if (filters.tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", filters.tenantId);
    }

    if (filters.planDate) {
      const planDateStr =
        typeof filters.planDate === "string"
          ? filters.planDate.slice(0, 10)
          : String(filters.planDate).slice(0, 10);
      fallbackQuery = fallbackQuery.eq("plan_date", planDateStr);
    } else if (filters.dateRange) {
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
      const validGroupIds = filters.planGroupIds.filter(
        (id) => id && typeof id === "string" && id.trim().length > 0
      );
      if (validGroupIds.length > 0) {
        fallbackQuery = fallbackQuery.in("plan_group_id", validGroupIds);
      }
    }

    return fallbackQuery
      .order("plan_date", { ascending: true })
      .order("block_index", { ascending: true });
  };

  const data = await createTypedConditionalQuery<Plan[]>(
    async () => {
      const result = await query;
      return { data: result.data as Plan[] | null, error: result.error };
    },
    {
      context: "[data/studentPlans] getPlansForStudent",
      defaultValue: [],
      fallbackQuery: async () => {
        const result = await buildFallbackQuery();
        return { data: result.data as Plan[] | null, error: result.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  // 에러가 발생한 경우는 createTypedConditionalQuery가 이미 처리했으므로, 여기서는 서버 에러 재시도 로직만 처리
  // data가 비어있고 planGroupIds가 있는 경우에만 추가 처리
  if (data && data.length === 0 && (filters.planGroupIds?.length ?? 0) > 0) {
    // planGroupIds 필터링이 문제일 수 있으므로, 애플리케이션 레벨에서 폴백 시도
    console.warn(
      "[data/studentPlans] planGroupIds 필터링 결과가 비어있음, 전체 조회로 폴백"
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

  return (data ?? []).map((plan) => ({
    ...plan,
    plan_group_id: plan.plan_group_id ?? null,
  }));
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
        "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at,is_active,origin_plan_item_id,status,subject_type,version,version_group_id,is_virtual,slot_index,virtual_subject_category,virtual_description"
      )
      .eq("id", planId)
      .eq("student_id", studentId);

  let query = selectPlan();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  return createTypedConditionalQuery<Plan>(
    async () => {
      const result = await query.maybeSingle();
      return { data: result.data, error: result.error };
    },
    {
      context: "[data/studentPlans] getPlanById",
      defaultValue: null,
      fallbackQuery: async () => {
        const result = await selectPlan().maybeSingle();
        return { data: result.data, error: result.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );
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
  /** 전략/취약 정보 */
  subject_type?: "strategy" | "weakness" | null;
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

  // 전략/취약 정보가 있으면 추가
  if (plan.subject_type !== undefined) {
    payload.subject_type = plan.subject_type;
  }

  const result = await createTypedConditionalQuery<{ id: string }>(
    async () => {
      const queryResult = await supabase
        .from("student_plan")
        .insert(payload as PlanInsert)
        .select("id")
        .single();
      return { data: queryResult.data, error: queryResult.error };
    },
    {
      context: "[data/studentPlans] createPlan",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: tenant_id, student_id 컬럼이 없는 경우
        const {
          tenant_id: _tenantId,
          student_id: _studentId,
          ...fallbackPayload
        } = payload;
        const queryResult = await supabase
          .from("student_plan")
          .insert(fallbackPayload as PlanInsert)
          .select("id")
          .single();
        return { data: queryResult.data, error: queryResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  if (!result) {
    return { success: false, error: "플랜 생성 실패" };
  }

  return { success: true, planId: result.id };
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

  const result = await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_plan")
        .update(payload as PlanUpdate)
        .eq("id", planId)
        .eq("student_id", studentId);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentPlans] updatePlanSafe",
      defaultValue: null,
      fallbackQuery: async () => {
        const fallbackResult = await supabase
          .from("student_plan")
          .update(payload as PlanUpdate)
          .eq("id", planId);
        return { data: null, error: fallbackResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
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

  const result = await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_plan")
        .update(payload as PlanUpdate)
        .eq("id", planId)
        .eq("student_id", studentId);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentPlans] updatePlan",
      defaultValue: null,
      fallbackQuery: async () => {
        const fallbackResult = await supabase
          .from("student_plan")
          .update(payload as PlanUpdate)
          .eq("id", planId);
        return { data: null, error: fallbackResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
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

  const result = await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_plan")
        .delete()
        .eq("id", planId)
        .eq("student_id", studentId);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentPlans] deletePlan",
      defaultValue: null,
      fallbackQuery: async () => {
        const fallbackResult = await supabase
          .from("student_plan")
          .delete()
          .eq("id", planId);
        return { data: null, error: fallbackResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  // delete 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
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

    // 배치 삭제는 직접 쿼리 실행하여 에러 확인
    let result = await supabase
      .from("student_plan")
      .delete()
      .in("id", batch)
      .eq("student_id", studentId);

    // UNDEFINED_COLUMN 에러 발생 시 fallback
    if (result.error && ErrorCodeCheckers.isColumnNotFound(result.error)) {
      result = await supabase
        .from("student_plan")
        .delete()
        .in("id", batch);
    }

    // 에러 처리
    if (result.error) {
      handleQueryError(result.error, {
        context: "[data/studentPlans] deletePlans",
      });
      return { success: false, error: result.error.message };
    }
  }

  return { success: true };
}
