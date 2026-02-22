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
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";
import type { TimeRange } from "@/lib/scheduler/utils/scheduleCalculator";
import type { SchedulerOptions } from "@/lib/types/plan/domain";
import {
  mergeLunchTimeIntoNonStudyBlocks,
  extractLunchTimeFromBlocks,
} from "../utils/plannerConfigInheritance";
import {
  generateNonStudyRecordsForDateRange,
  generateExclusionRecordsForDates,
  type AcademyScheduleInput,
} from "../utils/nonStudyTimeGenerator";
import { resolvePrimaryCalendarId, mapExclusionType } from "@/lib/domains/calendar/helpers";
import { extractTimeHHMM } from "@/lib/domains/calendar/adapters";

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
  day_of_week?: number[]; // 요일 적용 범위 (0-6)
  specific_dates?: string[]; // 특정 날짜 지정 (YYYY-MM-DD)
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
  // ============================================
  // 스케줄러 조율 옵션 (Phase 1: 플랜 시스템 통합)
  // plan_groups에서 planner로 이동, 여러 plan_group 조율 역할
  // ============================================
  /**
   * 스케줄러 조율 옵션
   * - subject_allocations: 과목별 전략/취약 배정
   * - content_allocations: 콘텐츠별 배정 설정
   * - 여러 plan_group을 함께 조율하는 정보 저장
   * Phase 2에서 활성화됨
   */
  schedulerOptions?: SchedulerOptions | null;
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
  // getCurrentUser()가 이미 role, tenantId를 포함하므로 단일 호출로 처리
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!user.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return { user, tenantId: user.tenantId };
}

/**
 * 플래너 접근 권한 체크 (Admin/Consultant 또는 해당 학생 본인)
 *
 * @param targetStudentId - 대상 학생 ID
 * @returns 사용자 정보와 tenantId, isAdmin 여부
 */
async function checkPlannerAccess(targetStudentId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!user.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // Admin/Consultant는 모든 학생 접근 가능
  if (user.role === "admin" || user.role === "consultant") {
    return { user, tenantId: user.tenantId, isAdmin: true };
  }

  // 학생은 자신의 플래너만 접근 가능
  if (user.role === "student" && user.userId === targetStudentId) {
    return { user, tenantId: user.tenantId, isAdmin: false };
  }

  throw new AppError("접근 권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
}

// ============================================
// 플래너 CRUD
// ============================================

/**
 * 플래너 생성
 *
 * academySchedules, exclusions가 제공되면 플래너 생성 후 함께 저장합니다.
 * - Admin/Consultant: 모든 학생 플래너 생성 가능
 * - Student: 자신의 플래너만 생성 가능
 */
async function _createPlanner(input: CreatePlannerInput): Promise<Planner> {
  const { user, tenantId } = await checkPlannerAccess(input.studentId);
  const supabase = await createSupabaseServerClient();

  // lunch_time을 non_study_time_blocks에 통합
  const mergedNonStudyBlocks = mergeLunchTimeIntoNonStudyBlocks(
    input.lunchTime || { start: "12:00", end: "13:00" },
    input.nonStudyTimeBlocks
  );

  // 하위 호환성을 위해 lunch_time 필드도 설정 (non_study_time_blocks에서 추출)
  const lunchTime =
    extractLunchTimeFromBlocks(mergedNonStudyBlocks) ||
    input.lunchTime ||
    { start: "12:00", end: "13:00" };

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
      lunch_time: lunchTime, // 하위 호환성 유지
      block_set_id: input.blockSetId || null,
      non_study_time_blocks: mergedNonStudyBlocks, // 통합된 비학습시간 블록
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

  // 비학습시간 날짜별 레코드 생성 (제외일 포함)
  await _generateNonStudyTimeRecordsInternal(
    supabase,
    tenantId,
    plannerId,
    input.studentId,
    input.periodStart,
    input.periodEnd,
    mergedNonStudyBlocks,
    input.academySchedules,
    input.exclusions?.map((e) => e.exclusionDate),
    input.exclusions
  );

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
 * 내부용: 비학습시간 날짜별 레코드 생성 (인증 체크 없이)
 * calendar_events 테이블에 삽입
 */
async function _generateNonStudyTimeRecordsInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  plannerId: string,
  studentId: string,
  startDate: string,
  endDate: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[],
  academySchedules?: PlannerAcademyScheduleInput[],
  excludedDates?: string[],
  exclusions?: PlannerExclusionInput[]
): Promise<void> {
  // calendarId resolve
  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) {
    logActionError(
      "planners._createPlanner",
      "캘린더를 찾을 수 없어 비학습시간 레코드를 생성할 수 없습니다."
    );
    return;
  }

  // 학원 일정 변환
  const academyScheduleInputs: AcademyScheduleInput[] = (academySchedules || []).map((s) => ({
    id: undefined,
    academyId: s.academyId,
    academyName: s.academyName,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    travelTime: s.travelTime,
  }));

  // 비학습시간 레코드 생성 (식사, 수면, 학원, 이동시간 등)
  const records = generateNonStudyRecordsForDateRange(
    calendarId,
    studentId,
    tenantId,
    startDate,
    endDate,
    nonStudyTimeBlocks,
    {
      academySchedules: academyScheduleInputs,
      excludedDates,
    }
  );

  // 제외일 레코드 생성 (event_type='exclusion')
  if (exclusions && exclusions.length > 0) {
    const exclusionRecords = generateExclusionRecordsForDates(
      calendarId,
      studentId,
      tenantId,
      exclusions.map((e) => ({
        date: e.exclusionDate,
        exclusionType: e.exclusionType,
        reason: e.reason,
      })),
      "imported"
    );
    records.push(...exclusionRecords);
  }

  if (records.length === 0) return;

  // 배치 삽입 (대량 데이터를 위해 청크 처리)
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("calendar_events").insert(batch);

    if (error) {
      logActionError(
        "planners._createPlanner",
        `비학습시간 레코드 저장 실패 (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`
      );
    }
  }
}

export const createPlannerAction = withErrorHandling(_createPlanner);

/**
 * 플래너 조회
 * - Admin/Consultant: 모든 플래너 조회 가능
 * - Student: 자신의 플래너만 조회 가능
 */
async function _getPlanner(
  plannerId: string,
  includeRelations = false
): Promise<Planner | null> {
  const supabase = await createSupabaseServerClient();

  // 먼저 플래너 조회
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

  // 플래너의 studentId로 권한 체크
  await checkPlannerAccess(data.student_id as string);

  const planner = mapPlannerFromDB(data);

  if (includeRelations) {
    // calendarId resolve
    const calendarId = await resolvePrimaryCalendarId(plannerId);

    if (calendarId) {
      // 제외일 조회 (calendar_events event_type='exclusion')
      const { data: exclusions } = await supabase
        .from("calendar_events")
        .select("id, calendar_id, start_date, event_subtype, title, source, created_at")
        .eq("calendar_id", calendarId)
        .eq("event_type", "exclusion")
        .eq("is_all_day", true)
        .is("deleted_at", null)
        .order("start_date", { ascending: true });

      planner.exclusions = (exclusions || []).map((row) => ({
        id: row.id,
        plannerId,
        exclusionDate: row.start_date!,
        exclusionType: (row.event_subtype ?? "기타") as ExclusionType,
        reason: row.title,
        source: row.source ?? "template",
        isLocked: false,
        createdAt: row.created_at ?? "",
      }));

      // 학원일정 조회 (calendar_events event_type='academy', event_subtype='학원')
      const { data: schedules } = await supabase
        .from("calendar_events")
        .select("id, calendar_id, start_at, end_at, start_date, title, source, created_at")
        .eq("calendar_id", calendarId)
        .eq("event_type", "academy")
        .filter("event_subtype", "eq", "학원")
        .is("deleted_at", null)
        .order("start_date", { ascending: true });

      // 날짜별 레코드를 요일+시간 기준으로 유니크하게 집약
      const scheduleMap = new Map<string, { id: string; label: string | null; dayOfWeek: number; startTime: string; endTime: string; source: string; createdAt: string }>();
      for (const row of schedules || []) {
        const planDate = row.start_date || row.start_at?.split("T")[0] || "";
        const dayOfWeek = new Date(planDate + "T00:00:00").getDay();
        const startTime = extractTimeHHMM(row.start_at) ?? "00:00";
        const endTime = extractTimeHHMM(row.end_at) ?? "00:00";
        const key = `${dayOfWeek}-${startTime}-${endTime}`;
        if (!scheduleMap.has(key)) {
          scheduleMap.set(key, {
            id: row.id,
            label: row.title,
            dayOfWeek,
            startTime,
            endTime,
            source: row.source ?? "template",
            createdAt: row.created_at ?? "",
          });
        }
      }

      planner.academySchedules = Array.from(scheduleMap.values()).map((row) => ({
        id: row.id,
        plannerId,
        academyId: null,
        academyName: row.label,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        subject: null,
        travelTime: 0,
        source: row.source,
        isLocked: false,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      }));
    } else {
      planner.exclusions = [];
      planner.academySchedules = [];
    }

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
 * - Admin/Consultant: 모든 학생 플래너 조회 가능
 * - Student: 자신의 플래너만 조회 가능
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
  const { tenantId } = await checkPlannerAccess(studentId);
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

  const planners = (data || []).map(mapPlannerFromDB);

  // 플랜그룹 수 조회 (RPC 함수로 DB 수준에서 집계)
  if (planners.length > 0) {
    const plannerIds = planners.map((p) => p.id);

    const { data: groupCounts, error: groupCountError } = await supabase.rpc(
      "get_plan_group_counts",
      { p_planner_ids: plannerIds }
    );

    if (groupCountError) {
      logActionWarn(
        "planners._getStudentPlanners",
        `플랜그룹 수 조회 실패: ${groupCountError.message}`
      );
      // 메인 데이터는 반환, 그룹 수는 0으로 처리
    }

    // DB에서 집계된 결과를 Map으로 변환
    const countMap = new Map<string, number>();
    (groupCounts || []).forEach(
      (row: { planner_id: string; group_count: number }) => {
        countMap.set(row.planner_id, row.group_count);
      }
    );

    // 각 플래너에 그룹 수 할당
    planners.forEach((planner) => {
      planner.planGroupCount = countMap.get(planner.id) || 0;
    });
  }

  return {
    data: planners,
    total: count || 0,
  };
}

export const getStudentPlannersAction = withErrorHandling(_getStudentPlanners);

/**
 * 플래너 수정
 * - Admin/Consultant: 모든 플래너 수정 가능
 * - Student: 자신의 플래너만 수정 가능
 */
async function _updatePlanner(
  plannerId: string,
  updates: UpdatePlannerInput
): Promise<Planner> {
  const supabase = await createSupabaseServerClient();

  // 먼저 플래너 조회하여 studentId, created_by 확인
  const { data: existingPlanner, error: fetchError } = await supabase
    .from("planners")
    .select("student_id, created_by")
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingPlanner) {
    throw new AppError(
      "플래너를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플래너의 studentId로 권한 체크
  const { user, isAdmin } = await checkPlannerAccess(existingPlanner.student_id as string);

  // 학생은 자신이 생성한 플래너만 수정 가능
  if (!isAdmin && existingPlanner.created_by !== user.userId) {
    throw new AppError(
      "관리자가 생성한 플래너는 수정할 수 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.periodStart !== undefined) updateData.period_start = updates.periodStart;
  if (updates.periodEnd !== undefined) updateData.period_end = updates.periodEnd;
  if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
  if (updates.studyHours !== undefined) updateData.study_hours = updates.studyHours;
  if (updates.selfStudyHours !== undefined) updateData.self_study_hours = updates.selfStudyHours;
  if (updates.blockSetId !== undefined) updateData.block_set_id = updates.blockSetId;
  if (updates.defaultSchedulerType !== undefined) updateData.default_scheduler_type = updates.defaultSchedulerType;
  if (updates.defaultSchedulerOptions !== undefined) updateData.default_scheduler_options = updates.defaultSchedulerOptions;
  if (updates.adminMemo !== undefined) updateData.admin_memo = updates.adminMemo;

  // lunch_time과 non_study_time_blocks 통합 처리
  if (updates.lunchTime !== undefined || updates.nonStudyTimeBlocks !== undefined) {
    // 현재 플래너의 non_study_time_blocks 조회 (lunchTime만 변경되는 경우 필요)
    let currentBlocks = updates.nonStudyTimeBlocks;

    if (updates.lunchTime !== undefined && currentBlocks === undefined) {
      // lunchTime만 변경되는 경우, 기존 블록 조회
      const { data: currentPlanner } = await supabase
        .from("planners")
        .select("non_study_time_blocks")
        .eq("id", plannerId)
        .single();

      currentBlocks = currentPlanner?.non_study_time_blocks as NonStudyTimeBlock[] | undefined;
    }

    // lunch_time을 non_study_time_blocks에 통합
    const mergedBlocks = mergeLunchTimeIntoNonStudyBlocks(
      updates.lunchTime,
      currentBlocks
    );

    // 하위 호환성을 위해 lunch_time 필드도 설정
    const lunchTime = extractLunchTimeFromBlocks(mergedBlocks);

    updateData.non_study_time_blocks = mergedBlocks;
    if (lunchTime) {
      updateData.lunch_time = lunchTime;
    }
  }

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
    // lunch_time과 non_study_time_blocks는 통합된 값 사용 (위에서 이미 처리됨)
    if (updateData.lunch_time !== undefined) planGroupUpdateData.lunch_time = updateData.lunch_time;
    if (updateData.non_study_time_blocks !== undefined) planGroupUpdateData.non_study_time_blocks = updateData.non_study_time_blocks;
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
 * 플래너 삭제 결과 타입
 */
export interface DeletePlannerResult {
  plannerId: string;
  deletedPlanGroupsCount: number;
  deletedStudentPlansCount: number;
  deletedExclusionsCount: number;
  deletedAcademySchedulesCount: number;
}

/**
 * 플래너 삭제 (Cascade 소프트 삭제) - 트랜잭션 보장
 *
 * PostgreSQL RPC 함수를 통해 원자적으로 처리됩니다.
 * 부분 실패 시 자동 롤백됩니다.
 *
 * 삭제 순서:
 * 1. student_plan (소프트 삭제) - plan_group_id로 연결된 플랜들
 * 2. plan_groups (소프트 삭제) - planner_id로 연결된 그룹들
 * 3. calendar_events (소프트 삭제) - 비학습시간/제외일/학원 통합 데이터
 * 4. planner_exclusion_overrides (하드 삭제)
 * 5. planners (소프트 삭제)
 *
 * - Admin/Consultant: 모든 플래너 삭제 가능
 * - Student: 자신의 플래너만 삭제 가능
 */
async function _deletePlanner(plannerId: string): Promise<DeletePlannerResult> {
  const supabase = await createSupabaseServerClient();

  // 먼저 플래너 조회하여 studentId, tenant_id, created_by 확인
  const { data: existingPlanner, error: fetchError } = await supabase
    .from("planners")
    .select("student_id, tenant_id, created_by")
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingPlanner) {
    throw new AppError(
      "플래너를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플래너의 studentId로 권한 체크
  const { user, isAdmin } = await checkPlannerAccess(existingPlanner.student_id as string);

  // 학생은 자신이 생성한 플래너만 삭제 가능
  if (!isAdmin && existingPlanner.created_by !== user.userId) {
    throw new AppError(
      "관리자가 생성한 플래너는 삭제할 수 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const tenantId = existingPlanner.tenant_id as string;

  // RPC 함수를 통한 원자적 삭제
  const { data, error } = await supabase.rpc("delete_planner_cascade", {
    p_planner_id: plannerId,
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new AppError(
      `플래너 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // RPC 함수 결과 파싱
  const result = data as {
    success: boolean;
    planner_id: string;
    deleted_plan_groups_count: number;
    deleted_student_plans_count: number;
    deleted_exclusions_count: number;
    deleted_academy_schedules_count: number;
    error?: string;
    error_code?: string;
  };

  if (!result.success) {
    // NOT_FOUND 에러 처리
    if (result.error_code === "NOT_FOUND") {
      throw new AppError(
        result.error || "플래너를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    throw new AppError(
      result.error || "플래너 삭제 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return {
    plannerId: result.planner_id,
    deletedPlanGroupsCount: result.deleted_plan_groups_count,
    deletedStudentPlansCount: result.deleted_student_plans_count,
    deletedExclusionsCount: result.deleted_exclusions_count,
    deletedAcademySchedulesCount: result.deleted_academy_schedules_count,
  };
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

  // calendarId + studentId resolve
  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const { data: plannerData } = await supabase
    .from("planners")
    .select("student_id")
    .eq("id", plannerId)
    .single();

  if (!plannerData) {
    throw new AppError("플래너를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      calendar_id: calendarId,
      tenant_id: tenantId,
      student_id: plannerData.student_id,
      title: input.reason || "제외일",
      event_type: "exclusion",
      event_subtype: mapExclusionType(input.exclusionType),
      start_date: input.exclusionDate,
      end_date: input.exclusionDate,
      is_all_day: true,
      status: "confirmed",
      transparency: "transparent",
      source: input.source || "manual",
      order_index: 0,
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

  return {
    id: data.id as string,
    plannerId,
    exclusionDate: data.start_date as string,
    exclusionType: (data.event_subtype ?? "기타") as ExclusionType,
    reason: data.title as string | null,
    source: data.source as string,
    isLocked: false,
    createdAt: data.created_at as string,
  };
}

export const addPlannerExclusionAction = withErrorHandling(_addPlannerExclusion);

/**
 * 제외일 삭제 (소프트 삭제)
 */
async function _removePlannerExclusion(exclusionId: string): Promise<void> {
  await checkAdminOrConsultant();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled" as const,
    })
    .eq("id", exclusionId)
    .is("deleted_at", null);

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

