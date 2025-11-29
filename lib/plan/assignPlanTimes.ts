/**
 * 플랜 시간 배치 유틸리티
 * Step7의 TimeSlotsWithPlans 로직을 서버 액션에서 사용하기 위한 함수
 */

// 시간 문자열을 분으로 변환
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 분을 시간 문자열로 변환
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// 플랜의 예상 소요시간 계산
export function calculatePlanEstimatedTime(
  plan: {
    content_type: "book" | "lecture" | "custom";
    content_id?: string | null;  // 추가: content_id 필드
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
  },
  contentDurationMap: Map<string, {
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    total_pages?: number | null;
    duration?: number | null;
    total_page_or_time?: number | null;
  }>,
  dayType?: string
): number {
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null
  ) {
    const baseTime = 60; // 기본값 1시간
    // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  const amount = plan.planned_end_page_or_time - plan.planned_start_page_or_time;
  if (amount <= 0) {
    const baseTime = 60;
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  let baseTime = 0;

  if (plan.content_type === "book") {
    // 책: 1시간당 10페이지 가정
    const pagesPerHour = 10;
    const minutesPerPage = 60 / pagesPerHour;
    baseTime = Math.round(amount * minutesPerPage);
  } else if (plan.content_type === "lecture") {
    // 강의: duration 정보 사용
    const contentInfo = contentDurationMap.get(plan.content_id || "");
    if (contentInfo?.duration && contentInfo.duration > 0) {
      // 강의의 경우 planned_start_page_or_time과 planned_end_page_or_time이 회차를 나타냄
      const episodeCount = amount; // 회차 수
      const totalDuration = contentInfo.duration;
      // 회차당 평균 시간 계산
      baseTime = Math.round(totalDuration / Math.max(episodeCount, 1));
    } else {
      baseTime = 60; // 기본값
    }
  } else {
    baseTime = 60; // 기본값
  }

  // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
  if (dayType === "복습일") {
    return Math.round(baseTime * 0.5);
  }

  return baseTime;
}

// 플랜 시간 배치 결과 타입
export type PlanTimeSegment = {
  plan: {
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    chapter?: string | null;
    block_index?: number;
  };
  start: string; // HH:mm 형식
  end: string; // HH:mm 형식
  isPartial: boolean; // 일부만 배치됨
  isContinued: boolean; // 이전 블록에서 이어서 배치됨
  originalEstimatedTime: number; // 원래 예상 소요시간
};

/**
 * 플랜을 학습시간 슬롯에 배치
 * Step7의 TimeSlotsWithPlans 로직과 동일
 */
export function assignPlanTimes(
  plans: Array<{
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    chapter?: string | null;
    block_index?: number;
  }>,
  studyTimeSlots: Array<{
    start: string;
    end: string;
  }>,
  contentDurationMap: Map<string, {
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    total_pages?: number | null;
    duration?: number | null;
    total_page_or_time?: number | null;
  }>,
  dayType: string,
  totalStudyHours: number
): PlanTimeSegment[] {
  // 플랜 정보 준비
  const plansWithInfo = plans.map((plan) => {
    const estimatedTime = calculatePlanEstimatedTime(plan, contentDurationMap, dayType);
    return {
      plan,
      originalEstimatedTime: estimatedTime,
      estimatedTime, // 배치에 사용할 시간
      remainingTime: estimatedTime, // 남은 시간 추적
      blockIndex: plan.block_index || 0,
    };
  });

  // 복습일이고 예상 소요시간이 총 학습시간보다 큰 경우 평균 시간으로 조정
  const isReviewDay = dayType === "복습일";
  const totalEstimatedTime = plansWithInfo.reduce((sum, p) => sum + p.originalEstimatedTime, 0);
  const totalStudyMinutes = totalStudyHours * 60;

  if (isReviewDay && totalEstimatedTime > totalStudyMinutes && plans.length > 0) {
    // 평균 시간 계산
    const averageTime = Math.floor(totalStudyMinutes / plans.length);
    plansWithInfo.forEach((p) => {
      p.estimatedTime = averageTime;
      p.remainingTime = averageTime;
      // originalEstimatedTime은 그대로 유지 (강조 표시용)
    });
  }

  // 플랜을 block_index 순으로 정렬
  const sortedPlans = [...plansWithInfo].sort((a, b) => {
    return (a.blockIndex || 0) - (b.blockIndex || 0);
  });

  // 각 학습시간 슬롯에 플랜 배치
  const segments: PlanTimeSegment[] = [];

  studyTimeSlots.forEach((slot) => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    let currentTime = slotStart;

    // 플랜 배치
    for (const planInfo of sortedPlans) {
      if (planInfo.remainingTime <= 0) continue;

      const timeToUse = Math.min(planInfo.remainingTime, slotEnd - currentTime);
      if (timeToUse > 0) {
        const wasPartial = planInfo.remainingTime < planInfo.originalEstimatedTime;
        const willBePartial = planInfo.remainingTime > timeToUse;
        
        segments.push({
          plan: planInfo.plan,
          start: minutesToTime(currentTime),
          end: minutesToTime(currentTime + timeToUse),
          isPartial: willBePartial,
          isContinued: wasPartial,
          originalEstimatedTime: planInfo.originalEstimatedTime,
        });
        
        planInfo.remainingTime -= timeToUse;
        currentTime += timeToUse;

        if (currentTime >= slotEnd) break;
      }
    }
  });

  // 시간 순으로 정렬
  segments.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  return segments;
}

