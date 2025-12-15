/**
 * 플랜 생성 실패 원인 분석 및 메시지 매핑 시스템
 */

/**
 * 플랜 생성 실패 원인 타입
 */
export type PlanGenerationFailureReason =
  | {
      type: "insufficient_time";
      week: number;
      dayOfWeek: string;
      date: string;
      requiredMinutes: number;
      availableMinutes: number;
    }
  | {
      type: "insufficient_slots";
      date: string;
      requiredSlots: number;
      availableSlots: number;
    }
  | {
      type: "no_study_days";
      period: string;
      totalDays: number;
      excludedDays: number;
    }
  | {
      type: "content_allocation_failed";
      contentId: string;
      contentType: string;
      reason: string;
    }
  | {
      type: "range_division_failed";
      contentId: string;
      contentType: string;
      totalAmount: number;
      allocatedDates: number;
    }
  | {
      type: "no_plans_generated";
      reason: string;
    }
  | {
      type: "unknown";
      message: string;
    };

/**
 * 날짜를 주차로 변환
 * @param date 날짜 문자열 (YYYY-MM-DD)
 * @param periodStart 기간 시작일 (YYYY-MM-DD)
 * @returns 주차 번호 (1부터 시작)
 */
export function calculateWeekNumber(
  date: string,
  periodStart: string
): number {
  const start = new Date(periodStart);
  const target = new Date(date);

  // 시작일을 주의 첫 번째 날(일요일)로 조정
  const startDay = start.getDay();
  const adjustedStart = new Date(start);
  adjustedStart.setDate(start.getDate() - startDay);

  // 목표일을 주의 첫 번째 날(일요일)로 조정
  const targetDay = target.getDay();
  const adjustedTarget = new Date(target);
  adjustedTarget.setDate(target.getDate() - targetDay);

  // 주차 계산 (밀리초 차이를 일수로 변환 후 7로 나눔)
  const diffTime = adjustedTarget.getTime() - adjustedStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;

  return Math.max(1, weekNumber);
}

/**
 * 요일 번호를 한국어 요일로 변환
 * @param dayOfWeek 0(일요일) ~ 6(토요일)
 * @returns 한국어 요일
 */
export function getDayOfWeekName(dayOfWeek: number): string {
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return days[dayOfWeek] || "알 수 없음";
}

/**
 * PlanGenerationFailureReason을 사용자 친화적인 메시지로 변환
 * @param reason 실패 원인
 * @returns 사용자 친화적인 에러 메시지
 */
export function getPlanGenerationErrorMessage(
  reason: PlanGenerationFailureReason
): string {
  switch (reason.type) {
    case "insufficient_time": {
      const { week, dayOfWeek, date, requiredMinutes, availableMinutes } =
        reason;
      const shortage = requiredMinutes - availableMinutes;
      return `${week}주차 ${dayOfWeek}(${date}) 학습 시간이 부족합니다. 필요한 시간: ${requiredMinutes}분, 사용 가능한 시간: ${availableMinutes}분 (부족: ${shortage}분)`;
    }

    case "insufficient_slots": {
      const { date, requiredSlots, availableSlots } = reason;
      const shortage = requiredSlots - availableSlots;
      return `${date}에 학습 슬롯이 부족합니다. 필요한 슬롯: ${requiredSlots}개, 사용 가능한 슬롯: ${availableSlots}개 (부족: ${shortage}개)`;
    }

    case "no_study_days": {
      const { period, totalDays, excludedDays } = reason;
      return `학습 가능한 날짜가 없습니다. 기간: ${period}, 전체 날짜: ${totalDays}일, 제외된 날짜: ${excludedDays}일`;
    }

    case "content_allocation_failed": {
      const { contentId, contentType, reason: detailReason } = reason;
      return `콘텐츠 배정에 실패했습니다. 콘텐츠 ID: ${contentId}, 유형: ${contentType}, 원인: ${detailReason}`;
    }

    case "range_division_failed": {
      const { contentId, contentType, totalAmount, allocatedDates } = reason;
      return `학습 범위 분할에 실패했습니다. 콘텐츠 ID: ${contentId}, 유형: ${contentType}, 총 범위: ${totalAmount}, 배정된 날짜: ${allocatedDates}개`;
    }

    case "no_plans_generated": {
      return `플랜이 생성되지 않았습니다. 원인: ${reason.reason}`;
    }

    case "unknown": {
      return `플랜 생성 중 알 수 없는 오류가 발생했습니다: ${reason.message}`;
    }

    default: {
      const _exhaustive: never = reason;
      return "플랜 생성에 실패했습니다. 설정을 확인하고 다시 시도해주세요.";
    }
  }
}

/**
 * 여러 실패 원인을 하나의 메시지로 통합
 * @param reasons 실패 원인 배열
 * @returns 통합된 에러 메시지
 */
export function combineFailureReasons(
  reasons: PlanGenerationFailureReason[]
): string {
  if (reasons.length === 0) {
    return "플랜 생성에 실패했습니다. 설정을 확인하고 다시 시도해주세요.";
  }

  if (reasons.length === 1) {
    return getPlanGenerationErrorMessage(reasons[0]);
  }

  // 여러 원인이 있는 경우
  const messages = reasons.map((reason, index) => {
    const message = getPlanGenerationErrorMessage(reason);
    return `${index + 1}. ${message}`;
  });

  return `플랜 생성에 실패했습니다. 다음 문제가 발견되었습니다:\n\n${messages.join("\n")}`;
}

