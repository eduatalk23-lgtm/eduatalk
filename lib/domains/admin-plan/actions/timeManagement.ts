"use server";

/**
 * Time Management Actions for Admin
 *
 * 관리자용 학생 시간 관리 서버 액션
 * - 학생 학원 일정 CRUD
 * - 학생 제외일 CRUD
 * - 학원 관리
 *
 * @module lib/domains/admin-plan/actions/timeManagement
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  createStudentAcademySchedules,
  createStudentExclusions,
  getStudentAcademySchedules,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import type { AcademySchedule, PlanExclusion, Academy } from "@/lib/types/plan/domain";

// ============================================
// 타입 정의
// ============================================

/**
 * 학원 일정 추가 입력
 */
export interface AddAcademyScheduleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
}

/**
 * 제외일 추가 입력
 */
export interface AddExclusionInput {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string;
}

/**
 * 액션 결과
 */
export interface TimeManagementActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 학원 일정 수정 입력
 */
export interface UpdateAcademyScheduleInput {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  subject?: string | null;
}

/**
 * 제외일 수정 입력
 */
export interface UpdateExclusionInput {
  exclusion_date?: string;
  exclusion_type?: string;
  reason?: string | null;
}

/**
 * 학원 생성 입력
 */
export interface CreateAcademyInput {
  name: string;
  travel_time?: number;
}

/**
 * 학원 수정 입력
 */
export interface UpdateAcademyInput {
  name?: string;
  travel_time?: number;
}

/**
 * 학원과 일정을 함께 반환하는 타입
 */
export interface AcademyWithSchedules extends Academy {
  schedules: AcademySchedule[];
}

// ============================================
// 상수 및 헬퍼
// ============================================

/**
 * 영어 제외일 타입을 한국어 DB 값으로 변환
 * DB CHECK 제약조건: '휴가' | '개인사정' | '휴일지정' | '기타'
 */
function mapExclusionTypeToKorean(
  englishType: string
): "휴가" | "개인사정" | "휴일지정" | "기타" {
  switch (englishType) {
    case "holiday":
      return "휴일지정";
    case "vacation":
      return "휴가";
    case "personal":
      return "개인사정";
    case "event":
    case "custom":
    default:
      return "기타";
  }
}

// ============================================
// 내부 헬퍼 함수
// ============================================

/**
 * 관리자 또는 컨설턴트 권한 확인
 */
async function checkAdminOrConsultant() {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();

  if (!user || (role !== "admin" && role !== "consultant")) {
    throw new AppError(
      "권한이 없습니다. 관리자 또는 컨설턴트만 이 작업을 수행할 수 있습니다.",
      ErrorCode.FORBIDDEN,
      403
    );
  }

  // user에서 tenantId 직접 사용
  if (!user.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }

  return { user, tenantId: user.tenantId };
}

// ============================================
// 서버 액션
// ============================================

/**
 * 학생 학원 일정 추가 (관리자용)
 *
 * 학생의 시간 관리 영역에 학원 일정을 추가합니다.
 * 추가된 일정은 향후 플랜 생성 시 Import하여 재사용할 수 있습니다.
 *
 * @param studentId - 학생 ID
 * @param schedule - 학원 일정 정보
 * @returns 성공 여부
 */
export async function addStudentAcademyScheduleForAdmin(
  studentId: string,
  schedule: AddAcademyScheduleInput
): Promise<TimeManagementActionResult> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    // 입력 검증
    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (schedule.day_of_week < 0 || schedule.day_of_week > 6) {
      return { success: false, error: "요일은 0(일요일)부터 6(토요일) 사이여야 합니다." };
    }

    if (!schedule.start_time || !schedule.end_time) {
      return { success: false, error: "시작 시간과 종료 시간을 입력해주세요." };
    }

    if (schedule.start_time >= schedule.end_time) {
      return { success: false, error: "종료 시간은 시작 시간보다 이후여야 합니다." };
    }

    // 데이터 레이어 함수 호출 (useAdminClient = true)
    const result = await createStudentAcademySchedules(
      studentId,
      tenantId,
      [
        {
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          academy_name: schedule.academy_name || null,
          subject: schedule.subject || null,
        },
      ],
      true // useAdminClient
    );

    if (!result.success) {
      return { success: false, error: result.error || "학원 일정 저장에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[addStudentAcademyScheduleForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 일정 저장 중 오류가 발생했습니다." };
  }
}

/**
 * 학생 제외일 추가 (관리자용)
 *
 * 학생의 시간 관리 영역에 제외일을 추가합니다.
 * 추가된 제외일은 향후 플랜 생성 시 Import하여 재사용할 수 있습니다.
 *
 * @param studentId - 학생 ID
 * @param exclusion - 제외일 정보
 * @returns 성공 여부
 */
export async function addStudentExclusionForAdmin(
  studentId: string,
  exclusion: AddExclusionInput
): Promise<TimeManagementActionResult> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    // 입력 검증
    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!exclusion.exclusion_date) {
      return { success: false, error: "날짜를 선택해주세요." };
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(exclusion.exclusion_date)) {
      return { success: false, error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
    }

    // 제외일 타입을 한국어 DB 값으로 변환
    // 영어 입력 (holiday, personal, event 등) → 한국어 DB 값 (휴일지정, 개인사정, 기타 등)
    const koreanExclusionType = mapExclusionTypeToKorean(exclusion.exclusion_type);

    // 데이터 레이어 함수 호출 (useAdminClient = true)
    const result = await createStudentExclusions(
      studentId,
      tenantId,
      [
        {
          exclusion_date: exclusion.exclusion_date,
          exclusion_type: koreanExclusionType,
          reason: exclusion.reason || null,
        },
      ],
      true // useAdminClient - 관리자가 학생 데이터 생성 시 RLS 우회
    );

    if (!result.success) {
      return { success: false, error: result.error || "제외일 저장에 실패했습니다." };
    }

    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    console.error("[addStudentExclusionForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "제외일 저장 중 오류가 발생했습니다." };
  }
}

// ============================================
// 조회 액션
// ============================================

/**
 * 학생 제외일 목록 조회 (관리자용)
 */
export async function getStudentExclusionsForAdmin(
  studentId: string
): Promise<TimeManagementActionResult<PlanExclusion[]>> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    const exclusions = await getStudentExclusions(studentId, tenantId, {
      useAdminClient: true,
    });

    return { success: true, data: exclusions };
  } catch (error) {
    console.error("[getStudentExclusionsForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "제외일 조회 중 오류가 발생했습니다." };
  }
}

/**
 * 학생 학원 일정 목록 조회 (관리자용)
 */
export async function getStudentAcademySchedulesForAdmin(
  studentId: string
): Promise<TimeManagementActionResult<AcademySchedule[]>> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    const schedules = await getStudentAcademySchedules(studentId, tenantId, {
      useAdminClient: true,
    });

    return { success: true, data: schedules };
  } catch (error) {
    console.error("[getStudentAcademySchedulesForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 일정 조회 중 오류가 발생했습니다." };
  }
}

/**
 * 학생 학원 목록 조회 (일정 포함, 관리자용)
 */
export async function getStudentAcademiesWithSchedulesForAdmin(
  studentId: string
): Promise<TimeManagementActionResult<AcademyWithSchedules[]>> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    // 학원 목록 조회
    let academyQuery = adminClient
      .from("academies")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    if (tenantId) {
      academyQuery = academyQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }

    const { data: academies, error: academyError } = await academyQuery;

    if (academyError) {
      console.error("[getStudentAcademiesWithSchedulesForAdmin] Academy Error:", academyError);
      return { success: false, error: "학원 목록 조회에 실패했습니다." };
    }

    // 각 학원의 일정 조회
    const academiesWithSchedules: AcademyWithSchedules[] = [];

    for (const academy of academies || []) {
      let scheduleQuery = adminClient
        .from("academy_schedules")
        .select("*")
        .eq("academy_id", academy.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      const { data: schedules, error: scheduleError } = await scheduleQuery;

      if (scheduleError) {
        console.error("[getStudentAcademiesWithSchedulesForAdmin] Schedule Error:", scheduleError);
        continue;
      }

      academiesWithSchedules.push({
        id: academy.id,
        tenant_id: academy.tenant_id,
        student_id: academy.student_id,
        name: academy.name,
        travel_time: academy.travel_time ?? 60,
        created_at: academy.created_at ?? new Date().toISOString(),
        updated_at: academy.updated_at ?? new Date().toISOString(),
        schedules: (schedules || []) as AcademySchedule[],
      });
    }

    return { success: true, data: academiesWithSchedules };
  } catch (error) {
    console.error("[getStudentAcademiesWithSchedulesForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 목록 조회 중 오류가 발생했습니다." };
  }
}

// ============================================
// 수정/삭제 액션
// ============================================

/**
 * 제외일 수정 (관리자용)
 */
export async function updateStudentExclusionForAdmin(
  exclusionId: string,
  data: UpdateExclusionInput
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!exclusionId) {
      return { success: false, error: "제외일 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const updateData: Record<string, unknown> = {};

    if (data.exclusion_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.exclusion_date)) {
        return { success: false, error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
      }
      updateData.exclusion_date = data.exclusion_date;
    }

    if (data.exclusion_type) {
      updateData.exclusion_type = mapExclusionTypeToKorean(data.exclusion_type);
    }

    if (data.reason !== undefined) {
      updateData.reason = data.reason;
    }

    const { error } = await adminClient
      .from("plan_exclusions")
      .update(updateData)
      .eq("id", exclusionId);

    if (error) {
      console.error("[updateStudentExclusionForAdmin] Error:", error);
      return { success: false, error: "제외일 수정에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[updateStudentExclusionForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "제외일 수정 중 오류가 발생했습니다." };
  }
}

/**
 * 제외일 삭제 (관리자용)
 */
export async function deleteStudentExclusionForAdmin(
  exclusionId: string
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!exclusionId) {
      return { success: false, error: "제외일 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const { error } = await adminClient
      .from("plan_exclusions")
      .delete()
      .eq("id", exclusionId);

    if (error) {
      console.error("[deleteStudentExclusionForAdmin] Error:", error);
      return { success: false, error: "제외일 삭제에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[deleteStudentExclusionForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "제외일 삭제 중 오류가 발생했습니다." };
  }
}

/**
 * 학원 일정 수정 (관리자용)
 */
export async function updateAcademyScheduleForAdmin(
  scheduleId: string,
  data: UpdateAcademyScheduleInput
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!scheduleId) {
      return { success: false, error: "일정 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const updateData: Record<string, unknown> = {};

    if (data.day_of_week !== undefined) {
      if (data.day_of_week < 0 || data.day_of_week > 6) {
        return { success: false, error: "요일은 0(일요일)부터 6(토요일) 사이여야 합니다." };
      }
      updateData.day_of_week = data.day_of_week;
    }

    if (data.start_time) {
      updateData.start_time = data.start_time;
    }

    if (data.end_time) {
      updateData.end_time = data.end_time;
    }

    if (data.subject !== undefined) {
      updateData.subject = data.subject;
    }

    // 시간 검증
    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      return { success: false, error: "종료 시간은 시작 시간보다 이후여야 합니다." };
    }

    const { error } = await adminClient
      .from("academy_schedules")
      .update(updateData)
      .eq("id", scheduleId);

    if (error) {
      console.error("[updateAcademyScheduleForAdmin] Error:", error);
      return { success: false, error: "일정 수정에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[updateAcademyScheduleForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "일정 수정 중 오류가 발생했습니다." };
  }
}

/**
 * 학원 일정 삭제 (관리자용)
 */
export async function deleteAcademyScheduleForAdmin(
  scheduleId: string
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!scheduleId) {
      return { success: false, error: "일정 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const { error } = await adminClient
      .from("academy_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      console.error("[deleteAcademyScheduleForAdmin] Error:", error);
      return { success: false, error: "일정 삭제에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[deleteAcademyScheduleForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "일정 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 학원 관리 액션
// ============================================

/**
 * 학원 생성 (관리자용)
 */
export async function createAcademyForAdmin(
  studentId: string,
  data: CreateAcademyInput
): Promise<TimeManagementActionResult<Academy>> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    if (!studentId) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!data.name || data.name.trim() === "") {
      return { success: false, error: "학원명을 입력해주세요." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const { data: academy, error } = await adminClient
      .from("academies")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        name: data.name.trim(),
        travel_time: data.travel_time ?? 60,
      })
      .select()
      .single();

    if (error) {
      console.error("[createAcademyForAdmin] Error:", error);
      return { success: false, error: "학원 생성에 실패했습니다." };
    }

    revalidatePath(`/admin/students/${studentId}`);
    return { success: true, data: academy as Academy };
  } catch (error) {
    console.error("[createAcademyForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 생성 중 오류가 발생했습니다." };
  }
}

/**
 * 학원 수정 (관리자용)
 */
export async function updateAcademyForAdmin(
  academyId: string,
  data: UpdateAcademyInput
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!academyId) {
      return { success: false, error: "학원 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { success: false, error: "학원명을 입력해주세요." };
      }
      updateData.name = data.name.trim();
    }

    if (data.travel_time !== undefined) {
      updateData.travel_time = data.travel_time;
    }

    const { error } = await adminClient
      .from("academies")
      .update(updateData)
      .eq("id", academyId);

    if (error) {
      console.error("[updateAcademyForAdmin] Error:", error);
      return { success: false, error: "학원 수정에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[updateAcademyForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 수정 중 오류가 발생했습니다." };
  }
}

/**
 * 학원 삭제 (관리자용) - cascade로 일정도 함께 삭제
 */
export async function deleteAcademyForAdmin(
  academyId: string
): Promise<TimeManagementActionResult> {
  try {
    await checkAdminOrConsultant();

    if (!academyId) {
      return { success: false, error: "학원 ID가 필요합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    // 학원에 연결된 일정 먼저 삭제
    const { error: scheduleError } = await adminClient
      .from("academy_schedules")
      .delete()
      .eq("academy_id", academyId);

    if (scheduleError) {
      console.error("[deleteAcademyForAdmin] Schedule Delete Error:", scheduleError);
      return { success: false, error: "학원 일정 삭제에 실패했습니다." };
    }

    // 학원 삭제
    const { error } = await adminClient
      .from("academies")
      .delete()
      .eq("id", academyId);

    if (error) {
      console.error("[deleteAcademyForAdmin] Error:", error);
      return { success: false, error: "학원 삭제에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[deleteAcademyForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "학원 삭제 중 오류가 발생했습니다." };
  }
}

/**
 * 학원 일정 추가 (관리자용) - 기존 학원에 일정 추가
 */
export async function addAcademyScheduleForAdmin(
  academyId: string,
  schedule: Omit<AddAcademyScheduleInput, "academy_name">
): Promise<TimeManagementActionResult> {
  try {
    const { tenantId } = await checkAdminOrConsultant();

    if (!academyId) {
      return { success: false, error: "학원 ID가 필요합니다." };
    }

    // 입력 검증
    if (schedule.day_of_week < 0 || schedule.day_of_week > 6) {
      return { success: false, error: "요일은 0(일요일)부터 6(토요일) 사이여야 합니다." };
    }

    if (!schedule.start_time || !schedule.end_time) {
      return { success: false, error: "시작 시간과 종료 시간을 입력해주세요." };
    }

    if (schedule.start_time >= schedule.end_time) {
      return { success: false, error: "종료 시간은 시작 시간보다 이후여야 합니다." };
    }

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client를 초기화할 수 없습니다." };
    }

    // 학원 정보 조회 (student_id 확인)
    const { data: academy, error: academyError } = await adminClient
      .from("academies")
      .select("student_id, name")
      .eq("id", academyId)
      .single();

    if (academyError || !academy) {
      return { success: false, error: "학원을 찾을 수 없습니다." };
    }

    const { error } = await adminClient
      .from("academy_schedules")
      .insert({
        tenant_id: tenantId,
        student_id: academy.student_id,
        academy_id: academyId,
        academy_name: academy.name,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        subject: schedule.subject || null,
      });

    if (error) {
      console.error("[addAcademyScheduleForAdmin] Error:", error);
      return { success: false, error: "일정 추가에 실패했습니다." };
    }

    revalidatePath(`/admin/students/${academy.student_id}`);
    return { success: true };
  } catch (error) {
    console.error("[addAcademyScheduleForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "일정 추가 중 오류가 발생했습니다." };
  }
}
