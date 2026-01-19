"use server";

/**
 * Planner CRUD Actions
 *
 * 플래너 엔티티의 생성, 조회, 수정, 삭제 액션
 *
 * @module lib/domains/admin-plan/actions/planners
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";
import type { TimeRange } from "@/lib/scheduler/utils/scheduleCalculator";

// ============================================
// 타입 정의
// ============================================

/**
 * 플래너 상태
 */
export type PlannerStatus = "draft" | "active" | "paused" | "archived" | "completed";

/**
 * 제외일 타입
 */
export type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타";

/**
 * 비학습시간 블록
 */
export interface NonStudyTimeBlock {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
  start_time: string;
  end_time: string;
  day_of_week?: number[];
  description?: string;
}

/**
 * 플래너 생성 입력
 */
export interface CreatePlannerInput {
  studentId: string;
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  targetDate?: string;
  studyHours?: TimeRange;
  selfStudyHours?: TimeRange;
  lunchTime?: TimeRange;
  blockSetId?: string;
  nonStudyTimeBlocks?: NonStudyTimeBlock[];
  defaultSchedulerType?: string;
  defaultSchedulerOptions?: Record<string, unknown>;
  adminMemo?: string;
  /** 학원 일정 (시간 관리에서 불러오기) */
  academySchedules?: PlannerAcademyScheduleInput[];
  /** 제외일 (시간 관리에서 불러오기) */
  exclusions?: PlannerExclusionInput[];
}

/**
 * 플래너 업데이트 입력
 */
export interface UpdatePlannerInput {
  name?: string;
  description?: string;
  status?: PlannerStatus;
  periodStart?: string;
  periodEnd?: string;
  targetDate?: string | null;
  studyHours?: TimeRange;
  selfStudyHours?: TimeRange;
  lunchTime?: TimeRange;
  blockSetId?: string | null;
  nonStudyTimeBlocks?: NonStudyTimeBlock[];
  defaultSchedulerType?: string;
  defaultSchedulerOptions?: Record<string, unknown>;
  adminMemo?: string | null;
  /** 기존 플랜 그룹에도 변경사항을 반영할지 여부 */
  syncToExistingGroups?: boolean;
}

/**
 * 제외일 입력
 */
export interface PlannerExclusionInput {
  exclusionDate: string;
  exclusionType: ExclusionType;
  reason?: string;
  source?: "manual" | "template" | "imported";
  isLocked?: boolean;
}

/**
 * 학원일정 입력
 */
export interface PlannerAcademyScheduleInput {
  academyId?: string;
  academyName?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject?: string;
  travelTime?: number;
  source?: "manual" | "imported" | "sync";
  isLocked?: boolean;
}

/**
 * 플래너 데이터
 */
export interface Planner {
  id: string;
  tenantId: string;
  studentId: string;
  name: string;
  description: string | null;
  status: PlannerStatus;
  periodStart: string;
  periodEnd: string;
  targetDate: string | null;
  studyHours: TimeRange | null;
  selfStudyHours: TimeRange | null;
  lunchTime: TimeRange | null;
  blockSetId: string | null;
  nonStudyTimeBlocks: NonStudyTimeBlock[];
  defaultSchedulerType: string;
  defaultSchedulerOptions: Record<string, unknown>;
  adminMemo: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // 관계 데이터
  exclusions?: PlannerExclusion[];
  academySchedules?: PlannerAcademySchedule[];
  planGroupCount?: number;
}

/**
 * 제외일 데이터
 */
export interface PlannerExclusion {
  id: string;
  plannerId: string;
  exclusionDate: string;
  exclusionType: ExclusionType;
  reason: string | null;
  source: string;
  isLocked: boolean;
  createdAt: string;
}

/**
 * 학원일정 데이터
 */
export interface PlannerAcademySchedule {
  id: string;
  plannerId: string;
  academyId: string | null;
  academyName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string | null;
  travelTime: number;
  source: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 권한 체크
// ============================================

async function checkAdminOrConsultant() {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();

  if (!user || (role !== "admin" && role !== "consultant")) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return { user, tenantId: tenantContext.tenantId };
}

// ============================================
// 플래너 CRUD
// ============================================

/**
 * 플래너 생성
 *
 * academySchedules, exclusions가 제공되면 플래너 생성 후 함께 저장합니다.
 */
async function _createPlanner(input: CreatePlannerInput): Promise<Planner> {
  const { user, tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("planners")
    .insert({
      tenant_id: tenantId,
      student_id: input.studentId,
      name: input.name,
      description: input.description || null,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      target_date: input.targetDate || null,
      study_hours: input.studyHours || { start: "10:00", end: "19:00" },
      self_study_hours: input.selfStudyHours || { start: "19:00", end: "22:00" },
      lunch_time: input.lunchTime || { start: "12:00", end: "13:00" },
      block_set_id: input.blockSetId || null,
      non_study_time_blocks: input.nonStudyTimeBlocks || [],
      default_scheduler_type: input.defaultSchedulerType || "1730_timetable",
      default_scheduler_options: input.defaultSchedulerOptions || {
        study_days: 6,
        review_days: 1,
      },
      admin_memo: input.adminMemo || null,
      created_by: user.userId,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    throw new AppError(
      `플래너 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const plannerId = data.id as string;

  // 학원 일정이 제공된 경우 저장
  if (input.academySchedules && input.academySchedules.length > 0) {
    await _setPlannerAcademySchedulesInternal(
      supabase,
      tenantId,
      plannerId,
      input.academySchedules
    );
  }

  // 제외일이 제공된 경우 저장
  if (input.exclusions && input.exclusions.length > 0) {
    await _setPlannerExclusionsInternal(
      supabase,
      tenantId,
      plannerId,
      input.exclusions
    );
  }

  // 관계 데이터를 포함하여 조회 후 반환
  const hasRelations = !!(input.academySchedules?.length || input.exclusions?.length);
  if (hasRelations) {
    const plannerWithRelations = await _getPlanner(plannerId, true);
    if (plannerWithRelations) {
      return plannerWithRelations;
    }
  }

  return mapPlannerFromDB(data);
}

/**
 * 내부용: 학원일정 저장 (인증 체크 없이)
 */
async function _setPlannerAcademySchedulesInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  plannerId: string,
  schedules: PlannerAcademyScheduleInput[]
): Promise<void> {
  if (schedules.length === 0) return;

  const { error } = await supabase.from("planner_academy_schedules").insert(
    schedules.map((s) => ({
      tenant_id: tenantId,
      planner_id: plannerId,
      academy_id: s.academyId || null,
      academy_name: s.academyName || null,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      subject: s.subject || null,
      travel_time: s.travelTime ?? 60,
      source: s.source || "imported",
      is_locked: s.isLocked || false,
    }))
  );

  if (error) {
    logActionError("planners._createPlanner", `학원일정 저장 실패: ${error.message}`);
    // 플래너는 이미 생성되었으므로 에러를 던지지 않고 로깅만 함
  }
}

/**
 * 내부용: 제외일 저장 (인증 체크 없이)
 */
async function _setPlannerExclusionsInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  plannerId: string,
  exclusions: PlannerExclusionInput[]
): Promise<void> {
  if (exclusions.length === 0) return;

  const { error } = await supabase.from("planner_exclusions").insert(
    exclusions.map((e) => ({
      tenant_id: tenantId,
      planner_id: plannerId,
      exclusion_date: e.exclusionDate,
      exclusion_type: e.exclusionType,
      reason: e.reason || null,
      source: e.source || "imported",
      is_locked: e.isLocked || false,
    }))
  );

  if (error) {
    logActionError("planners._createPlanner", `제외일 저장 실패: ${error.message}`);
    // 플래너는 이미 생성되었으므로 에러를 던지지 않고 로깅만 함
  }
}

export const createPlannerAction = withErrorHandling(_createPlanner);

/**
 * 플래너 조회
 */
async function _getPlanner(
  plannerId: string,
  includeRelations = false
): Promise<Planner | null> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("planners")
    .select("*")
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new AppError(
      `플래너 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const planner = mapPlannerFromDB(data);

  if (includeRelations) {
    // 제외일 조회
    const { data: exclusions } = await supabase
      .from("planner_exclusions")
      .select("*")
      .eq("planner_id", plannerId)
      .order("exclusion_date", { ascending: true });

    planner.exclusions = (exclusions || []).map(mapExclusionFromDB);

    // 학원일정 조회
    const { data: schedules } = await supabase
      .from("planner_academy_schedules")
      .select("*")
      .eq("planner_id", plannerId)
      .order("day_of_week", { ascending: true });

    planner.academySchedules = (schedules || []).map(mapAcademyScheduleFromDB);

    // 플랜그룹 수 조회
    const { count } = await supabase
      .from("plan_groups")
      .select("*", { count: "exact", head: true })
      .eq("planner_id", plannerId)
      .is("deleted_at", null);

    planner.planGroupCount = count || 0;
  }

  return planner;
}

export const getPlannerAction = withErrorHandling(_getPlanner);

/**
 * 학생의 플래너 목록 조회
 */
async function _getStudentPlanners(
  studentId: string,
  options?: {
    status?: PlannerStatus | PlannerStatus[];
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: Planner[]; total: number }> {
  const { tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("planners")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in("status", options.status);
    } else {
      query = query.eq("status", options.status);
    }
  }

  if (!options?.includeArchived) {
    query = query.neq("status", "archived");
  }

  query = query.order("period_start", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new AppError(
      `플래너 목록 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return {
    data: (data || []).map(mapPlannerFromDB),
    total: count || 0,
  };
}

export const getStudentPlannersAction = withErrorHandling(_getStudentPlanners);

/**
 * 플래너 수정
 */
async function _updatePlanner(
  plannerId: string,
  updates: UpdatePlannerInput
): Promise<Planner> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.periodStart !== undefined) updateData.period_start = updates.periodStart;
  if (updates.periodEnd !== undefined) updateData.period_end = updates.periodEnd;
  if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
  if (updates.studyHours !== undefined) updateData.study_hours = updates.studyHours;
  if (updates.selfStudyHours !== undefined) updateData.self_study_hours = updates.selfStudyHours;
  if (updates.lunchTime !== undefined) updateData.lunch_time = updates.lunchTime;
  if (updates.blockSetId !== undefined) updateData.block_set_id = updates.blockSetId;
  if (updates.nonStudyTimeBlocks !== undefined) updateData.non_study_time_blocks = updates.nonStudyTimeBlocks;
  if (updates.defaultSchedulerType !== undefined) updateData.default_scheduler_type = updates.defaultSchedulerType;
  if (updates.defaultSchedulerOptions !== undefined) updateData.default_scheduler_options = updates.defaultSchedulerOptions;
  if (updates.adminMemo !== undefined) updateData.admin_memo = updates.adminMemo;

  const { data, error } = await supabase
    .from("planners")
    .update(updateData)
    .eq("id", plannerId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `플래너 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 기존 플랜 그룹에 변경사항 동기화
  if (updates.syncToExistingGroups) {
    const planGroupUpdateData: Record<string, unknown> = {};

    // 시간 설정 동기화
    if (updates.studyHours !== undefined) planGroupUpdateData.study_hours = updates.studyHours;
    if (updates.selfStudyHours !== undefined) planGroupUpdateData.self_study_hours = updates.selfStudyHours;
    if (updates.lunchTime !== undefined) planGroupUpdateData.lunch_time = updates.lunchTime;
    if (updates.nonStudyTimeBlocks !== undefined) planGroupUpdateData.non_study_time_blocks = updates.nonStudyTimeBlocks;
    if (updates.defaultSchedulerType !== undefined) planGroupUpdateData.scheduler_type = updates.defaultSchedulerType;
    if (updates.defaultSchedulerOptions !== undefined) planGroupUpdateData.scheduler_options = updates.defaultSchedulerOptions;
    if (updates.blockSetId !== undefined) planGroupUpdateData.block_set_id = updates.blockSetId;

    // 동기화할 데이터가 있는 경우에만 업데이트
    if (Object.keys(planGroupUpdateData).length > 0) {
      const { error: syncError } = await supabase
        .from("plan_groups")
        .update(planGroupUpdateData)
        .eq("planner_id", plannerId)
        .in("status", ["active", "draft"])
        .is("deleted_at", null);

      if (syncError) {
        logActionWarn("planners._updatePlanner", `플랜 그룹 동기화 실패: ${syncError.message}`);
        // 플래너는 이미 업데이트되었으므로 경고만 로깅
      }
    }
  }

  return mapPlannerFromDB(data);
}

export const updatePlannerAction = withErrorHandling(_updatePlanner);

/**
 * 플래너 삭제 (소프트 삭제)
 */
async function _deletePlanner(plannerId: string): Promise<void> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("planners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", plannerId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      `플래너 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const deletePlannerAction = withErrorHandling(_deletePlanner);

/**
 * 플래너 상태 변경
 */
async function _updatePlannerStatus(
  plannerId: string,
  status: PlannerStatus
): Promise<Planner> {
  return _updatePlanner(plannerId, { status });
}

export const updatePlannerStatusAction = withErrorHandling(_updatePlannerStatus);

// ============================================
// 제외일 관리
// ============================================

/**
 * 제외일 추가
 */
async function _addPlannerExclusion(
  plannerId: string,
  input: PlannerExclusionInput
): Promise<PlannerExclusion> {
  const { tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("planner_exclusions")
    .insert({
      tenant_id: tenantId,
      planner_id: plannerId,
      exclusion_date: input.exclusionDate,
      exclusion_type: input.exclusionType,
      reason: input.reason || null,
      source: input.source || "manual",
      is_locked: input.isLocked || false,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(
      `제외일 추가 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return mapExclusionFromDB(data);
}

export const addPlannerExclusionAction = withErrorHandling(_addPlannerExclusion);

/**
 * 제외일 삭제
 */
async function _removePlannerExclusion(exclusionId: string): Promise<void> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("planner_exclusions")
    .delete()
    .eq("id", exclusionId);

  if (error) {
    throw new AppError(
      `제외일 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const removePlannerExclusionAction = withErrorHandling(_removePlannerExclusion);

/**
 * 제외일 일괄 설정
 */
async function _setPlannerExclusions(
  plannerId: string,
  exclusions: PlannerExclusionInput[]
): Promise<PlannerExclusion[]> {
  const { tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  // 기존 제외일 삭제 (잠긴 항목 제외)
  await supabase
    .from("planner_exclusions")
    .delete()
    .eq("planner_id", plannerId)
    .eq("is_locked", false);

  if (exclusions.length === 0) {
    return [];
  }

  // 새 제외일 추가
  const { data, error } = await supabase
    .from("planner_exclusions")
    .insert(
      exclusions.map((e) => ({
        tenant_id: tenantId,
        planner_id: plannerId,
        exclusion_date: e.exclusionDate,
        exclusion_type: e.exclusionType,
        reason: e.reason || null,
        source: e.source || "manual",
        is_locked: e.isLocked || false,
      }))
    )
    .select();

  if (error) {
    throw new AppError(
      `제외일 일괄 설정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data || []).map(mapExclusionFromDB);
}

export const setPlannerExclusionsAction = withErrorHandling(_setPlannerExclusions);

// ============================================
// 학원일정 관리
// ============================================

/**
 * 학원일정 추가
 */
async function _addPlannerAcademySchedule(
  plannerId: string,
  input: PlannerAcademyScheduleInput
): Promise<PlannerAcademySchedule> {
  const { tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("planner_academy_schedules")
    .insert({
      tenant_id: tenantId,
      planner_id: plannerId,
      academy_id: input.academyId || null,
      academy_name: input.academyName || null,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      subject: input.subject || null,
      travel_time: input.travelTime ?? 60,
      source: input.source || "manual",
      is_locked: input.isLocked || false,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(
      `학원일정 추가 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return mapAcademyScheduleFromDB(data);
}

export const addPlannerAcademyScheduleAction = withErrorHandling(
  _addPlannerAcademySchedule
);

/**
 * 학원일정 삭제
 */
async function _removePlannerAcademySchedule(scheduleId: string): Promise<void> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("planner_academy_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    throw new AppError(
      `학원일정 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const removePlannerAcademyScheduleAction = withErrorHandling(
  _removePlannerAcademySchedule
);

/**
 * 학원일정 일괄 설정
 */
async function _setPlannerAcademySchedules(
  plannerId: string,
  schedules: PlannerAcademyScheduleInput[]
): Promise<PlannerAcademySchedule[]> {
  const { tenantId } = await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  // 기존 학원일정 삭제 (잠긴 항목 제외)
  await supabase
    .from("planner_academy_schedules")
    .delete()
    .eq("planner_id", plannerId)
    .eq("is_locked", false);

  if (schedules.length === 0) {
    return [];
  }

  // 새 학원일정 추가
  const { data, error } = await supabase
    .from("planner_academy_schedules")
    .insert(
      schedules.map((s) => ({
        tenant_id: tenantId,
        planner_id: plannerId,
        academy_id: s.academyId || null,
        academy_name: s.academyName || null,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        subject: s.subject || null,
        travel_time: s.travelTime ?? 60,
        source: s.source || "manual",
        is_locked: s.isLocked || false,
      }))
    )
    .select();

  if (error) {
    throw new AppError(
      `학원일정 일괄 설정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data || []).map(mapAcademyScheduleFromDB);
}

export const setPlannerAcademySchedulesAction = withErrorHandling(
  _setPlannerAcademySchedules
);

// ============================================
// DB 매핑 헬퍼
// ============================================

function mapPlannerFromDB(row: Record<string, unknown>): Planner {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studentId: row.student_id as string,
    name: row.name as string,
    description: row.description as string | null,
    status: row.status as PlannerStatus,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    targetDate: row.target_date as string | null,
    studyHours: row.study_hours as TimeRange | null,
    selfStudyHours: row.self_study_hours as TimeRange | null,
    lunchTime: row.lunch_time as TimeRange | null,
    blockSetId: row.block_set_id as string | null,
    nonStudyTimeBlocks: (row.non_study_time_blocks || []) as NonStudyTimeBlock[],
    defaultSchedulerType: row.default_scheduler_type as string,
    defaultSchedulerOptions: (row.default_scheduler_options || {}) as Record<
      string,
      unknown
    >,
    adminMemo: row.admin_memo as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | null,
  };
}

function mapExclusionFromDB(row: Record<string, unknown>): PlannerExclusion {
  return {
    id: row.id as string,
    plannerId: row.planner_id as string,
    exclusionDate: row.exclusion_date as string,
    exclusionType: row.exclusion_type as ExclusionType,
    reason: row.reason as string | null,
    source: row.source as string,
    isLocked: row.is_locked as boolean,
    createdAt: row.created_at as string,
  };
}

function mapAcademyScheduleFromDB(
  row: Record<string, unknown>
): PlannerAcademySchedule {
  return {
    id: row.id as string,
    plannerId: row.planner_id as string,
    academyId: row.academy_id as string | null,
    academyName: row.academy_name as string | null,
    dayOfWeek: row.day_of_week as number,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    subject: row.subject as string | null,
    travelTime: row.travel_time as number,
    source: row.source as string,
    isLocked: row.is_locked as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
