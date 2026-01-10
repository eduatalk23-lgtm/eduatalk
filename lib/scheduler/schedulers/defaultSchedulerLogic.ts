/**
 * Default 스케줄러 로직
 *
 * 기본 균등 배분 스케줄링의 핵심 로직입니다.
 * DefaultScheduler에서 사용됩니다.
 *
 * @module lib/scheduler/schedulers/defaultSchedulerLogic
 */

import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import type {
  BlockInfo,
  ContentInfo,
  ScheduledPlan,
  DateAvailableTimeRanges,
  DateTimeSlots,
  ContentDurationMap,
} from "@/lib/plan/scheduler";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import { calculateContentDuration } from "@/lib/plan/contentDuration";
import { filterBlocksByAcademySchedule } from "@/lib/plan/scheduler";

/**
 * 기본 스케줄러 로직: 학습 범위를 학습일로 나누어 배정
 *
 * @internal DefaultScheduler에서만 사용
 */
export function generateDefaultPlansInternal(
  dates: string[],
  contents: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  _exclusions: PlanExclusion[],
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
  const plansByDate = new Map<
    string,
    Array<{
      content: ContentInfo;
      dailyAmount: number;
      currentStart: number;
    }>
  >();

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

      const currentStart =
        content.start_range +
        dailyAmounts.slice(0, dateIndex).reduce((sum, amt) => sum + amt, 0);

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
            chapter: content.chapter || null,
            is_reschedulable: true,
            start_time: block.start_time,
            end_time: block.end_time,
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
      const studyTimeSlots = timeSlots.filter(
        (slot) => slot.type === "학습시간"
      );

      let slotIndex = 0;
      let blockIndex = 1; // 동적으로 생성되는 블록 인덱스
      let currentSlotPosition = 0; // 현재 슬롯 내에서 사용한 시간 (분)

      datePlans.forEach(({ content, dailyAmount, currentStart: start }) => {
        // 콘텐츠 소요시간 계산
        const endPageOrTime = Math.min(start + dailyAmount, content.end_range);
        const durationInfo = contentDurationMap?.get(content.content_id);
        const amount = endPageOrTime - start;

        // duration 정보가 있으면 통합 함수 사용, 없으면 기본값 계산
        const requiredMinutes = durationInfo
          ? calculateContentDuration(
              {
                content_type: content.content_type,
                content_id: content.content_id,
                start_range: start,
                end_range: endPageOrTime,
              },
              durationInfo
            )
          : amount > 0
            ? content.content_type === "lecture"
              ? amount * 30 // 강의: 회차당 30분
              : amount * 2 // 책/커스텀: 페이지당 2분
            : 60; // 기본값: 1시간

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
            const planEndTime = minutesToTime(
              slotStart + currentSlotPosition + slotUsed
            );

            plans.push({
              plan_date: date,
              block_index: blockIndex,
              content_type: content.content_type,
              content_id: content.content_id,
              planned_start_page_or_time: start,
              planned_end_page_or_time: endPageOrTime,
              chapter: content.chapter || null,
              is_reschedulable: true,
              start_time: planStartTime,
              end_time: planEndTime,
            });

            remainingMinutes -= slotUsed;
            currentSlotPosition += slotUsed;
            blockIndex++;

            // 현재 슬롯을 모두 사용했으면 다음 슬롯으로
            if (currentSlotPosition >= slotEnd - slotStart) {
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
          const rangeDuration =
            endMinutes > startMinutes ? endMinutes - startMinutes : 60;

          // 소요시간이 범위보다 작으면 해당 시간만큼만 사용
          const actualDuration = Math.min(requiredMinutes, rangeDuration);
          const planStartTime = minutesToTime(startMinutes + currentSlotPosition);
          const planEndTime = minutesToTime(
            startMinutes + currentSlotPosition + actualDuration
          );

          plans.push({
            plan_date: date,
            block_index: blockIndex,
            content_type: content.content_type,
            content_id: content.content_id,
            planned_start_page_or_time: start,
            planned_end_page_or_time: endPageOrTime,
            chapter: content.chapter || null,
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
