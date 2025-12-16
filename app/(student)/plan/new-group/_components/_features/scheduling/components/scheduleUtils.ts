import type { BlockData, ContentData } from "../../../utils/scheduleTransform";
import type { Plan } from "./scheduleTypes";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { getDayTypeBadgeClasses } from "@/lib/utils/darkMode";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import { calculatePlanEstimatedTime } from "@/lib/plan/assignPlanTimes";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };

export const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

/**
 * @deprecated getDayTypeBadgeClasses() 사용 권장
 * 날짜 타입별 색상 클래스 반환 (하위 호환성 유지)
 */
export const dayTypeColors: Record<string, string> = {
  학습일: getDayTypeBadgeClasses("학습일"),
  복습일: getDayTypeBadgeClasses("복습일"),
  지정휴일: getDayTypeBadgeClasses("지정휴일"),
  휴가: getDayTypeBadgeClasses("휴가"),
  개인일정: getDayTypeBadgeClasses("개인일정"),
};


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
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null ||
    !plan.content_id
  ) {
    const baseTime = 60; // 기본값 1시간
    // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  const content = contents.get(plan.content_id);
  
  // calculatePlanEstimatedTime 사용을 위해 ContentDurationMap 생성
  const contentDurationMap = new Map<string, ContentDurationInfo>();
  if (content) {
    contentDurationMap.set(plan.content_id, {
      content_type: plan.content_type as "book" | "lecture" | "custom",
      content_id: plan.content_id,
      total_pages: content.total_pages ?? null,
      duration: content.duration ?? null,
      total_page_or_time: content.total_page_or_time ?? null,
      // ContentData에는 episodes 정보가 없으므로 null
      episodes: null,
    });
  }

  return calculatePlanEstimatedTime(
    {
      content_type: plan.content_type as "book" | "lecture" | "custom",
      content_id: plan.content_id,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
    },
    contentDurationMap,
    dayType
  );
}
