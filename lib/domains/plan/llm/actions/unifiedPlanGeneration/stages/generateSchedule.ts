/**
 * Stage 4: 스케줄 생성
 *
 * SchedulerEngine을 사용하여 실제 학습 플랜을 생성합니다.
 */

import {
  SchedulerEngine,
  type SchedulerContext,
} from "@/lib/scheduler/SchedulerEngine";
import type { SchedulerOptions } from "@/lib/types/plan";
import type {
  ValidatedPlanInput,
  SchedulerContextResult,
  ScheduleGenerationResult,
  StageResult,
} from "../types";

/**
 * Stage 4: 스케줄 생성
 *
 * @param input - 검증된 입력 데이터
 * @param schedulerContext - 스케줄러 컨텍스트
 * @returns 생성된 스케줄 또는 에러
 */
export function generateSchedule(
  input: ValidatedPlanInput,
  schedulerContext: SchedulerContextResult
): StageResult<ScheduleGenerationResult> {
  const { timetableSettings } = input;

  // SchedulerOptions 생성
  const schedulerOptions: SchedulerOptions = {
    study_days: timetableSettings.studyDays,
    review_days: timetableSettings.reviewDays,
    student_level: timetableSettings.studentLevel,
    // content_allocations 설정 (모든 콘텐츠에 동일한 subject_type 적용)
    // "custom" 타입은 content_allocations에서 지원되지 않으므로 필터링
    content_allocations: schedulerContext.contents
      .filter(
        (c): c is typeof c & { content_type: "book" | "lecture" } =>
          c.content_type === "book" || c.content_type === "lecture"
      )
      .map((c) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        subject_type: timetableSettings.subjectType,
        weekly_days: timetableSettings.weeklyDays,
      })),
  };

  // PlanExclusion 형식으로 변환
  // 시스템 내부 exclusion_type을 한글 타입으로 변환
  const mapToKoreanExclusionType = (
    type: string
  ): "휴가" | "개인사정" | "휴일지정" | "기타" => {
    switch (type) {
      case "holiday":
        return "휴일지정";
      case "personal":
        return "개인사정";
      default:
        return "기타";
    }
  };

  const exclusions = schedulerContext.exclusions.map((e) => ({
    id: e.id,
    tenant_id: input.tenantId,
    student_id: input.studentId,
    plan_group_id: null,
    exclusion_date: e.exclusion_date,
    exclusion_type: mapToKoreanExclusionType(e.exclusion_type),
    reason: e.reason,
    created_at: new Date().toISOString(),
  }));

  // AcademySchedule 형식으로 변환
  const academySchedules = schedulerContext.academySchedules.map((s) => ({
    id: s.id,
    tenant_id: input.tenantId,
    student_id: input.studentId,
    academy_id: s.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    subject: s.subject,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // SchedulerContext 생성
  const context: SchedulerContext = {
    periodStart: schedulerContext.periodStart,
    periodEnd: schedulerContext.periodEnd,
    exclusions,
    blocks: schedulerContext.blocks,
    academySchedules,
    contents: schedulerContext.contents,
    options: schedulerOptions,
    subjectTypeMap: schedulerContext.subjectTypeMap,
  };

  // SchedulerEngine 인스턴스 생성 및 실행
  const engine = new SchedulerEngine(context);
  const plans = engine.generate();

  // 실패 원인 수집 - PlanGenerationFailureReason을 간단한 형식으로 변환
  const convertFailureReason = (
    r: ReturnType<typeof engine.getFailureReasons>[number]
  ): { code: string; message: string; context?: Record<string, unknown> } => {
    const type = r.type;
    switch (type) {
      case "insufficient_time":
        return {
          code: type,
          message: `${r.date}(${r.dayOfWeek})에 시간이 부족합니다. 필요: ${r.requiredMinutes}분, 가용: ${r.availableMinutes}분`,
          context: { ...r },
        };
      case "insufficient_slots":
        return {
          code: type,
          message: `${r.date}에 슬롯이 부족합니다. 필요: ${r.requiredSlots}, 가용: ${r.availableSlots}`,
          context: { ...r },
        };
      case "no_study_days":
        return {
          code: type,
          message: `학습 가능한 일자가 없습니다. 기간: ${r.period}, 총 ${r.totalDays}일 중 ${r.excludedDays}일 제외`,
          context: { ...r },
        };
      case "content_allocation_failed":
        return {
          code: type,
          message: `콘텐츠 배정 실패: ${r.contentId} - ${r.reason}`,
          context: { ...r },
        };
      case "range_division_failed":
        return {
          code: type,
          message: `범위 분할 실패: ${r.contentId} - ${r.totalAmount}개를 ${r.allocatedDates}일에 분배 불가`,
          context: { ...r },
        };
      case "no_plans_generated":
        return {
          code: type,
          message: r.reason,
          context: { ...r },
        };
      case "unknown":
        return {
          code: type,
          message: r.message,
          context: { ...r },
        };
      default:
        return {
          code: type,
          message: `스케줄 생성 중 문제 발생: ${type}`,
          context: { ...r },
        };
    }
  };

  const failureReasons = engine.getFailureReasons().map(convertFailureReason);

  // 플랜이 생성되지 않은 경우
  if (plans.length === 0) {
    const errorMessages = failureReasons.map((r) => r.message).join("; ");
    return {
      success: false,
      error: `스케줄 생성 실패: ${errorMessages || "알 수 없는 오류"}`,
      details: { failureReasons },
    };
  }

  // 사이클 정보 추출 (plans에서 추출)
  const cycleDaysMap = new Map<
    string,
    { dayType: "study" | "review" | "exclusion"; cycleDayNumber: number }
  >();

  for (const plan of plans) {
    if (plan.date_type && plan.cycle_day_number != null) {
      cycleDaysMap.set(plan.plan_date, {
        dayType: plan.date_type,
        cycleDayNumber: plan.cycle_day_number,
      });
    }
  }

  const cycleDays = Array.from(cycleDaysMap.entries()).map(([date, info]) => ({
    date,
    dayType: info.dayType,
    cycleDayNumber: info.cycleDayNumber,
  }));

  const result: ScheduleGenerationResult = {
    plans,
    cycleDays,
    failureReasons,
  };

  return { success: true, data: result };
}
