import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerType,
} from "@/lib/types/plan";
import {
  getContentAllocation,
  calculateSubjectAllocationDates,
  divideContentRange,
  calculateStudyReviewCycle,
  type CycleDayInfo,
} from "@/lib/plan/1730TimetableLogic";

export type BlockInfo = {
  id: string;
  day_of_week: number;
  block_index: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  plan_date?: string; // 날짜별 블록을 구분하기 위해 추가 (Step 2.5 스케줄 결과 사용 시)
};

export type ContentInfo = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  total_amount: number; // end_range - start_range
  subject?: string | null; // 과목명 (전략과목/취약과목 로직용)
  subject_category?: string | null; // 과목 카테고리
};

export type ScheduledPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter?: string | null;
  is_reschedulable: boolean;
  start_time?: string; // HH:mm 형식
  end_time?: string; // HH:mm 형식
};

/**
 * 플랜 그룹에서 개별 플랜 생성
 */
export type DateAvailableTimeRanges = Map<string, Array<{ start: string; end: string }>>;
export type DateTimeSlots = Map<string, Array<{
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
}>>;

/**
 * 콘텐츠 소요시간 정보
 */
export type ContentDurationInfo = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  total_pages?: number | null; // 책의 경우
  duration?: number | null; // 강의의 경우 (분)
  total_page_or_time?: number | null; // 커스텀의 경우
};

export type ContentDurationMap = Map<string, ContentDurationInfo>;

export function generatePlansFromGroup(
  group: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  blocks: BlockInfo[],
  contentSubjects?: Map<string, { subject?: string | null; subject_category?: string | null }>,
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges, // Step 2.5 스케줄 결과 (날짜별 사용 가능 시간 범위)
  dateTimeSlots?: DateTimeSlots, // Step 2.5 스케줄 결과 (날짜별 시간 타임라인)
  contentDurationMap?: ContentDurationMap // 콘텐츠 소요시간 정보
): ScheduledPlan[] {
  // 1. 학습 가능한 날짜 목록 생성 (제외일 제외)
  const availableDates = calculateAvailableDates(
    group.period_start,
    group.period_end,
    exclusions
  );

  if (availableDates.length === 0) {
    throw new Error("학습 가능한 날짜가 없습니다. 기간과 제외일을 확인해주세요.");
  }

  // 2. 콘텐츠 정보 변환 (과목 정보 포함)
  const contentInfos: ContentInfo[] = contents.map((c) => {
    const subjectInfo = contentSubjects?.get(c.content_id);
    return {
      content_type: c.content_type,
      content_id: c.content_id,
      start_range: c.start_range,
      end_range: c.end_range,
      total_amount: c.end_range - c.start_range,
      subject: subjectInfo?.subject || null,
      subject_category: subjectInfo?.subject_category || null,
    };
  });

  // 3. 스케줄러 유형별로 플랜 생성
  let plans: ScheduledPlan[] = [];
  switch (group.scheduler_type) {
    case "1730_timetable":
      plans = generate1730TimetablePlans(
        availableDates,
        contentInfos,
        blocks,
        academySchedules,
        exclusions,
        group.scheduler_options,
        riskIndexMap,
        dateAvailableTimeRanges,
        dateTimeSlots,
        contentDurationMap
      );
      break;
    default:
      plans = generateDefaultPlans(
        availableDates,
        contentInfos,
        blocks,
        academySchedules,
        exclusions,
        riskIndexMap,
        dateAvailableTimeRanges,
        dateTimeSlots,
        contentDurationMap
      );
      break;
  }

  // 4. 추가 기간 재배치 처리 (복습의 복습)
  const additionalReallocation = (group as any).additional_period_reallocation as {
    period_start: string;
    period_end: string;
    type: "additional_review";
    original_period_start: string;
    original_period_end: string;
    subjects?: string[];
    review_of_review_factor?: number;
  } | null | undefined;

  if (additionalReallocation && additionalReallocation.type === "additional_review") {
    const reallocatedPlans = generateAdditionalPeriodReallocationPlans(
      plans,
      additionalReallocation,
      group,
      exclusions,
      blocks,
      academySchedules,
      contentSubjects,
      riskIndexMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap
    );
    plans = [...plans, ...reallocatedPlans];
  }

  return plans;
}

/**
 * 추가 기간 재배치 플랜 생성 (복습의 복습)
 */
function generateAdditionalPeriodReallocationPlans(
  originalPlans: ScheduledPlan[],
  reallocation: {
    period_start: string;
    period_end: string;
    type: "additional_review";
    original_period_start: string;
    original_period_end: string;
    subjects?: string[];
    review_of_review_factor?: number;
  },
  group: PlanGroup,
  exclusions: PlanExclusion[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  contentSubjects?: Map<string, { subject?: string | null; subject_category?: string | null }>,
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap
): ScheduledPlan[] {
  const reallocatedPlans: ScheduledPlan[] = [];
  const reviewOfReviewFactor = reallocation.review_of_review_factor ?? 0.25;

  // 1. 원본 플랜 기간의 플랜들을 필터링 (원본 기간 내의 플랜만)
  const originalPeriodPlans = originalPlans.filter((plan) => {
    const planDate = new Date(plan.plan_date);
    const originalStart = new Date(reallocation.original_period_start);
    const originalEnd = new Date(reallocation.original_period_end);
    return planDate >= originalStart && planDate <= originalEnd;
  });

  if (originalPeriodPlans.length === 0) {
    console.warn("[scheduler] 추가 기간 재배치: 원본 플랜이 없습니다.");
    return reallocatedPlans;
  }

  // 2. 원본 플랜들을 콘텐츠별로 그룹화
  const plansByContent = new Map<string, ScheduledPlan[]>();
  for (const plan of originalPeriodPlans) {
    const key = `${plan.content_type}:${plan.content_id}`;
    if (!plansByContent.has(key)) {
      plansByContent.set(key, []);
    }
    plansByContent.get(key)!.push(plan);
  }

  // 3. 과목 필터링 (지정된 경우)
  const targetSubjects = reallocation.subjects && reallocation.subjects.length > 0
    ? new Set(reallocation.subjects.map(s => s.toLowerCase().trim()))
    : null;

  // 4. 추가 기간의 날짜 목록 생성 (제외일 제외)
  const additionalDates = calculateAvailableDatesSimple(
    reallocation.period_start,
    reallocation.period_end,
    exclusions
  );

  if (additionalDates.length === 0) {
    console.warn("[scheduler] 추가 기간 재배치: 학습 가능한 날짜가 없습니다.");
    return reallocatedPlans;
  }

  // 5. 추가 기간의 학습일/복습일 분류 (1730_timetable인 경우)
  const studyDays = (group.scheduler_options as any)?.study_days ?? 6;
  const reviewDays = (group.scheduler_options as any)?.review_days ?? 1;
  const weekSize = studyDays + reviewDays;

  const additionalStudyDates: string[] = [];
  const additionalReviewDates: string[] = [];

  // 주차별로 학습일/복습일 분류 (기본적으로 1730 Timetable 패턴 적용)
  const weeks: string[][] = [];
  for (let i = 0; i < additionalDates.length; i += weekSize) {
    weeks.push(additionalDates.slice(i, i + weekSize));
  }

  weeks.forEach((weekDates) => {
    const studyDaysList = weekDates.slice(0, studyDays);
    const reviewDaysList = weekDates.slice(studyDays, weekSize);
    additionalStudyDates.push(...studyDaysList);
    additionalReviewDates.push(...reviewDaysList);
  });

  // 6. 각 콘텐츠별로 재배치 플랜 생성
  for (const [contentKey, contentPlans] of plansByContent.entries()) {
    const [contentType, contentId] = contentKey.split(":");
    
    // 과목 필터링
    if (targetSubjects) {
      const subjectInfo = contentSubjects?.get(contentId);
      const subjectCategory = subjectInfo?.subject_category?.toLowerCase().trim();
      if (!subjectCategory || !targetSubjects.has(subjectCategory)) {
        continue;
      }
    }

    // 원본 플랜의 총 학습 범위 계산
    let totalStartRange = Infinity;
    let totalEndRange = -Infinity;
    for (const plan of contentPlans) {
      totalStartRange = Math.min(totalStartRange, plan.planned_start_page_or_time);
      totalEndRange = Math.max(totalEndRange, plan.planned_end_page_or_time);
    }

    const totalRange = totalEndRange - totalStartRange;
    if (totalRange <= 0) {
      continue;
    }

    // 원본 플랜의 총 소요시간 계산 (contentDurationMap 사용)
    let originalTotalDuration = 0;
    if (contentDurationMap) {
      const durationInfo = contentDurationMap.get(contentId);
      if (durationInfo) {
        // 페이지당 또는 시간당 소요시간 계산
        if (contentType === "book" && durationInfo.total_pages) {
          const minutesPerPage = durationInfo.duration ? durationInfo.duration / durationInfo.total_pages : 1;
          originalTotalDuration = totalRange * minutesPerPage;
        } else if (contentType === "lecture" && durationInfo.duration) {
          // 강의의 경우 범위가 시간(분) 단위
          originalTotalDuration = totalRange;
        } else {
          // 기본값: 범위당 1분
          originalTotalDuration = totalRange;
        }
      }
    } else {
      // contentDurationMap이 없으면 기본값 사용
      originalTotalDuration = totalRange;
    }

    // 7. 추가 기간 학습일에 재배치
    const studyDaysCount = additionalStudyDates.length;
    if (studyDaysCount > 0) {
      const dailyRange = totalRange / studyDaysCount;
      const dailyOriginalDuration = originalTotalDuration / studyDaysCount;
      const dailyReallocatedDuration = dailyOriginalDuration * reviewOfReviewFactor;

      let currentStart = totalStartRange;
      for (let i = 0; i < studyDaysCount; i++) {
        const date = additionalStudyDates[i];
        const isLastDay = i === studyDaysCount - 1;
        const dayRange = isLastDay ? (totalEndRange - currentStart) : dailyRange;
        const dayEnd = currentStart + dayRange;

        // 사용 가능한 시간 범위 조회
        const availableRanges = dateAvailableTimeRanges?.get(date) || [];
        if (availableRanges.length === 0) {
          currentStart = dayEnd;
          continue;
        }

        // 첫 번째 사용 가능한 시간 범위 사용
        const firstRange = availableRanges[0];
        const startTime = firstRange.start;
        
        // 소요시간을 고려하여 종료 시간 계산
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = startMinutes + Math.ceil(dailyReallocatedDuration);
        const endTime = minutesToTime(endMinutes);

        // 블록 인덱스 계산 (날짜별로 순차적으로 증가)
        let blockIndex = 0;
        for (const existingPlan of reallocatedPlans) {
          if (existingPlan.plan_date === date) {
            blockIndex = Math.max(blockIndex, existingPlan.block_index + 1);
          }
        }

        reallocatedPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: contentType as "book" | "lecture" | "custom",
          content_id: contentId,
          planned_start_page_or_time: Math.round(currentStart),
          planned_end_page_or_time: Math.round(dayEnd),
          chapter: null,
          is_reschedulable: true,
          start_time: startTime,
          end_time: endTime,
        });

        currentStart = dayEnd;
      }
    }

    // 8. 추가 기간 복습일에 재배치 (1730_timetable인 경우)
    if (group.scheduler_type === "1730_timetable" && additionalReviewDates.length > 0) {
      const reviewDaysCount = additionalReviewDates.length;
      const reviewRange = totalRange; // 전체 범위 복습
      const reviewOriginalDuration = originalTotalDuration;
      
      // 복습 보정 계수 (기본값: 0.4)
      const reviewFactor = 0.4;
      const reviewDuration = reviewOriginalDuration * reviewFactor * reviewOfReviewFactor;

      for (let i = 0; i < reviewDaysCount; i++) {
        const date = additionalReviewDates[i];
        
        // 사용 가능한 시간 범위 조회
        const availableRanges = dateAvailableTimeRanges?.get(date) || [];
        if (availableRanges.length === 0) {
          continue;
        }

        // 첫 번째 사용 가능한 시간 범위 사용
        const firstRange = availableRanges[0];
        const startTime = firstRange.start;
        
        // 소요시간을 고려하여 종료 시간 계산
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = startMinutes + Math.ceil(reviewDuration);
        const endTime = minutesToTime(endMinutes);

        // 블록 인덱스 계산
        let blockIndex = 0;
        for (const existingPlan of reallocatedPlans) {
          if (existingPlan.plan_date === date) {
            blockIndex = Math.max(blockIndex, existingPlan.block_index + 1);
          }
        }

        reallocatedPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: contentType as "book" | "lecture" | "custom",
          content_id: contentId,
          planned_start_page_or_time: Math.round(totalStartRange),
          planned_end_page_or_time: Math.round(totalEndRange),
          chapter: null,
          is_reschedulable: true,
          start_time: startTime,
          end_time: endTime,
        });
      }
    }
  }

  return reallocatedPlans;
}

/**
 * 날짜 범위의 모든 날짜 생성 (제외일 제외) - 간단한 버전
 */
function calculateAvailableDatesSimple(
  periodStart: string,
  periodEnd: string,
  exclusions: PlanExclusion[]
): string[] {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const dates: string[] = [];
  const exclusionDates = new Set(exclusions.map(e => e.exclusion_date));

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dateStr = formatDateSimple(current);
    if (!exclusionDates.has(dateStr)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환 - 간단한 버전
 */
function formatDateSimple(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 시간 문자열을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 콘텐츠의 특정 범위에 대한 소요시간 계산 (분 단위)
 * - 강의: duration 사용
 * - 책: 페이지당 기본 2분 (총 페이지 수 기반)
 * - 커스텀: total_page_or_time 사용 (페이지면 2분/페이지, 시간이면 그대로)
 */
function calculateContentDuration(
  content: ContentInfo,
  startPageOrTime: number,
  endPageOrTime: number,
  durationMap?: ContentDurationMap
): number {
  const durationInfo = durationMap?.get(content.content_id);
  const amount = endPageOrTime - startPageOrTime;

  if (content.content_type === "lecture") {
    // 강의: duration 정보 사용
    if (durationInfo?.duration) {
      // 전체 강의 시간을 전체 회차로 나눈 값 * 배정된 회차 수
      // TODO: 실제로는 강의별 회차당 시간을 조회해야 하지만, 여기서는 간단히 처리
      // duration이 전체 강의 시간이면, 전체 회차 수를 알아야 함
      // 일단 duration을 그대로 사용 (전체 강의 시간이라고 가정)
      return Math.round((durationInfo.duration / (content.end_range - content.start_range)) * amount);
    }
    // duration 정보가 없으면 기본값: 회차당 30분
    return amount * 30;
  } else if (content.content_type === "book") {
    // 책: 페이지당 기본 2분
    return amount * 2;
  } else {
    // 커스텀: total_page_or_time이 페이지면 2분/페이지, 시간이면 그대로
    if (durationInfo?.total_page_or_time) {
      // total_page_or_time이 100 이상이면 페이지로 간주, 아니면 시간(분)으로 간주
      if (durationInfo.total_page_or_time >= 100) {
        return amount * 2; // 페이지당 2분
      } else {
        // 시간(분)으로 간주: 전체 시간을 전체 범위로 나눈 값 * 배정된 범위
        return Math.round((durationInfo.total_page_or_time / (content.end_range - content.start_range)) * amount);
      }
    }
    // 정보가 없으면 기본값: 페이지당 2분
    return amount * 2;
  }
}

/**
 * 학습 가능한 날짜 목록 계산 (제외일 제외)
 */
function calculateAvailableDates(
  periodStart: string,
  periodEnd: string,
  exclusions: PlanExclusion[]
): string[] {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const exclusionDates = new Set(
    exclusions.map((e) => e.exclusion_date.split("T")[0])
  );

  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!exclusionDates.has(dateStr)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 기본 스케줄러: 학습 범위를 학습일로 나누어 배정
 */
function generateDefaultPlans(
  dates: string[],
  contents: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap
): ScheduledPlan[] {
  const plans: ScheduledPlan[] = [];
  const totalStudyDays = dates.length;

  if (totalStudyDays === 0 || contents.length === 0) {
    return plans;
  }

  // 1. 콘텐츠별 일일 배정량 계산 (학습 범위를 학습일로 나누기)
  const contentDailyAmounts = new Map<string, number[]>();
  contents.forEach((content) => {
    const dailyAmount = Math.round(content.total_amount / totalStudyDays);
    const amounts: number[] = [];
    let remaining = content.total_amount;
    let currentStart = content.start_range;

    for (let i = 0; i < totalStudyDays; i++) {
      const amount = i === totalStudyDays - 1 ? remaining : dailyAmount;
      amounts.push(amount);
      remaining -= amount;
    }

    contentDailyAmounts.set(content.content_id, amounts);
  });

  // 2. 취약과목 우선 배정 (Risk Index 기반)
  const sortedContents = [...contents].sort((a, b) => {
    const aSubject = a.subject?.toLowerCase().trim() || "";
    const bSubject = b.subject?.toLowerCase().trim() || "";
    const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
    const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
    return bRisk - aRisk; // 위험도가 높은 순서대로
  });

  // 3. 각 날짜별로 콘텐츠 배정 (먼저 플랜 생성, 블록은 나중에 동적 생성)
  const plansByDate = new Map<string, Array<{
    content: ContentInfo;
    dailyAmount: number;
    currentStart: number;
  }>>();

  dates.forEach((date, dateIndex) => {
    const datePlans: Array<{
      content: ContentInfo;
      dailyAmount: number;
      currentStart: number;
    }> = [];

    sortedContents.forEach((content) => {
      const dailyAmounts = contentDailyAmounts.get(content.content_id) || [];
      const dailyAmount = dailyAmounts[dateIndex] || 0;

      if (dailyAmount === 0) return;

      const currentStart = content.start_range + dailyAmounts.slice(0, dateIndex).reduce((sum, amt) => sum + amt, 0);
      
      datePlans.push({
        content,
        dailyAmount,
        currentStart,
      });
    });

    if (datePlans.length > 0) {
      plansByDate.set(date, datePlans);
    }
  });

  // 4. 각 날짜별로 필요한 만큼 블록을 동적으로 생성하고 플랜에 할당
  plansByDate.forEach((datePlans, date) => {
    // Step 2.5의 available_time_ranges 사용 (있으면)
    const availableRanges = dateAvailableTimeRanges?.get(date) || [];
    
    // 사용 가능한 시간 범위가 없으면 기존 방식 사용
    if (availableRanges.length === 0) {
      // 기존 방식: 요일별 블록 사용
      const dayOfWeek = new Date(date).getDay();
      const dayBlocks = blocks.filter((b) => b.day_of_week === dayOfWeek);
      const availableBlocks = filterBlocksByAcademySchedule(
        dayBlocks,
        date,
        academySchedules
      );

      if (availableBlocks.length === 0) return;

      availableBlocks.sort((a, b) => a.block_index - b.block_index);
      const totalBlockDuration = availableBlocks.reduce(
        (sum, block) => sum + block.duration_minutes,
        0
      );

      let blockIndex = 0;
      let currentBlockDuration = 0;

      datePlans.forEach(({ content, dailyAmount, currentStart: start }) => {
        const contentDuration = Math.round(
          (dailyAmount / content.total_amount) * totalBlockDuration
        );

        let remainingDuration = contentDuration;
        let currentStart = start;

        while (remainingDuration > 0 && blockIndex < availableBlocks.length) {
          const block = availableBlocks[blockIndex];
          const blockRemaining = block.duration_minutes - currentBlockDuration;
          const assignedDuration = Math.min(remainingDuration, blockRemaining);

          const amountRatio = assignedDuration / contentDuration;
          const assignedAmount = Math.round(dailyAmount * amountRatio);
          const endAmount = Math.min(
            currentStart + assignedAmount,
            content.end_range
          );

          plans.push({
            plan_date: date,
            block_index: block.block_index,
            content_type: content.content_type,
            content_id: content.content_id,
            planned_start_page_or_time: currentStart,
            planned_end_page_or_time: endAmount,
            is_reschedulable: true,
            start_time: block.start_time, // 블록의 시작 시간
            end_time: block.end_time, // 블록의 종료 시간
          });

          currentStart = endAmount;
          remainingDuration -= assignedDuration;
          currentBlockDuration += assignedDuration;

          if (currentBlockDuration >= block.duration_minutes) {
            blockIndex++;
            currentBlockDuration = 0;
          }
        }
      });
    } else {
      // Step 2.5 스케줄 결과 사용: 콘텐츠 소요시간에 맞춰 시간 배정
      // time_slots에서 "학습시간" 슬롯만 추출하여 사용
      const timeSlots = dateTimeSlots?.get(date) || [];
      const studyTimeSlots = timeSlots.filter((slot) => slot.type === "학습시간");
      
      let slotIndex = 0;
      let blockIndex = 1; // 동적으로 생성되는 블록 인덱스
      let currentSlotPosition = 0; // 현재 슬롯 내에서 사용한 시간 (분)

      datePlans.forEach(({ content, dailyAmount, currentStart: start }) => {
        // 콘텐츠 소요시간 계산
        const endPageOrTime = Math.min(start + dailyAmount, content.end_range);
        const requiredMinutes = calculateContentDuration(
          content,
          start,
          endPageOrTime,
          contentDurationMap
        );

        let remainingMinutes = requiredMinutes;

        // 학습시간 슬롯이 있으면 사용, 없으면 available_time_ranges 사용
        if (studyTimeSlots.length > 0) {
          while (remainingMinutes > 0 && slotIndex < studyTimeSlots.length) {
            const slot = studyTimeSlots[slotIndex];
            const slotStart = timeToMinutes(slot.start);
            const slotEnd = timeToMinutes(slot.end);
            const slotAvailable = slotEnd - slotStart - currentSlotPosition;
            const slotUsed = Math.min(remainingMinutes, slotAvailable);

            const planStartTime = minutesToTime(slotStart + currentSlotPosition);
            const planEndTime = minutesToTime(slotStart + currentSlotPosition + slotUsed);

            plans.push({
              plan_date: date,
              block_index: blockIndex,
              content_type: content.content_type,
              content_id: content.content_id,
              planned_start_page_or_time: start,
              planned_end_page_or_time: endPageOrTime,
              is_reschedulable: true,
              start_time: planStartTime,
              end_time: planEndTime,
            });

            remainingMinutes -= slotUsed;
            currentSlotPosition += slotUsed;
            blockIndex++;

            // 현재 슬롯을 모두 사용했으면 다음 슬롯으로
            if (currentSlotPosition >= (slotEnd - slotStart)) {
              slotIndex++;
              currentSlotPosition = 0;
            }
          }
        } else {
          // 학습시간 슬롯이 없으면 available_time_ranges 사용 (기존 방식)
          if (slotIndex >= availableRanges.length) {
            slotIndex = availableRanges.length - 1;
          }

          const timeRange = availableRanges[slotIndex];
          const startMinutes = timeToMinutes(timeRange.start);
          const endMinutes = timeToMinutes(timeRange.end);
          const rangeDuration = endMinutes > startMinutes ? endMinutes - startMinutes : 60;

          // 소요시간이 범위보다 작으면 해당 시간만큼만 사용
          const actualDuration = Math.min(requiredMinutes, rangeDuration);
          const planStartTime = minutesToTime(startMinutes + currentSlotPosition);
          const planEndTime = minutesToTime(startMinutes + currentSlotPosition + actualDuration);

          plans.push({
            plan_date: date,
            block_index: blockIndex,
            content_type: content.content_type,
            content_id: content.content_id,
            planned_start_page_or_time: start,
            planned_end_page_or_time: endPageOrTime,
            is_reschedulable: true,
            start_time: planStartTime,
            end_time: planEndTime,
          });

          currentSlotPosition += actualDuration;
          blockIndex++;

          // 현재 범위를 모두 사용했으면 다음 범위로
          if (currentSlotPosition >= rangeDuration) {
            slotIndex++;
            currentSlotPosition = 0;
          }
        }
      });
    }
  });

  return plans;
}

/**
 * 1730 Timetable 스케줄러: 학습 범위를 학습일로 나누고 복습일에는 해당 주차 범위 복습
 */
function generate1730TimetablePlans(
  dates: string[],
  contents: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  options?: any,
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap
): ScheduledPlan[] {
  const plans: ScheduledPlan[] = [];
  const studyDays = options?.study_days ?? 6;
  const reviewDays = options?.review_days ?? 1;
  const weekSize = studyDays + reviewDays;

  // 전략과목/취약과목 설정 추출
  const subjectAllocations = options?.subject_allocations;
  const contentAllocations = options?.content_allocations;

  console.log("[generate1730TimetablePlans] 전략과목/취약과목 설정:", {
    hasSubjectAllocations: !!subjectAllocations,
    subjectAllocationsCount: subjectAllocations?.length || 0,
    hasContentAllocations: !!contentAllocations,
    contentAllocationsCount: contentAllocations?.length || 0,
    subjectAllocations: subjectAllocations,
    contentAllocations: contentAllocations,
  });

  // 학습일/복습일 주기 정보 생성
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];
  const cycleDays = calculateStudyReviewCycle(
    periodStart,
    periodEnd,
    { study_days: studyDays, review_days: reviewDays },
    exclusions
  );

  // 취약과목 집중 모드 확인
  const weakSubjectFocus = options?.weak_subject_focus === "high" || options?.weak_subject_focus === true;
  
  // 취약과목 필터링 (Risk Score 30 이상)
  let filteredContents = contents;
  if (weakSubjectFocus && riskIndexMap) {
    filteredContents = contents.filter((content) => {
      const subject = content.subject?.toLowerCase().trim() || "";
      const risk = riskIndexMap.get(subject);
      return risk && risk.riskScore >= 30;
    });

    // 필터링 결과가 없으면 전체 콘텐츠 사용
    if (filteredContents.length === 0) {
      filteredContents = contents;
    }
  }

  // 콘텐츠별 배정 날짜 계산 (전략과목/취약과목 설정 반영)
  const contentAllocationMap = new Map<string, string[]>();
  filteredContents.forEach((content) => {
    const allocation = getContentAllocation(
      {
        content_type: content.content_type,
        content_id: content.content_id,
        subject_category: content.subject_category || undefined,
      },
      contentAllocations,
      subjectAllocations
    );

    console.log("[generate1730TimetablePlans] 콘텐츠 배정 설정:", {
      content_id: content.content_id,
      content_type: content.content_type,
      subject: content.subject,
      subject_category: content.subject_category,
      allocation,
    });

    // SubjectAllocation 형식으로 변환
    const subjectAlloc = {
      subject_id: content.content_id, // 임시 ID
      subject_name: content.subject_category || content.subject || "",
      subject_type: allocation.subject_type,
      weekly_days: allocation.weekly_days,
    };

    const allocatedDates = calculateSubjectAllocationDates(
      cycleDays,
      subjectAlloc
    );

    const totalStudyDates = cycleDays.filter((d) => d.day_type === "study").length;
    console.log("[generate1730TimetablePlans] 배정 날짜 계산 결과:", {
      content_id: content.content_id,
      subject_type: allocation.subject_type,
      weekly_days: allocation.weekly_days,
      allocatedDatesCount: allocatedDates.length,
      totalStudyDatesCount: totalStudyDates,
      allocatedDates: allocatedDates.slice(0, 10), // 처음 10개만
    });

    contentAllocationMap.set(content.content_id, allocatedDates);
  });

  // 학습 범위 분할 (배정된 날짜에 학습 범위 분배)
  const contentRangeMap = new Map<string, Map<string, { start: number; end: number }>>();
  filteredContents.forEach((content) => {
    const allocatedDates = contentAllocationMap.get(content.content_id) || [];
    const rangeMap = divideContentRange(
      content.total_amount,
      allocatedDates,
      content.content_id
    );
    // start_range를 기준으로 오프셋 적용
    const adjustedRangeMap = new Map<string, { start: number; end: number }>();
    rangeMap.forEach((range, date) => {
      adjustedRangeMap.set(date, {
        start: content.start_range + range.start,
        end: content.start_range + range.end,
      });
    });
    contentRangeMap.set(content.content_id, adjustedRangeMap);
  });

  // 주차별로 그룹화
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += weekSize) {
    weeks.push(dates.slice(i, i + weekSize));
  }

  // 각 주차별로 학습일과 복습일 분리
  weeks.forEach((weekDates, weekIndex) => {
    const studyDaysList = weekDates.slice(0, studyDays); // 처음 N일은 학습
    const reviewDaysList = weekDates.slice(studyDays, weekSize); // 나머지는 복습

    // 이번 주 학습일에 배정된 콘텐츠 범위 저장 (복습용)
    const weekContentRanges = new Map<string, {
      startAmount: number;
      endAmount: number;
    }>();

    // 1. 학습일: 배정된 날짜에만 플랜 생성 (전략과목/취약과목 설정 반영)
    // 취약과목 우선 배정 (정렬)
    const sortedContents = [...filteredContents].sort((a, b) => {
      const aSubject = a.subject?.toLowerCase().trim() || "";
      const bSubject = b.subject?.toLowerCase().trim() || "";
      const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
      const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
      return bRisk - aRisk;
    });

    // 배정된 날짜별로 플랜 생성
    const studyPlansByDate = new Map<string, Array<{
      content: ContentInfo;
      start: number;
      end: number;
    }>>();

    // 각 콘텐츠의 배정된 날짜에 대해 플랜 생성
    sortedContents.forEach((content) => {
      const rangeMap = contentRangeMap.get(content.content_id);
      if (!rangeMap) return;

      rangeMap.forEach((range, date) => {
        // 이번 주의 학습일에 포함되는 날짜인지 확인
        if (!studyDaysList.includes(date)) return;

        if (!studyPlansByDate.has(date)) {
          studyPlansByDate.set(date, []);
        }
        studyPlansByDate.get(date)!.push({
          content,
          start: range.start,
          end: range.end,
        });
      });
    });

    // 학습일 플랜에 블록 할당 (동적 생성)
    studyPlansByDate.forEach((datePlans, date) => {
      const availableRanges = dateAvailableTimeRanges?.get(date) || [];
      const timeSlots = dateTimeSlots?.get(date) || [];
      const studyTimeSlots = timeSlots.filter((slot) => slot.type === "학습시간");
      
      let slotIndex = 0;
      let blockIndex = 1;
      let currentSlotPosition = 0;

      datePlans.forEach(({ content, start, end: endAmount }) => {
        
        // 콘텐츠 소요시간 계산
        const requiredMinutes = calculateContentDuration(
          content,
          start,
          endAmount,
          contentDurationMap
        );

        let remainingMinutes = requiredMinutes;

        // 학습시간 슬롯이 있으면 사용, 없으면 available_time_ranges 사용
        if (studyTimeSlots.length > 0) {
          while (remainingMinutes > 0 && slotIndex < studyTimeSlots.length) {
            const slot = studyTimeSlots[slotIndex];
            const slotStart = timeToMinutes(slot.start);
            const slotEnd = timeToMinutes(slot.end);
            const slotAvailable = slotEnd - slotStart - currentSlotPosition;
            const slotUsed = Math.min(remainingMinutes, slotAvailable);

            const planStartTime = minutesToTime(slotStart + currentSlotPosition);
            const planEndTime = minutesToTime(slotStart + currentSlotPosition + slotUsed);

            plans.push({
              plan_date: date,
              block_index: blockIndex,
              content_type: content.content_type,
              content_id: content.content_id,
              planned_start_page_or_time: start,
              planned_end_page_or_time: endAmount,
              is_reschedulable: true,
              start_time: planStartTime,
              end_time: planEndTime,
            });

            remainingMinutes -= slotUsed;
            currentSlotPosition += slotUsed;
            blockIndex++;

            if (currentSlotPosition >= (slotEnd - slotStart)) {
              slotIndex++;
              currentSlotPosition = 0;
            }
          }
        } else {
          // 학습시간 슬롯이 없으면 available_time_ranges 사용
          if (slotIndex >= availableRanges.length) {
            slotIndex = availableRanges.length - 1;
          }

          const timeRange = availableRanges[slotIndex] || { start: "10:00", end: "19:00" };
          const startMinutes = timeToMinutes(timeRange.start);
          const endMinutes = timeToMinutes(timeRange.end);
          const rangeDuration = endMinutes > startMinutes ? endMinutes - startMinutes : 60;
          const actualDuration = Math.min(requiredMinutes, rangeDuration);
          const planStartTime = minutesToTime(startMinutes + currentSlotPosition);
          const planEndTime = minutesToTime(startMinutes + currentSlotPosition + actualDuration);

          plans.push({
            plan_date: date,
            block_index: blockIndex,
            content_type: content.content_type,
            content_id: content.content_id,
            planned_start_page_or_time: start,
            planned_end_page_or_time: endAmount,
            is_reschedulable: true,
            start_time: planStartTime,
            end_time: planEndTime,
          });

          currentSlotPosition += actualDuration;
          blockIndex++;

          if (currentSlotPosition >= rangeDuration) {
            slotIndex++;
            currentSlotPosition = 0;
          }
        }

        // 주차별 범위 저장 (복습용) - 이번 주에 배정된 날짜의 범위만 저장
        if (studyDaysList.includes(date)) {
          if (!weekContentRanges.has(content.content_id)) {
            weekContentRanges.set(content.content_id, {
              startAmount: start,
              endAmount: endAmount,
            });
          } else {
            const existing = weekContentRanges.get(content.content_id)!;
            existing.startAmount = Math.min(existing.startAmount, start);
            existing.endAmount = Math.max(existing.endAmount, endAmount);
          }
        }
      });
    });

    // 2. 복습일: 해당 주차의 학습 범위를 복습
    reviewDaysList.forEach((reviewDay) => {
      if (!reviewDay || weekContentRanges.size === 0) return;

      // 복습 콘텐츠 목록 생성 (이번 주에 학습한 콘텐츠만)
      const reviewContents = sortedContents.filter((content) =>
        weekContentRanges.has(content.content_id)
      );

      if (reviewContents.length === 0) return;

      // Step 2.5 스케줄 결과 사용: 복습 콘텐츠 개수만큼 블록을 동적으로 생성
      const availableRanges = dateAvailableTimeRanges?.get(reviewDay) || [];
      let rangeIndex = 0;
      let blockIndex = 1;

      reviewContents.forEach((content) => {
        const range = weekContentRanges.get(content.content_id);
        if (!range) return;

        if (rangeIndex >= availableRanges.length) {
          rangeIndex = availableRanges.length - 1;
        }

        const timeRange = availableRanges[rangeIndex] || { start: "10:00", end: "19:00" };

        plans.push({
          plan_date: reviewDay,
          block_index: blockIndex,
          content_type: content.content_type,
          content_id: content.content_id,
          planned_start_page_or_time: range.startAmount,
          planned_end_page_or_time: range.endAmount,
          is_reschedulable: true,
          start_time: timeRange.start, // Step 2.5 스케줄 결과의 시작 시간
          end_time: timeRange.end, // Step 2.5 스케줄 결과의 종료 시간
        });

        blockIndex++;
        rangeIndex++;
      });
    });
  });

  return plans;
}

/**
 * 학원 일정과 겹치는 블록 필터링
 */
export function filterBlocksByAcademySchedule(
  blocks: BlockInfo[],
  date: string,
  academySchedules: AcademySchedule[]
): BlockInfo[] {
  const dayOfWeek = new Date(date).getDay();
  const dayAcademySchedules = academySchedules.filter(
    (s) => s.day_of_week === dayOfWeek
  );

  if (dayAcademySchedules.length === 0) {
    return blocks;
  }

  // 학원 일정과 겹치는 블록 제외
  return blocks.filter((block) => {
    const blockStart = timeToMinutes(block.start_time);
    const blockEnd = timeToMinutes(block.end_time);

    return !dayAcademySchedules.some((academy) => {
      const academyStart = timeToMinutes(academy.start_time);
      const academyEnd = timeToMinutes(academy.end_time);

      // 겹치는지 확인
      return (
        (blockStart >= academyStart && blockStart < academyEnd) ||
        (blockEnd > academyStart && blockEnd <= academyEnd) ||
        (blockStart <= academyStart && blockEnd >= academyEnd)
      );
    });
  });
}
