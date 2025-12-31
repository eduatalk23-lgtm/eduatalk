/**
 * 캠프 플랜 그룹 업데이트 서비스
 * 
 * 플랜 그룹 메타데이터, 제외일, 학원 일정 등의 업데이트 로직을 담당합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanGroupSchedulerOptions } from "@/lib/types/schedulerSettings";
import type { DailyScheduleInfo, TimeSettings } from "@/lib/types/plan";
import { AppError, ErrorCode, logError } from "@/lib/errors";
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";
import {
  createPlanExclusions,
  createStudentAcademySchedules,
} from "@/lib/data/planGroups";

type PlanGroupUpdatePayload = Partial<{
  updated_at: string;
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options: PlanGroupSchedulerOptions | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  daily_schedule: DailyScheduleInfo[] | null;
  subject_constraints: unknown | null;
  additional_period_reallocation: unknown | null;
  non_study_time_blocks: unknown | null;
  plan_type: string | null;
  camp_template_id: string | null;
  camp_invitation_id: string | null;
}>;

type CreationData = {
  name?: string | null;
  plan_purpose?: string | null;
  scheduler_type?: string | null;
  scheduler_options?: PlanGroupSchedulerOptions | null;
  time_settings?: unknown;
  period_start?: string;
  period_end?: string;
  target_date?: string | null;
  block_set_id?: string | null;
  daily_schedule?: DailyScheduleInfo[] | null;
  subject_constraints?: unknown | null;
  additional_period_reallocation?: unknown | null;
  non_study_time_blocks?: unknown | null;
  plan_type?: string;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  exclusions?: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>;
  academy_schedules?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>;
};

/**
 * plan_purpose 정규화 함수
 * 
 * 플랜 목적(plan_purpose) 값을 일관된 형식으로 정규화합니다.
 * - "수능" 또는 "모의고사" → "모의고사(수능)"로 통일
 * - null 또는 빈 값 → null 반환
 * 
 * @param purpose - 정규화할 플랜 목적 값
 * @returns 정규화된 플랜 목적 값 또는 null
 */
function normalizePlanPurpose(
  purpose: string | null | undefined
): string | null {
  if (!purpose) return null;
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  return purpose;
}

/**
 * 플랜 그룹 메타데이터 업데이트
 * 
 * 플랜 그룹의 기본 정보(이름, 목적, 기간, 스케줄러 설정 등)를 업데이트합니다.
 * 
 * **주요 처리 사항:**
 * - `time_settings`를 `scheduler_options`에 안전하게 병합
 *   (하위 호환성을 위해 기존 `time_settings` 필드 지원)
 * - `plan_purpose` 정규화 ("수능" → "모의고사(수능)")
 * - `updated_at` 타임스탬프 자동 업데이트
 * - undefined인 필드는 업데이트하지 않음 (부분 업데이트 지원)
 * 
 * **에러 처리:**
 * - 데이터베이스 업데이트 실패 시 `AppError`를 throw하여 상위에서 처리
 * 
 * @param supabase - Supabase 클라이언트
 * @param groupId - 업데이트할 플랜 그룹 ID
 * @param tenantId - 테넌트 ID (RLS 정책 확인용)
 * @param creationData - 업데이트할 데이터
 *   - `name`: 플랜 그룹 이름
 *   - `plan_purpose`: 플랜 목적 (정규화됨)
 *   - `scheduler_type`: 스케줄러 타입
 *   - `scheduler_options`: 스케줄러 옵션 (time_settings와 병합됨)
 *   - `period_start`, `period_end`: 플랜 기간
 *   - 기타 메타데이터 필드들
 * 
 * @throws {AppError} 데이터베이스 업데이트 실패 시
 * 
 * @example
 * ```typescript
 * await updatePlanGroupMetadata(supabase, groupId, tenantId, {
 *   name: "2025년 수능 대비 플랜",
 *   plan_purpose: "수능", // "모의고사(수능)"으로 정규화됨
 *   period_start: "2025-01-01",
 *   period_end: "2025-11-15"
 * });
 * ```
 */
export async function updatePlanGroupMetadata(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  creationData: CreationData
): Promise<void> {
  // time_settings를 scheduler_options에 안전하게 병합
  // time_settings는 unknown 타입이므로 타입 단언 필요
  const mergedSchedulerOptions = mergeTimeSettingsSafely(
    creationData.scheduler_options || {},
    creationData.time_settings as Partial<TimeSettings> | null | undefined
  );

  const updatePayload: PlanGroupUpdatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (creationData.name !== undefined)
    updatePayload.name = creationData.name || null;
  if (creationData.plan_purpose !== undefined)
    updatePayload.plan_purpose = normalizePlanPurpose(creationData.plan_purpose);
  if (creationData.scheduler_type !== undefined)
    updatePayload.scheduler_type = creationData.scheduler_type || null;
  if (Object.keys(mergedSchedulerOptions).length > 0) {
    updatePayload.scheduler_options = mergedSchedulerOptions;
  } else {
    updatePayload.scheduler_options = null;
  }
  if (creationData.period_start !== undefined)
    updatePayload.period_start = creationData.period_start;
  if (creationData.period_end !== undefined)
    updatePayload.period_end = creationData.period_end;
  if (creationData.target_date !== undefined)
    updatePayload.target_date = creationData.target_date || null;
  if (creationData.block_set_id !== undefined)
    updatePayload.block_set_id = creationData.block_set_id || null;
  if (creationData.daily_schedule !== undefined)
    updatePayload.daily_schedule = creationData.daily_schedule || null;
  if (creationData.subject_constraints !== undefined)
    updatePayload.subject_constraints = creationData.subject_constraints || null;
  if (creationData.additional_period_reallocation !== undefined)
    updatePayload.additional_period_reallocation =
      creationData.additional_period_reallocation || null;
  if (creationData.non_study_time_blocks !== undefined)
    updatePayload.non_study_time_blocks =
      creationData.non_study_time_blocks || null;
  if (creationData.plan_type !== undefined)
    updatePayload.plan_type = creationData.plan_type || null;
  if (creationData.camp_template_id !== undefined)
    updatePayload.camp_template_id = creationData.camp_template_id || null;
  if (creationData.camp_invitation_id !== undefined)
    updatePayload.camp_invitation_id = creationData.camp_invitation_id || null;

  const { error: updateError } = await supabase
    .from("plan_groups")
    .update(updatePayload)
    .eq("id", groupId)
    .eq("tenant_id", tenantId);

  if (updateError) {
    throw new AppError(
      `플랜 그룹 업데이트 실패: ${updateError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

/**
 * 제외일 업데이트
 * 
 * 플랜 그룹의 제외일(공휴일, 시험일 등)을 업데이트합니다.
 * 
 * **처리 흐름:**
 * 1. 기존 제외일을 모두 삭제 (완전 교체 방식)
 * 2. 새로운 제외일이 있으면 생성
 * 3. 빈 배열이면 제외일만 삭제하고 생성하지 않음
 * 
 * **주의사항:**
 * - 기존 제외일 삭제 실패 시에도 로그만 남기고 계속 진행
 *   (새로운 제외일 생성이 더 중요하므로)
 * - `exclusions`가 `undefined`이면 아무 작업도 수행하지 않음
 *   (부분 업데이트 지원)
 * 
 * @param supabase - Supabase 클라이언트
 * @param groupId - 플랜 그룹 ID
 * @param tenantId - 테넌트 ID
 * @param exclusions - 새로운 제외일 목록 (undefined 가능)
 *   - `exclusion_date`: 제외일 날짜 (YYYY-MM-DD 형식)
 *   - `exclusion_type`: 제외일 타입 (예: "holiday", "exam")
 *   - `reason`: 제외 사유 (선택사항)
 * 
 * @throws {AppError} 제외일 생성 실패 시
 * 
 * @example
 * ```typescript
 * await updatePlanExclusions(supabase, groupId, tenantId, [
 *   { exclusion_date: "2025-01-01", exclusion_type: "holiday", reason: "신정" },
 *   { exclusion_date: "2025-03-01", exclusion_type: "exam", reason: null }
 * ]);
 * ```
 */
export async function updatePlanExclusions(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  exclusions: CreationData["exclusions"]
): Promise<void> {
  if (exclusions === undefined) return;

  // 기존 제외일 삭제
  const { error: deleteError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteError) {
    logError(deleteError, {
      function: "updatePlanExclusions",
      groupId,
      action: "deleteExclusions",
    });
  }

  // 새로운 제외일 생성
  if (exclusions.length > 0) {
    const exclusionsResult = await createPlanExclusions(
      groupId,
      tenantId,
      exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason || null,
      }))
    );

    if (!exclusionsResult.success) {
      throw new AppError(
        exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }
}

/**
 * 학원 일정 업데이트
 * 
 * 학생의 학원 일정을 업데이트합니다. 중복 체크를 통해 이미 존재하는 일정은
 * 건너뛰고, 새로운 일정만 추가합니다.
 * 
 * **중복 체크 로직:**
 * - 기존 학원 일정을 조회하여 키로 매핑
 * - 키 형식: `${day_of_week}:${start_time}:${end_time}:${academy_name}:${subject}`
 * - 새로운 일정 중 중복되지 않은 것만 필터링하여 추가
 * 
 * **처리 흐름:**
 * 1. 기존 학원 일정 조회 (`getStudentAcademySchedules`)
 * 2. 기존 일정을 키로 매핑하여 Set 생성
 * 3. 새로운 일정 중 중복되지 않은 것만 필터링
 * 4. 중복되지 않은 일정만 추가 (`createStudentAcademySchedules`)
 * 5. 모든 일정이 이미 존재하면 로그만 출력하고 추가하지 않음
 * 
 * **주의사항:**
 * - `academy_schedules`가 `undefined`이면 아무 작업도 수행하지 않음
 *   (부분 업데이트 지원)
 * - 관리자 모드에서 실행되므로 Admin 클라이언트를 사용하여 RLS 우회
 * 
 * @param supabase - Supabase 클라이언트 (현재는 사용하지 않지만 향후 확장 가능)
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param academySchedules - 새로운 학원 일정 목록 (undefined 가능)
 *   - `day_of_week`: 요일 (0=일요일, 1=월요일, ..., 6=토요일)
 *   - `start_time`: 시작 시간 (HH:mm 형식)
 *   - `end_time`: 종료 시간 (HH:mm 형식)
 *   - `academy_name`: 학원명 (선택사항)
 *   - `subject`: 과목명 (선택사항)
 * 
 * @throws {AppError} 학원 일정 생성 실패 시
 * 
 * @example
 * ```typescript
 * await updateAcademySchedules(supabase, studentId, tenantId, [
 *   { day_of_week: 1, start_time: "18:00", end_time: "20:00", academy_name: "수학 학원", subject: "수학" },
 *   { day_of_week: 3, start_time: "19:00", end_time: "21:00", academy_name: "영어 학원", subject: "영어" }
 * ]);
 * ```
 */
export async function updateAcademySchedules(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
  academySchedules: CreationData["academy_schedules"]
): Promise<void> {
  if (academySchedules === undefined) return;

  // 기존 학원 일정 조회 (중복 체크용)
  const { getStudentAcademySchedules } = await import("@/lib/data/planGroups");
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);

  // 기존 학원 일정을 키로 매핑
  const existingKeys = new Set(
    existingSchedules.map(
      (s) =>
        `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
    )
  );

  // 새로운 학원 일정 중 중복되지 않은 것만 필터링
  const newSchedules = academySchedules.filter((s) => {
    const key = `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`;
    return !existingKeys.has(key);
  });

  console.log("[updateAcademySchedules] 학원 일정 업데이트:", {
    studentId,
    totalSchedules: academySchedules.length,
    existingSchedulesCount: existingSchedules.length,
    newSchedulesCount: newSchedules.length,
    skippedCount: academySchedules.length - newSchedules.length,
  });

  // 중복되지 않은 새로운 학원 일정만 추가 (관리자 모드: Admin 클라이언트 사용)
  if (newSchedules.length > 0) {
    const schedulesResult = await createStudentAcademySchedules(
      studentId,
      tenantId,
      newSchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name || null,
        subject: s.subject || null,
      })),
      true // 관리자 모드: Admin 클라이언트 사용 (RLS 우회)
    );

    if (!schedulesResult.success) {
      throw new AppError(
        schedulesResult.error || "학원 일정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  } else if (academySchedules.length > 0) {
    // 모든 학원 일정이 이미 존재하는 경우 로그만 출력
    console.log("[updateAcademySchedules] 모든 학원 일정이 이미 존재합니다.");
  }
}

