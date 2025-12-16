/**
 * 플랜 데이터를 시스템 프롬프트 기준 표 형식으로 변환하는 유틸리티
 */

import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { calculatePlanEstimatedTime } from "@/lib/plan/assignPlanTimes";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

export type ScheduleTableRow = {
  id: string;
  weekAndDay: string; // "1주차-1일"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  subjectCategory: string; // 교과
  subject: string; // 과목
  contentType: string; // "강의" | "교재"
  contentName: string; // 교재/강의 이름
  learningContent: string; // 학습내역 (단원명 등)
  sequence: number; // 회차
  estimatedTime: number; // 예상 소요시간 (분)
  learningAmount: string; // 학습 분량 (예: "10-14p" 또는 "12강")
  completed: boolean; // 완료 여부
  completionRate: number; // 완료율 (0-100)
  planId: string; // 원본 플랜 ID
  dayType: "학습일" | "복습일" | null; // 학습일/복습일 구분
  block_index: number | null; // 블록 인덱스
  timeSlots?: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
    label?: string;
  }>; // Step 2.5의 시간 구성 타임라인
};

export type PlanData = {
  id: string;
  plan_date: string;
  block_index: number | null;
  content_type: string;
  content_id: string;
  chapter: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_amount: number | null;
  plan_number: number | null;
  sequence: number | null;
};

export type ContentData = {
  id: string;
  title: string;
  subject?: string | null;
  subject_category?: string | null;
  total_pages?: number | null; // 책의 경우
  duration?: number | null; // 강의의 경우
  total_page_or_time?: number | null; // 커스텀의 경우
};

export type BlockData = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_index: number;
};

/**
 * 주차 계산 (시작일 기준, 시작일부터 1일차)
 */
function calculateWeekNumber(
  planDate: string,
  periodStart: string
): { week: number; day: number } {
  const start = new Date(periodStart);
  const current = new Date(planDate);
  
  // 시작일과 현재일을 날짜만 비교 (시간 제거)
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  // 시작일부터 경과 일수 계산
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 주차 계산 (1주차부터 시작, 7일 단위)
  const week = Math.floor(diffDays / 7) + 1;
  
  // 일차 계산 (해당 주의 몇 번째 날인지, 시작일=1일차)
  // 예: 시작일이 수요일이면 수요일=1일차, 목요일=2일차, ...
  const day = (diffDays % 7) + 1;
  
  return { week, day };
}

/**
 * 회차 계산 (같은 콘텐츠의 날짜 순서대로 카운트, plan_number를 고려)
 * 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
 */
function calculateSequence(
  plans: PlanData[],
  currentIndex: number,
  contentId: string,
  planNumber: number | null = null
): number {
  const currentPlan = plans[currentIndex];
  const pn = planNumber !== null ? planNumber : currentPlan?.plan_number ?? null;
  
  // 같은 content_id를 가진 플랜들 중에서
  // plan_number가 null이 아닌 경우, 같은 plan_number를 가진 첫 번째 플랜의 회차를 사용
  if (pn !== null) {
    const firstPlanWithSameNumber = plans.findIndex(
      (p, idx) => 
        p.content_id === contentId && 
        p.plan_number === pn &&
        idx < currentIndex
    );
    
    if (firstPlanWithSameNumber >= 0) {
      // 같은 plan_number를 가진 첫 번째 플랜의 회차 계산 (재귀 호출)
      return calculateSequence(plans, firstPlanWithSameNumber, contentId, null);
    }
  }
  
  // plan_number가 null이거나 같은 plan_number를 가진 첫 번째 플랜인 경우
  // 날짜 순서대로 카운트
  let sequence = 1;
  const seenPlanNumbers = new Set<number | null>();
  
  for (let i = 0; i < currentIndex; i++) {
    if (plans[i].content_id === contentId) {
      const pn = plans[i].plan_number;
      
      // plan_number가 null이면 개별 카운트
      if (pn === null) {
        sequence++;
      } else {
        // plan_number가 있으면 같은 번호를 가진 그룹은 한 번만 카운트
        if (!seenPlanNumbers.has(pn)) {
          seenPlanNumbers.add(pn);
          sequence++;
        }
      }
    }
  }
  
  return sequence;
}

/**
 * 시간 블록에서 시간 문자열 추출
 * block_index가 정확히 일치하지 않을 경우 가장 가까운 블록 찾기
 */
function getTimeFromBlock(
  planDate: string,
  blockIndex: number | null,
  blocks: BlockData[]
): string {
  if (blockIndex === null) return "";
  
  const planDateObj = new Date(planDate);
  const dayOfWeek = planDateObj.getDay();
  
  // 먼저 정확히 일치하는 블록 찾기
  let block = blocks.find(
    (b) => b.day_of_week === dayOfWeek && b.block_index === blockIndex
  );
  
  // 정확히 일치하는 블록이 없으면 같은 요일의 블록 중에서 찾기
  if (!block) {
    const dayBlocks = blocks.filter((b) => b.day_of_week === dayOfWeek);
    if (dayBlocks.length > 0) {
      // block_index로 정렬
      const sortedBlocks = [...dayBlocks].sort((a, b) => a.block_index - b.block_index);
      // blockIndex가 범위 내에 있으면 해당 블록 사용, 아니면 첫 번째 또는 마지막 블록 사용
      if (blockIndex > 0 && blockIndex <= sortedBlocks.length) {
        block = sortedBlocks[blockIndex - 1];
      } else if (sortedBlocks.length > 0) {
        // 범위를 벗어나면 가장 가까운 블록 사용
        block = sortedBlocks[Math.min(blockIndex - 1, sortedBlocks.length - 1)] || sortedBlocks[0];
      }
    }
  }
  
  if (!block) return "";
  
  return `${block.start_time} ~ ${block.end_time}`; // HH:MM ~ HH:MM 형식
}

/**
 * 예상 소요시간 계산 (분 단위)
 * 콘텐츠 타입과 학습 분량을 기반으로 계산
 * 복습일일 경우 소요시간 단축 적용 (학습일 대비 50%로 단축)
 * 통합 함수를 사용하도록 변경
 */
function calculateEstimatedTime(
  contentType: string,
  startPageOrTime: number | null,
  endPageOrTime: number | null,
  content: ContentData | undefined,
  planDate: string,
  blockIndex: number | null,
  blocks: BlockData[],
  dayType: "학습일" | "복습일" | null
): number {
  // 학습 분량이 없으면 블록 시간 반환
  if (startPageOrTime === null || endPageOrTime === null) {
    const blockTime = getBlockDuration(planDate, blockIndex, blocks);
    // 복습일이면 시간 단축
    return dayType === "복습일" ? Math.round(blockTime * 0.5) : blockTime;
  }

  if (!content) {
    // 콘텐츠 정보가 없으면 블록 시간 반환
    const blockTime = getBlockDuration(planDate, blockIndex, blocks);
    return dayType === "복습일" ? Math.round(blockTime * 0.5) : blockTime;
  }

  // calculatePlanEstimatedTime 사용을 위해 ContentDurationMap 생성
  const contentDurationMap = new Map<string, ContentDurationInfo>();
  contentDurationMap.set(content.id, {
    content_type: contentType as "book" | "lecture" | "custom",
    content_id: content.id,
    total_pages: content.total_pages ?? null,
    duration: content.duration ?? null,
    total_page_or_time: content.total_page_or_time ?? null,
    // ContentData에는 episodes 정보가 없으므로 null
    episodes: null,
  });

  return calculatePlanEstimatedTime(
    {
      content_type: contentType as "book" | "lecture" | "custom",
      content_id: content.id,
      planned_start_page_or_time: startPageOrTime,
      planned_end_page_or_time: endPageOrTime,
    },
    contentDurationMap,
    dayType ?? undefined
  );
}

/**
 * 블록 시간 계산 (분 단위)
 */
function getBlockDuration(
  planDate: string,
  blockIndex: number | null,
  blocks: BlockData[]
): number {
  if (blockIndex === null) return 0;
  
  const planDateObj = new Date(planDate);
  const dayOfWeek = planDateObj.getDay();
  
  const block = blocks.find(
    (b) => b.day_of_week === dayOfWeek && b.block_index === blockIndex
  );
  
  if (!block) return 0;
  
  const [startHour, startMin] = block.start_time.split(":").map(Number);
  const [endHour, endMin] = block.end_time.split(":").map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
}

/**
 * 학습 분량 포맷팅
 */
function formatLearningAmount(
  contentType: string,
  start: number | null,
  end: number | null
): string {
  if (start === null || end === null) return "";
  
  if (contentType === "book") {
    return `${start}-${end}p`;
  } else if (contentType === "lecture") {
    return `${start}강`;
  }
  
  return `${start}-${end}`;
}

/**
 * 학습일/복습일 계산 (1730 Timetable 스케줄러용)
 * schedulerOptions가 null이어도 기본값으로 계산
 */
function calculateDayType(
  date: string,
  periodStart: string,
  periodEnd: string,
  schedulerType: string | null,
  schedulerOptions: { study_days?: number; review_days?: number } | null | undefined
): "학습일" | "복습일" | null {
  // 1730 Timetable이 아니면 null 반환
  if (schedulerType !== "1730_timetable") {
    return null;
  }

  // schedulerOptions가 null이거나 undefined여도 기본값 사용
  const studyDays = schedulerOptions?.study_days ?? 6;
  const reviewDays = schedulerOptions?.review_days ?? 1;
  const weekSize = studyDays + reviewDays;

  if (weekSize <= 0) {
    return null;
  }

  const start = new Date(periodStart);
  const current = new Date(date);
  
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  // 시작일부터 경과 일수 계산
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return null;
  }

  // 주차 내에서의 위치 계산
  const positionInWeek = diffDays % weekSize;
  
  // 학습일 범위 내이면 학습일, 아니면 복습일
  if (positionInWeek < studyDays) {
    return "학습일";
  } else {
    return "복습일";
  }
}

/**
 * 플랜 데이터를 표 형식으로 변환
 */
export function transformPlansToScheduleTable(
  plans: PlanData[],
  contents: Map<string, ContentData>,
  blocks: BlockData[],
  periodStart: string,
  periodEnd?: string | null,
  schedulerType?: string | null,
  schedulerOptions?: { study_days?: number; review_days?: number } | null,
  dateTimeSlots?: Record<string, Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
    label?: string;
  }>>
): ScheduleTableRow[] {
  // 날짜 순으로 정렬
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date.localeCompare(b.plan_date);
    }
    return (a.block_index || 0) - (b.block_index || 0);
  });

  // 날짜별로 그룹화하여 같은 날짜의 첫 번째 플랜에만 timeSlots 할당
  const plansByDate = new Map<string, PlanData[]>();
  sortedPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });

  return sortedPlans.map((plan, index) => {
    const content = contents.get(plan.content_id);
    const { week, day } = calculateWeekNumber(plan.plan_date, periodStart);
    // 저장된 sequence가 있으면 사용하고, 없으면 계산
    const sequence = plan.sequence !== null && plan.sequence !== undefined
      ? plan.sequence
      : calculateSequence(sortedPlans, index, plan.content_id, plan.plan_number);
    
    // dayType을 먼저 계산 (estimatedTime 계산에 필요)
    const dayType = calculateDayType(
      plan.plan_date,
      periodStart,
      periodEnd || "",
      schedulerType || null,
      schedulerOptions || null
    );
    
    const time = getTimeFromBlock(plan.plan_date, plan.block_index, blocks);
    const estimatedTime = calculateEstimatedTime(
      plan.content_type,
      plan.planned_start_page_or_time,
      plan.planned_end_page_or_time,
      content,
      plan.plan_date,
      plan.block_index,
      blocks,
      dayType
    );
    const learningAmount = formatLearningAmount(
      plan.content_type,
      plan.planned_start_page_or_time,
      plan.planned_end_page_or_time
    );

    // 완료율 계산
    const totalAmount =
      plan.planned_end_page_or_time && plan.planned_start_page_or_time
        ? plan.planned_end_page_or_time - plan.planned_start_page_or_time
        : 0;
    const completedAmount = plan.completed_amount || 0;
    const completionRate =
      totalAmount > 0 ? Math.round((completedAmount / totalAmount) * 100) : 0;

    // 같은 날짜의 첫 번째 플랜에만 timeSlots 할당
    const datePlans = plansByDate.get(plan.plan_date) || [];
    const isFirstPlanOfDate = datePlans[0]?.id === plan.id;
    const timeSlots = isFirstPlanOfDate ? dateTimeSlots?.[plan.plan_date] : undefined;

    return {
      id: plan.id,
      weekAndDay: `${week}주차-${day}일`,
      date: plan.plan_date,
      time,
      subjectCategory: content?.subject_category || "",
      subject: content?.subject || "",
      contentType: plan.content_type === "book" ? "교재" : "강의",
      contentName: content?.title || "",
      learningContent: plan.chapter || "",
      sequence,
      estimatedTime,
      learningAmount,
      completed: completionRate >= 100,
      completionRate,
      planId: plan.id,
      dayType,
      block_index: plan.block_index,
      timeSlots,
    };
  });
}

