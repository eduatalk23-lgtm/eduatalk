// 플랜 검증 로직 집중화

import { PlanGroupCreationData, PlanStatus, PlanPurpose, SchedulerType } from "@/lib/types/plan";

/**
 * 검증 결과
 */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * 플랜 검증기 클래스
 */
export class PlanValidator {
  /**
   * 플랜 그룹 생성 데이터 검증
   */
  static validateCreation(data: PlanGroupCreationData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 기간 검증
    const periodValidation = this.validatePeriod(data.period_start, data.period_end);
    errors.push(...periodValidation.errors);
    warnings.push(...periodValidation.warnings);

    // 2. 제외일 검증
    const exclusionValidation = this.validateExclusions(
      data.period_start,
      data.period_end,
      data.exclusions
    );
    errors.push(...exclusionValidation.errors);
    warnings.push(...exclusionValidation.warnings);

    // 3. 콘텐츠 검증
    const contentValidation = this.validateContents(data.contents);
    errors.push(...contentValidation.errors);
    warnings.push(...contentValidation.warnings);

    // 4. 학원 일정 검증
    const academyValidation = this.validateAcademySchedules(data.academy_schedules);
    errors.push(...academyValidation.errors);
    warnings.push(...academyValidation.warnings);

    // 5. 목적과 스케줄러 조합 검증
    const purposeValidation = this.validatePurposeAndScheduler(
      data.plan_purpose,
      data.scheduler_type
    );
    errors.push(...purposeValidation.errors);
    warnings.push(...purposeValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 기간 검증
   */
  static validatePeriod(
    periodStart: string,
    periodEnd: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 시작일이 종료일보다 이후인지
    if (start >= end) {
      errors.push("시작일은 종료일보다 이전이어야 합니다.");
    }

    // 과거 날짜인지
    if (start < today) {
      warnings.push("시작일이 오늘보다 이전입니다. 과거 날짜로 플랜을 생성하시겠습니까?");
    }

    // 기간이 너무 짧은지 (최소 1일)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 1) {
      errors.push("플랜 기간은 최소 1일 이상이어야 합니다.");
    }

    // 기간이 너무 긴지 (최대 365일)
    if (daysDiff > 365) {
      warnings.push("플랜 기간이 1년을 초과합니다. 장기 플랜은 여러 개로 나누는 것을 권장합니다.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 제외일 검증
   */
  static validateExclusions(
    periodStart: string,
    periodEnd: string,
    exclusions: Array<{ exclusion_date: string }>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 제외일이 기간 내에 있는지
    const invalidExclusions = exclusions.filter((ex) => {
      const date = new Date(ex.exclusion_date);
      return date < start || date > end;
    });

    if (invalidExclusions.length > 0) {
      errors.push(
        `제외일 중 ${invalidExclusions.length}개가 플랜 기간 밖에 있습니다.`
      );
    }

    // 제외일 비율 검증 (50% 초과 경고)
    const exclusionRatio = exclusions.length / totalDays;
    if (exclusionRatio > 0.5) {
      warnings.push(
        `제외일이 전체 기간의 ${Math.round(exclusionRatio * 100)}%를 차지합니다. 목표 달성이 어려울 수 있습니다.`
      );
    }

    // 제외일이 너무 많은지 (80% 초과 오류)
    if (exclusionRatio > 0.8) {
      errors.push(
        `제외일이 전체 기간의 ${Math.round(exclusionRatio * 100)}%를 초과합니다. 플랜 기간을 조정해주세요.`
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 콘텐츠 검증
   */
  static validateContents(
    contents: Array<{
      content_type: string;
      content_id: string;
      start_range: number;
      end_range: number;
    }>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 콘텐츠 개수 검증 (최대 9개)
    if (contents.length === 0) {
      errors.push("플랜 대상 콘텐츠를 최소 1개 이상 선택해주세요.");
    }

    if (contents.length > 9) {
      errors.push("플랜 대상 콘텐츠는 최대 9개까지 가능합니다. 학습량이 너무 많습니다.");
    }

    // 각 콘텐츠의 범위 검증
    contents.forEach((content, index) => {
      if (content.start_range >= content.end_range) {
        errors.push(
          `콘텐츠 ${index + 1}: 시작 범위는 종료 범위보다 작아야 합니다.`
        );
      }

      if (content.start_range < 0 || content.end_range < 0) {
        errors.push(`콘텐츠 ${index + 1}: 범위는 0 이상이어야 합니다.`);
      }
    });

    // 중복 콘텐츠 검증
    const contentKeys = contents.map(
      (c) => `${c.content_type}:${c.content_id}`
    );
    const duplicates = contentKeys.filter(
      (key, index) => contentKeys.indexOf(key) !== index
    );
    if (duplicates.length > 0) {
      warnings.push("동일한 콘텐츠가 여러 번 선택되었습니다.");
    }

    // 콘텐츠 개수가 많으면 경고
    if (contents.length > 6) {
      warnings.push(
        "콘텐츠가 6개를 초과합니다. 학습 부담이 클 수 있습니다."
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 학원 일정 검증
   */
  static validateAcademySchedules(
    schedules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    schedules.forEach((schedule, index) => {
      // 요일 검증
      if (schedule.day_of_week < 0 || schedule.day_of_week > 6) {
        errors.push(`학원 일정 ${index + 1}: 올바른 요일을 선택해주세요 (0-6).`);
      }

      // 시간 검증
      const start = this.parseTime(schedule.start_time);
      const end = this.parseTime(schedule.end_time);

      if (!start || !end) {
        errors.push(`학원 일정 ${index + 1}: 올바른 시간 형식을 입력해주세요.`);
      } else if (start >= end) {
        errors.push(`학원 일정 ${index + 1}: 종료 시간은 시작 시간보다 이후여야 합니다.`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 목적과 스케줄러 조합 검증
   */
  static validatePurposeAndScheduler(
    purpose: PlanPurpose,
    schedulerType: SchedulerType
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 내신대비 + 1730_timetable 조합 경고
    if (purpose === "내신대비" && schedulerType === "1730_timetable") {
      warnings.push(
        "내신대비에는 1730 Timetable 방식보다 성적 기반 배정이 더 적합할 수 있습니다."
      );
    }

    // 모의고사/수능 + 자동스케줄러 조합 경고
    if (
      (purpose === "모의고사" || purpose === "수능") &&
      schedulerType === "자동스케줄러"
    ) {
      warnings.push(
        "모의고사/수능 대비에는 1730 Timetable이나 전략/취약과목 조정이 더 적합할 수 있습니다."
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 플랜 상태 전이 검증
   */
  static validateStatusTransition(
    from: PlanStatus,
    to: PlanStatus
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 같은 상태로 전이는 허용 (에러 없이 성공)
    if (from === to) {
      return { valid: true, errors: [], warnings: [] };
    }

    // 허용된 전이 규칙
    const allowedTransitions: Record<PlanStatus, PlanStatus[]> = {
      draft: ["saved", "cancelled"],
      saved: ["active", "draft", "cancelled"],
      active: ["paused", "completed", "cancelled"],
      paused: ["active", "cancelled"],
      completed: [], // 완료 상태는 변경 불가
      cancelled: ["active"], // 중단 상태에서 재개(활성화) 가능
    };

    if (!allowedTransitions[from].includes(to)) {
      errors.push(
        `${from} 상태에서 ${to} 상태로 전이할 수 없습니다.`
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 시간 문자열 파싱 (HH:MM 형식)
   */
  private static parseTime(timeStr: string): number | null {
    const parts = timeStr.split(":");
    if (parts.length !== 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    return hours * 60 + minutes; // 분 단위로 변환
  }

  /**
   * 날짜 차이 계산 (일 단위)
   */
  static calculateDays(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}

