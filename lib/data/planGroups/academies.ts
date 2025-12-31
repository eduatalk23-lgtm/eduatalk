/**
 * 플랜 그룹 학원 일정 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type { Database } from "@/lib/supabase/database.types";
import type { AcademySchedule } from "./types";
import { getSupabaseClient, getOrCreateAcademy } from "./utils";

/**
 * 플랜 그룹의 학원 일정 조회
 */
export async function getAcademySchedules(
  groupId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  // academies와 조인하여 travel_time 가져오기
  const selectSchedules = () =>
    supabase
      .from("academy_schedules")
      .select(
        "id,tenant_id,student_id,plan_group_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("plan_group_id", groupId) // plan_group_id로 조회 (플랜 그룹별 관리)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

  let query = selectSchedules();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;
  let schedulesData: AcademySchedule[] | null = data as AcademySchedule[] | null;

  // tenant_id 컬럼 없는 경우 재시도
  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    if (process.env.NODE_ENV === "development") {
      logActionWarn(
        { domain: "data", action: "getAcademySchedules" },
        "tenant_id 컬럼 없음, 재시도",
        { groupId, tenantId }
      );
    }
    const retryQuery = supabase
      .from("academy_schedules")
      .select(
        "id,student_id,plan_group_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("plan_group_id", groupId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    const retryResult = await retryQuery;
    error = retryResult.error;

    // tenant_id를 null로 설정
    if (retryResult.data && !error) {
      type ScheduleRow = Database["public"]["Tables"]["academy_schedules"]["Row"] & {
        academies?: { travel_time?: number } | Array<{ travel_time?: number }> | null;
      };
      schedulesData = retryResult.data.map((schedule) => {
        const scheduleRow = schedule as unknown as ScheduleRow;
        const travelTime = Array.isArray(scheduleRow.academies)
          ? scheduleRow.academies[0]?.travel_time ?? null
          : (scheduleRow.academies as { travel_time?: number } | null)?.travel_time ?? null;
        return {
          id: scheduleRow.id,
          tenant_id: null,
          student_id: scheduleRow.student_id,
          academy_id: scheduleRow.academy_id || "",
          day_of_week: scheduleRow.day_of_week,
          start_time: scheduleRow.start_time,
          end_time: scheduleRow.end_time,
          subject: scheduleRow.subject ?? null,
          created_at: scheduleRow.created_at,
          updated_at: scheduleRow.updated_at,
          academy_name: null,
          travel_time: travelTime,
        } as AcademySchedule;
      });
    } else {
      schedulesData = (retryResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getAcademySchedules",
    });
    return [];
  }

  // travel_time 추출 및 반환
  type ScheduleWithAcademies = AcademySchedule & {
    academies?: { travel_time?: number } | Array<{ travel_time?: number }> | null;
  };

  return (
    schedulesData?.map((schedule) => {
      const scheduleWithAcademies = schedule as ScheduleWithAcademies;
      const travelTime = Array.isArray(scheduleWithAcademies.academies)
        ? scheduleWithAcademies.academies[0]?.travel_time ?? 60
        : (scheduleWithAcademies.academies as { travel_time?: number } | null)?.travel_time ?? 60;
      return {
        ...schedule,
        travel_time: travelTime,
      };
    }) || []
  );
}

/**
 * 학생의 전체 학원 일정 조회 (모든 플랜 그룹)
 */
export async function getStudentAcademySchedules(
  studentId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  // academies와 조인하여 travel_time 가져오기
  const selectSchedules = () =>
    supabase
      .from("academy_schedules")
      .select(
        "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("student_id", studentId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

  let query = selectSchedules();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;
  let studentSchedulesData: AcademySchedule[] | null = (data as AcademySchedule[] | null) ?? null;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // academy_id가 없는 경우를 대비한 fallback
    const fallbackSelect = () =>
      supabase
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
        )
        .eq("student_id", studentId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    const fallbackResult = await fallbackQuery;
    error = fallbackResult.error;

    // fallback 데이터 변환 (academy_id 컬럼이 없는 경우)
    if (fallbackResult.data && !error) {
      studentSchedulesData = fallbackResult.data.map((schedule) => ({
        id: schedule.id,
        tenant_id: schedule.tenant_id, // 실제 tenant_id 사용
        student_id: schedule.student_id,
        academy_id: null, // academy_id가 없는 경우 null로 설정
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        subject: schedule.subject ?? null,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
        academy_name: schedule.academy_name || null,
        travel_time: null,
      })) as unknown as AcademySchedule[];
    } else {
      studentSchedulesData = (fallbackResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getStudentAcademySchedules",
    });
    return [];
  }

  // 데이터 변환: academies 관계 데이터를 travel_time으로 변환
  type ScheduleWithAcademies = AcademySchedule & {
    academies?: { travel_time?: number } | null;
  };

  const schedules = (studentSchedulesData ?? []) as ScheduleWithAcademies[];
  return schedules.map((schedule) => ({
    ...schedule,
    travel_time: schedule.academies?.travel_time ?? 60, // 기본값 60분
    academies: undefined, // 관계 데이터 제거
  })) as AcademySchedule[];
}

/**
 * 플랜 그룹의 학원 일정 조회 (source, is_locked 포함)
 */
export async function getPlanGroupAcademySchedules(
  groupId: string,
  tenantId?: string | null
): Promise<Array<AcademySchedule & {
  source: "template" | "student" | "time_management";
  is_locked: boolean;
}>> {
  const supabase = await createSupabaseServerClient();

  // source, is_locked, travel_time 필드를 포함하여 조회
  let query = supabase
    .from("academy_schedules")
    .select(
      "id,tenant_id,student_id,plan_group_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,source,is_locked,travel_time"
    )
    .eq("plan_group_id", groupId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    // source, is_locked, travel_time 컬럼이 없는 경우 기존 함수로 폴백
    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      if (process.env.NODE_ENV === "development") {
        logActionWarn(
          { domain: "data", action: "getPlanGroupAcademySchedules" },
          "source/is_locked/travel_time 컬럼 없음, 기존 함수로 폴백",
          { groupId }
        );
      }
      const fallbackData = await getAcademySchedules(groupId, tenantId);
      return fallbackData.map((schedule) => ({
        ...schedule,
        source: "student" as const,
        is_locked: false,
      }));
    }

    handleQueryError(error, {
      context: "[data/planGroups] getPlanGroupAcademySchedules",
    });
    return [];
  }

  // 데이터 타입 매핑
  type ScheduleRow = {
    id: string;
    tenant_id: string | null;
    student_id: string;
    plan_group_id: string | null;
    academy_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name: string | null;
    subject: string | null;
    created_at: string | null;
    updated_at: string | null;
    source: string | null;
    is_locked: boolean | null;
    travel_time: number | null;
  };

  return (data || []).map((row) => {
    const schedule = row as unknown as ScheduleRow;
    return {
      id: schedule.id,
      tenant_id: schedule.tenant_id,
      student_id: schedule.student_id,
      academy_id: schedule.academy_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name,
      subject: schedule.subject,
      created_at: schedule.created_at ?? new Date().toISOString(),
      updated_at: schedule.updated_at ?? new Date().toISOString(),
      travel_time: schedule.travel_time ?? 60,
      source: (schedule.source || "student") as "template" | "student" | "time_management",
      is_locked: schedule.is_locked ?? false,
    };
  });
}

/**
 * 플랜 그룹에 학원 일정 생성 (간편 버전)
 */
export async function createAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  // 하위 호환성을 위해 student_id를 조회하여 사용
  const supabase = await createSupabaseServerClient();

  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  return createStudentAcademySchedules(group.student_id, tenantId, schedules);
}

/**
 * 플랜 그룹에 학원 일정 생성 (상세 버전 - source, is_locked, travel_time 지원)
 */
export async function createPlanAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
    travel_time?: number; // 이동시간 (academies 테이블에 저장)
    source?: "template" | "student" | "time_management"; // 일정 출처
    is_locked?: boolean; // 템플릿 잠금 여부
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  if (schedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createPlanAcademySchedules" },
        "학원 일정이 없습니다."
      );
    }
    return { success: true };
  }

  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 디버깅: 입력된 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createPlanAcademySchedules" },
      "입력된 학원 일정",
      {
        groupId,
        studentId: group.student_id,
        tenantId,
        schedulesCount: schedules.length,
      }
    );
  }

  const studentId = group.student_id;

  // 중복 체크: 현재 플랜 그룹의 기존 학원 일정 조회
  const existingSchedules = await getAcademySchedules(groupId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) =>
      `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
    )
  );

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createPlanAcademySchedules" },
      "기존 학원 일정 (현재 플랜 그룹)",
      { existingSchedulesCount: existingSchedules.length }
    );
  }

  // 시간 관리 영역의 학원 일정 조회 (plan_group_id가 NULL이거나 다른 플랜 그룹)
  const timeManagementSchedulesQuery = supabase
    .from("academy_schedules")
    .select("id, day_of_week, start_time, end_time, academy_name, subject, academy_id")
    .eq("student_id", studentId);

  if (tenantId) {
    timeManagementSchedulesQuery.eq("tenant_id", tenantId);
  }

  // plan_group_id가 NULL이거나 현재 그룹이 아닌 것
  timeManagementSchedulesQuery.or(`plan_group_id.is.null,plan_group_id.neq.${groupId}`);

  const { data: timeManagementSchedules } = await timeManagementSchedulesQuery;

  // 시간 관리 영역의 학원 일정을 키로 매핑
  const timeManagementMap = new Map(
    (timeManagementSchedules || []).map((s) => [
      `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`,
      s,
    ])
  );

  // 업데이트할 항목과 새로 생성할 항목 분리
  const toUpdate: Array<{ id: string; schedule: typeof schedules[0] }> = [];
  const toInsert: typeof schedules = [];

  for (const schedule of schedules) {
    const key = `${schedule.day_of_week}:${schedule.start_time}:${schedule.end_time}:${schedule.academy_name || ""}:${schedule.subject || ""}`;

    // 현재 플랜 그룹에 이미 있으면 스킵
    if (existingKeys.has(key)) {
      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "createPlanAcademySchedules" },
          "이미 존재하는 학원 일정 스킵",
          { key }
        );
      }
      continue;
    }

    // 시간 관리 영역에 있으면 업데이트
    const timeManagementSchedule = timeManagementMap.get(key);
    if (timeManagementSchedule) {
      toUpdate.push({
        id: timeManagementSchedule.id,
        schedule,
      });
    } else {
      // 없으면 새로 생성
      toInsert.push(schedule);
    }
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createPlanAcademySchedules" },
      "처리 요약",
      {
        updateCount: toUpdate.length,
        insertCount: toInsert.length,
        skipCount: schedules.length - toUpdate.length - toInsert.length,
      }
    );
  }

  // 시간 관리 영역의 학원 일정을 현재 플랜 그룹으로 업데이트
  if (toUpdate.length > 0) {
    for (const { id, schedule } of toUpdate) {
      // academy_name으로 academy 찾기 또는 생성
      const academyName = schedule.academy_name || "학원";
      const travelTime = schedule.travel_time ?? 60;
      const academyResult = await getOrCreateAcademy(studentId, tenantId, academyName, travelTime, useAdminClient);

      if (!academyResult.id) {
        logActionWarn(
          { domain: "data", action: "createPlanAcademySchedules" },
          "학원 ID 확보 실패, 새로 생성으로 폴백",
          { academyName, scheduleId: id, error: academyResult.error }
        );
        toInsert.push(schedule);
        continue;
      }
      const academyId = academyResult.id;

      const { error: updateError } = await supabase
        .from("academy_schedules")
        .update({
          plan_group_id: groupId,
          academy_id: academyId,
          academy_name: schedule.academy_name || null,
          subject: schedule.subject || null,
          // source, is_locked, travel_time 필드 저장
          source: schedule.source || "student",
          is_locked: schedule.is_locked ?? false,
          travel_time: schedule.travel_time ?? 60,
        })
        .eq("id", id);

      if (updateError) {
        handleQueryError(updateError, {
          context: "[data/planGroups] createPlanAcademySchedules - updateSchedule",
        });
        toInsert.push(schedule);
      } else if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "createPlanAcademySchedules" },
          "학원 일정 재활용 성공",
          {
            dayOfWeek: schedule.day_of_week,
            startTime: schedule.start_time,
            endTime: schedule.end_time,
          }
        );
      }
    }
  }

  // 새로 생성할 학원 일정
  if (toInsert.length > 0) {
    // academy_name별로 academy를 찾거나 생성
    const academyNameMap = new Map<string, string>();

    for (const schedule of toInsert) {
      const academyName = schedule.academy_name || "학원";
      const travelTime = schedule.travel_time ?? 60;

      if (!academyNameMap.has(academyName)) {
        const academyResult = await getOrCreateAcademy(studentId, tenantId, academyName, travelTime, useAdminClient);
        if (!academyResult.id) {
          // 에러 메시지에 실제 DB 에러 원인 포함
          return { success: false, error: `학원 생성에 실패했습니다: ${academyName} - ${academyResult.error}` };
        }
        academyNameMap.set(academyName, academyResult.id);
      }
    }

    // academy_id와 plan_group_id를 포함한 payload 생성
    const payload = toInsert.map((schedule) => {
      const academyName = schedule.academy_name || "학원";
      const academyId = academyNameMap.get(academyName);

      if (!academyId) {
        throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
      }

      return {
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: groupId,
        academy_id: academyId,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        academy_name: schedule.academy_name || null,
        subject: schedule.subject || null,
        // source, is_locked, travel_time 필드 저장
        source: schedule.source || "student",
        is_locked: schedule.is_locked ?? false,
        travel_time: schedule.travel_time ?? 60,
      };
    });

    let { error } = await supabase.from("academy_schedules").insert(payload);

    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
      const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
      ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
    }

    if (error) {
      handleQueryError(error, {
        context: "[data/planGroups] createPlanAcademySchedules",
      });
      return { success: false, error: error.message };
    }

    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createPlanAcademySchedules" },
        "학원 일정 생성 완료",
        { insertCount: toInsert.length }
      );
    }
  }

  return { success: true };
}

/**
 * 학생의 시간 관리 영역에 학원 일정 생성 (plan_group_id = NULL)
 */
export async function createStudentAcademySchedules(
  studentId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  if (schedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createStudentAcademySchedules" },
        "학원 일정이 없습니다."
      );
    }
    return { success: true };
  }

  // 디버깅: 입력된 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createStudentAcademySchedules" },
      "입력된 학원 일정",
      { studentId, tenantId, schedulesCount: schedules.length }
    );
  }

  // 중복 체크: 같은 요일, 시간대의 학원 일정이 이미 있으면 스킵
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => `${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 기존 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createStudentAcademySchedules" },
      "기존 학원 일정",
      { existingSchedulesCount: existingSchedules.length }
    );
  }

  const newSchedules = schedules.filter(
    (s) => !existingKeys.has(`${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 필터링된 새 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createStudentAcademySchedules" },
      "필터링된 새 학원 일정",
      {
        newSchedulesCount: newSchedules.length,
        skippedCount: schedules.length - newSchedules.length,
      }
    );
  }

  if (newSchedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createStudentAcademySchedules" },
        "모든 학원 일정이 이미 존재합니다."
      );
    }
    return { success: true }; // 모든 학원 일정이 이미 존재
  }

  // academy_name별로 academy를 찾거나 생성
  const academyNameMap = new Map<string, string>(); // academy_name -> academy_id

  for (const schedule of newSchedules) {
    const academyName = schedule.academy_name || "학원";

    if (!academyNameMap.has(academyName)) {
      const academyResult = await getOrCreateAcademy(studentId, tenantId, academyName, 60, useAdminClient);

      if (!academyResult.id) {
        return { success: false, error: `학원 생성에 실패했습니다: ${academyName} - ${academyResult.error}` };
      }

      academyNameMap.set(academyName, academyResult.id);
    }
  }

  // academy_id를 포함한 payload 생성
  // 시간 관리 영역에 저장 (plan_group_id = NULL)
  const payload = newSchedules.map((schedule) => {
    const academyName = schedule.academy_name || "학원";
    const academyId = academyNameMap.get(academyName);

    if (!academyId) {
      throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
    }

    return {
      tenant_id: tenantId,
      student_id: studentId,
      plan_group_id: null, // 시간 관리 영역 (NULL 허용)
      academy_id: academyId,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name || null, // 하위 호환성
      subject: schedule.subject || null,
    };
  });

  let { error } = await supabase.from("academy_schedules").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] createStudentAcademySchedules",
    });
    return { success: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createStudentAcademySchedules" },
      "학원 일정 저장 완료",
      { savedCount: payload.length }
    );
  }

  return { success: true };
}
