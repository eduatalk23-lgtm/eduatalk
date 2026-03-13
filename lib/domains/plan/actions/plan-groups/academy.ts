"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createStudentAcademySchedules,
  getStudentAcademySchedules,
} from "@/lib/data/planGroups";
import {
  updateAcademyScheduleViaCalendar,
  deleteAcademyScheduleViaCalendar,
  getDistinctAcademiesFromCalendar,
  renameAcademyViaCalendar,
  updateAcademyTravelTimeViaCalendar,
  deleteAcademyViaCalendar,
} from "@/lib/data/calendarAcademySchedules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { AcademySchedule } from "@/lib/types/plan";
import { DEFAULT_TRAVEL_TIME_MINUTES } from "@/lib/utils/time";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 시간 관리 데이터 반영 (학원일정)
 * 관리자/컨설턴트 모드에서도 사용 가능하도록 수정
 */
async function _syncTimeManagementAcademySchedules(
  groupId: string | null,
  studentId?: string
): Promise<{
  count: number;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number;
    source?: "time_management";
  }>;
}> {
  const { role, userId } = await getCachedUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 관리자/컨설턴트 모드일 때는 studentId 파라미터 필수
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  let targetStudentId: string;

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회 (groupId가 있는 경우만)
  if (groupId) {
    let group;
    if (isAdminOrConsultant) {
      // 관리자 모드: getPlanGroupByIdForAdmin 사용
      group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      // 관리자 모드에서 studentId가 없으면 플랜 그룹에서 student_id 가져오기
      targetStudentId = studentId || group.student_id;
      if (!targetStudentId) {
        throw new AppError(
          "학생 ID를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
    } else {
      // 학생 모드: 기존 로직
      group = await getPlanGroupById(
        groupId,
        userId,
        tenantContext.tenantId
      );
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      targetStudentId = userId;
      // 기존 플랜 그룹인 경우 revalidate
      revalidatePath(`/plan/group/${groupId}/edit`);
    }
  } else {
    // groupId가 없는 경우
    if (isAdminOrConsultant) {
      // 관리자 모드: studentId 파라미터 필수
      if (!studentId) {
        // 템플릿 모드에서는 빈 결과 반환
        return {
          count: 0,
          academySchedules: [],
        };
      }
      targetStudentId = studentId;
    } else {
      // 학생 모드: 현재 사용자 ID 사용
      targetStudentId = userId;
    }
  }

  // 관리자 모드일 때는 학생의 tenant_id를 직접 조회
  let effectiveTenantId = tenantContext.tenantId;
  if (isAdminOrConsultant && targetStudentId) {
    const { data: studentData } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (studentData?.tenant_id) {
      effectiveTenantId = studentData.tenant_id;
    }
  }

  // 학생의 모든 학원일정 조회 (시간 관리에 등록된 모든 학원일정)
  // 관리자/컨설턴트 모드에서는 Admin 클라이언트 사용 (RLS 우회)
  const allAcademySchedules = await getStudentAcademySchedules(
    targetStudentId,
    effectiveTenantId,
    { useAdminClient: isAdminOrConsultant }
  );

  // 최신 학원일정 데이터 반환 (source 필드 추가)
  return {
    count: allAcademySchedules.length,
    academySchedules: allAcademySchedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || undefined,
      subject: s.subject || undefined,
      travel_time: s.travel_time || DEFAULT_TRAVEL_TIME_MINUTES,
      source: "time_management" as const,
    })),
  };
}

/**
 * 플랜 그룹 학원 일정 추가
 */
async function _addAcademySchedule(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  const dayOfWeek = formData.get("day_of_week");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const academyName = formData.get("academy_name");
  const subject = formData.get("subject");

  if (!dayOfWeek || typeof dayOfWeek !== "string") {
    throw new AppError(
      "요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError(
      "시작 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError(
      "종료 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!academyName || typeof academyName !== "string" || !academyName.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new AppError(
      "과목을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const day = Number.parseInt(dayOfWeek, 10);
  if (Number.isNaN(day) || day < 0 || day > 6) {
    throw new AppError(
      "올바른 요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (startTime >= endTime) {
    throw new AppError(
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 학생별 전역 관리로 변경 (플랜 그룹과 분리)
  const result = await createStudentAcademySchedules(
    user.userId,
    tenantContext.tenantId,
    [
      {
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        academy_name:
          academyName && typeof academyName === "string"
            ? academyName.trim()
            : null,
        subject: subject && typeof subject === "string" ? subject.trim() : null,
      },
    ]
  );

  if (!result.success) {
    throw new AppError(
      result.error || "학원 일정 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 플랜 그룹 학원 일정 수정
 */
async function _updateAcademySchedule(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();

  const scheduleId = formData.get("schedule_id");
  const dayOfWeek = formData.get("day_of_week");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const academyName = formData.get("academy_name");
  const subject = formData.get("subject");

  if (!scheduleId || typeof scheduleId !== "string") {
    throw new AppError(
      "학원 일정 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!dayOfWeek || typeof dayOfWeek !== "string") {
    throw new AppError(
      "요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError(
      "시작 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError(
      "종료 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!academyName || typeof academyName !== "string" || !academyName.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new AppError(
      "과목을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const day = Number.parseInt(dayOfWeek, 10);
  if (Number.isNaN(day) || day < 0 || day > 6) {
    throw new AppError(
      "올바른 요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (startTime >= endTime) {
    throw new AppError(
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 일정 소유권 확인 (calendar_events 기반)
  const { data: schedule, error: fetchError } = await supabase
    .from("calendar_events")
    .select("student_id, tenant_id")
    .eq("id", scheduleId)
    .eq("label", "학원")
    .maybeSingle();

  if (fetchError || !schedule) {
    throw new AppError(
      "학원 일정을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (schedule.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // calendar_events 기반 패턴 업데이트
  const trimmedAcademyName = academyName.trim();
  const result = await updateAcademyScheduleViaCalendar(scheduleId, {
    academy_name: trimmedAcademyName,
    subject: subject.trim(),
  });

  if (!result.success) {
    throw new AppError(
      result.error || "학원 일정 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 플랜 그룹 학원 일정 삭제
 */
async function _deleteAcademySchedule(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();

  const scheduleId = formData.get("schedule_id");

  if (!scheduleId || typeof scheduleId !== "string") {
    throw new AppError(
      "학원 일정 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 일정 소유권 확인 (calendar_events 기반)
  const { data: schedule, error: fetchError } = await supabase
    .from("calendar_events")
    .select("student_id")
    .eq("id", scheduleId)
    .eq("label", "학원")
    .maybeSingle();

  // PGRST116은 "no rows returned" 에러이므로 정상적인 경우 (데이터 없음)
  if (fetchError && fetchError.code !== "PGRST116") {
    logActionError(
      { domain: "plan", action: "deleteAcademySchedule" },
      fetchError,
      { scheduleId, errorCode: fetchError.code }
    );
    throw new AppError(
      fetchError.message || "학원 일정 조회 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: fetchError }
    );
  }

  if (!schedule) {
    throw new AppError(
      "학원 일정을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (schedule.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // calendar_events 기반 패턴 일괄 soft-delete
  const result = await deleteAcademyScheduleViaCalendar(scheduleId);

  if (!result.success) {
    throw new AppError(
      result.error || "학원 일정 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 플랜 그룹 학원 일정 조회
 */
async function _getAcademySchedules(
  planGroupId: string
): Promise<AcademySchedule[]> {
  const user = await requireStudentAuth();

  const tenantContext = await getTenantContext();

  // 플랜 그룹 소유권 확인 (학원 일정은 학생별 전역 관리이지만, 플랜 그룹 소유권은 확인)
  const group = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext?.tenantId || null
  );
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생별 전역 학원 일정 조회
  const schedules = await getStudentAcademySchedules(
    user.userId,
    tenantContext?.tenantId || null
  );
  return schedules;
}

/**
 * 학원 생성 (가상 엔티티)
 *
 * calendar_events 기반 가상 학원. 이름 중복 체크만 수행.
 * 실제 학원 데이터는 일정 추가 시 calendar_events에 자동 생성됨.
 * UX: "학원 등록" 시점에서는 이름/이동시간을 기록해두고,
 * 첫 일정 추가 시 해당 정보가 calendar_events에 반영됨.
 */
async function _createAcademy(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  const name = formData.get("name");
  const travelTime = formData.get("travel_time");

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const travelTimeNum = travelTime
    ? Number.parseInt(String(travelTime), 10)
    : DEFAULT_TRAVEL_TIME_MINUTES;
  if (Number.isNaN(travelTimeNum) || travelTimeNum < 0) {
    throw new AppError(
      "이동시간은 0 이상의 숫자여야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 중복 체크: calendar_events에서 같은 이름의 학원이 이미 있는지 확인
  const existingAcademies = await getDistinctAcademiesFromCalendar(
    user.userId,
    tenantContext.tenantId
  );

  if (existingAcademies.some((a) => a.name === name.trim())) {
    throw new AppError(
      "이미 같은 이름의 학원이 등록되어 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 가상 학원: 일정이 없는 빈 학원은 calendar_events에 저장할 수 없으므로
  // 플레이스홀더 이벤트를 생성하지 않음. UI에서 즉시 일정 추가를 유도.
  // Note: 이 함수는 학원 이름 중복 검증 목적으로만 유지.

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 학원 수정 (가상 엔티티 - academy_name 기반)
 *
 * academyId 대신 academy_name(기존 이름)으로 식별.
 * calendar_events의 title + metadata.travel_time 일괄 업데이트.
 */
async function _updateAcademy(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  const academyName = formData.get("academy_name");
  const name = formData.get("name");
  const travelTime = formData.get("travel_time");

  if (!academyName || typeof academyName !== "string") {
    throw new AppError(
      "학원 이름이 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError(
      "새 학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const travelTimeNum = travelTime
    ? Number.parseInt(String(travelTime), 10)
    : DEFAULT_TRAVEL_TIME_MINUTES;
  if (Number.isNaN(travelTimeNum) || travelTimeNum < 0) {
    throw new AppError(
      "이동시간은 0 이상의 숫자여야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 이름 변경 시 중복 체크
  const trimmedNewName = name.trim();
  if (trimmedNewName !== academyName) {
    const existingAcademies = await getDistinctAcademiesFromCalendar(
      user.userId,
      tenantContext.tenantId
    );
    if (existingAcademies.some((a) => a.name === trimmedNewName)) {
      throw new AppError(
        "이미 같은 이름의 학원이 등록되어 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 학원명 변경
    const renameResult = await renameAcademyViaCalendar(
      user.userId,
      academyName,
      trimmedNewName
    );
    if (!renameResult.success) {
      throw new AppError(
        renameResult.error || "학원명 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  // 이동시간 업데이트
  const travelResult = await updateAcademyTravelTimeViaCalendar(
    user.userId,
    trimmedNewName,
    travelTimeNum
  );
  if (!travelResult.success) {
    throw new AppError(
      travelResult.error || "이동시간 변경에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 학원 삭제 (가상 엔티티 - academy_name 기반)
 *
 * 해당 학원명의 모든 미래 calendar_events를 soft-delete.
 */
async function _deleteAcademy(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();

  const academyName = formData.get("academy_name");

  if (!academyName || typeof academyName !== "string") {
    throw new AppError(
      "학원 이름이 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const result = await deleteAcademyViaCalendar(user.userId, academyName);

  if (!result.success) {
    throw new AppError(
      result.error || "학원 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const syncTimeManagementAcademySchedulesAction = withErrorHandling(
  _syncTimeManagementAcademySchedules
);
export const addAcademySchedule = withErrorHandling(_addAcademySchedule);
export const updateAcademySchedule = withErrorHandling(_updateAcademySchedule);
export const deleteAcademySchedule = withErrorHandling(_deleteAcademySchedule);
export const getAcademySchedulesAction = withErrorHandling(_getAcademySchedules);
export const createAcademy = withErrorHandling(_createAcademy);
export const updateAcademy = withErrorHandling(_updateAcademy);
export const deleteAcademy = withErrorHandling(_deleteAcademy);

