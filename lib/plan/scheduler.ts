import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerType,
} from "@/lib/types/plan";

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
  switch (group.scheduler_type) {
    case "자동스케줄러":
      return generateAutoSchedulerPlans(
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
    case "1730_timetable":
      return generate1730TimetablePlans(
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
    default:
      return generateDefaultPlans(
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
  }
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
 * 자동 스케줄러: 가중치 기반 자동 배정 (학습 범위 기반)
 */
function generateAutoSchedulerPlans(
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

  // 기본 스케줄러와 동일한 로직 사용 (학습 범위 기반)
  return generateDefaultPlans(
    dates,
    filteredContents,
    blocks,
    academySchedules,
    exclusions,
    riskIndexMap,
    dateAvailableTimeRanges,
    dateTimeSlots,
    contentDurationMap
  );
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

    // 1. 학습일: 각 콘텐츠의 학습 범위를 학습일로 나누어 배정
    const totalStudyDaysInWeek = studyDaysList.length;
    
    // 콘텐츠별 일일 배정량 계산
    const contentDailyAmounts = new Map<string, number[]>();
    filteredContents.forEach((content) => {
      const dailyAmount = Math.round(content.total_amount / (weeks.length * totalStudyDaysInWeek));
      const amounts: number[] = [];
      let remaining = content.total_amount;
      let currentStart = content.start_range;

      for (let i = 0; i < weeks.length * totalStudyDaysInWeek; i++) {
        const amount = i === weeks.length * totalStudyDaysInWeek - 1 ? remaining : dailyAmount;
        amounts.push(amount);
        remaining -= amount;
      }

      contentDailyAmounts.set(content.content_id, amounts);
    });

    // 취약과목 우선 배정
    const sortedContents = [...filteredContents].sort((a, b) => {
      const aSubject = a.subject?.toLowerCase().trim() || "";
      const bSubject = b.subject?.toLowerCase().trim() || "";
      const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
      const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
      return bRisk - aRisk;
    });

    // 학습일 배정: 먼저 플랜 생성, 블록은 동적으로 생성
    const studyPlansByDate = new Map<string, Array<{
      content: ContentInfo;
      dailyAmount: number;
      currentStart: number;
      globalDayIndex: number;
    }>>();

    studyDaysList.forEach((date, dayIndexInWeek) => {
      const globalDayIndex = weekIndex * totalStudyDaysInWeek + dayIndexInWeek;
      const datePlans: Array<{
        content: ContentInfo;
        dailyAmount: number;
        currentStart: number;
        globalDayIndex: number;
      }> = [];

      sortedContents.forEach((content) => {
        const dailyAmounts = contentDailyAmounts.get(content.content_id) || [];
        const dailyAmount = dailyAmounts[globalDayIndex] || 0;

        if (dailyAmount === 0) return;

        const currentStart = content.start_range + dailyAmounts.slice(0, globalDayIndex).reduce((sum, amt) => sum + amt, 0);
        
        datePlans.push({
          content,
          dailyAmount,
          currentStart,
          globalDayIndex,
        });
      });

      if (datePlans.length > 0) {
        studyPlansByDate.set(date, datePlans);
      }
    });

    // 학습일 플랜에 블록 할당 (동적 생성)
    studyPlansByDate.forEach((datePlans, date) => {
      const availableRanges = dateAvailableTimeRanges?.get(date) || [];
      const timeSlots = dateTimeSlots?.get(date) || [];
      const studyTimeSlots = timeSlots.filter((slot) => slot.type === "학습시간");
      
      let slotIndex = 0;
      let blockIndex = 1;
      let currentSlotPosition = 0;

      datePlans.forEach(({ content, dailyAmount, currentStart: start }) => {
        const endAmount = Math.min(start + dailyAmount, content.end_range);
        
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

        // 주차별 범위 저장 (복습용)
        if (!weekContentRanges.has(content.content_id)) {
          weekContentRanges.set(content.content_id, {
            startAmount: start,
            endAmount: endAmount,
          });
        } else {
          const existing = weekContentRanges.get(content.content_id)!;
          existing.endAmount = Math.max(existing.endAmount, endAmount);
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
