"use server";

/**
 * Time Management Actions for Admin
 *
 * 관리자용 학생 시간 관리 서버 액션
 * - 학생 학원 일정 추가
 * - 학생 제외일 추가
 *
 * @module lib/domains/admin-plan/actions/timeManagement
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  createStudentAcademySchedules,
  createStudentExclusions,
} from "@/lib/data/planGroups";

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
export interface TimeManagementActionResult {
  success: boolean;
  error?: string;
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

    // 제외일 타입 검증 및 변환
    const validTypes = ["holiday", "event", "personal"];
    const exclusionType = validTypes.includes(exclusion.exclusion_type)
      ? exclusion.exclusion_type
      : "personal";

    // 데이터 레이어 함수 호출 (useAdminClient = true)
    const result = await createStudentExclusions(
      studentId,
      tenantId,
      [
        {
          exclusion_date: exclusion.exclusion_date,
          exclusion_type: exclusionType,
          reason: exclusion.reason || null,
        },
      ],
      true // useAdminClient - 관리자가 학생 데이터 생성 시 RLS 우회
    );

    if (!result.success) {
      return { success: false, error: result.error || "제외일 저장에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[addStudentExclusionForAdmin] Error:", error);
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "제외일 저장 중 오류가 발생했습니다." };
  }
}
