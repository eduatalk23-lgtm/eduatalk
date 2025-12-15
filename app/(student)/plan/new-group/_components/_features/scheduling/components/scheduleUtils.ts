import type { BlockData, ContentData } from "../../../utils/scheduleTransform";
import type { Plan } from "./scheduleTypes";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";

export const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

export const dayTypeColors: Record<string, string> = {
  학습일: "bg-blue-100 text-blue-800 border-blue-200",
  복습일: "bg-green-100 text-green-800 border-green-200",
  지정휴일: "bg-yellow-100 text-yellow-800 border-yellow-200",
  휴가: "bg-gray-100 text-gray-800 border-gray-200",
  개인일정: "bg-purple-100 text-purple-800 border-purple-200",
};

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function getPlanStartTime(
  plan: Plan,
  date: string,
  blocks: BlockData[]
): string | null {
  if (plan.block_index !== null && plan.block_index !== undefined) {
    const planDate = new Date(date + "T00:00:00");
    const dayOfWeek = planDate.getDay();

    // 정확히 일치하는 블록 찾기
    let block = blocks.find(
      (b) => b.day_of_week === dayOfWeek && b.block_index === plan.block_index
    );

    // 정확히 일치하는 블록이 없으면 같은 요일의 블록 중에서 찾기
    if (!block) {
      const dayBlocks = blocks.filter((b) => b.day_of_week === dayOfWeek);
      if (dayBlocks.length > 0) {
        const sortedBlocks = [...dayBlocks].sort(
          (a, b) => a.block_index - b.block_index
        );
        // block_index가 범위 내에 있으면 해당 블록 사용
        if (plan.block_index > 0 && plan.block_index <= sortedBlocks.length) {
          block = sortedBlocks[plan.block_index - 1];
        } else if (sortedBlocks.length > 0) {
          // 범위를 벗어나면 첫 번째 블록 사용
          block = sortedBlocks[0];
        }
      }
    }

    if (block) {
      return block.start_time;
    }
  }

  return null;
}

export function calculateEstimatedTime(
  plan: Plan,
  contents: Map<string, ContentData>,
  dayType?: string
): number {
  const content = contents.get(plan.content_id);

  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null
  ) {
    const baseTime = 60; // 기본값 1시간
    // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  const amount =
    plan.planned_end_page_or_time - plan.planned_start_page_or_time;
  if (amount <= 0) {
    const baseTime = 60;
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  let baseTime = 0;

  if (plan.content_type === "book") {
    // 책: 설정 기반 시간 계산
    const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
    const minutesPerPage = 60 / pagesPerHour;
    baseTime = Math.round(amount * minutesPerPage);
  } else if (plan.content_type === "lecture") {
    // 강의: duration 정보 사용
    if (content?.duration && content.duration > 0) {
      // 총 duration을 사용 (실제로는 episode별 duration이 필요할 수 있음)
      // 강의의 경우 planned_start_page_or_time과 planned_end_page_or_time이 회차를 나타냄
      // 예: 1강, 2강 -> duration을 회차 수로 나눠서 계산
      const episodeCount = amount; // 회차 수
      const totalDuration = content.duration;
      // 회차당 평균 시간 계산 (더 정확한 계산이 필요할 수 있음)
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
