/**
 * 자동 재조정 제안 생성기
 * 
 * 학습 지연 분석 결과를 바탕으로 재조정 제안을 생성합니다.
 * 
 * @module lib/reschedule/autoSuggester
 */

import type { DelayAnalysis, DelaySeverity } from "./delayDetector";
import type { AdjustmentInput } from "./scheduleEngine";
import type { PlanContent } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 제안 타입
 */
export type RescheduleSuggestionType =
  | "extend_deadline" // 기한 연장
  | "increase_daily_load" // 일일 학습량 증가
  | "reduce_content_range" // 콘텐츠 범위 축소
  | "replace_content" // 콘텐츠 교체
  | "redistribute_plans"; // 플랜 재분배

/**
 * 재조정 제안
 */
export interface RescheduleSuggestion {
  /** 제안 타입 */
  type: RescheduleSuggestionType;
  /** 제안 우선순위 (1-5, 높을수록 우선) */
  priority: number;
  /** 제안 제목 */
  title: string;
  /** 제안 설명 */
  description: string;
  /** 제안 이유 */
  reason: string;
  /** 예상 효과 */
  expectedImpact: string;
  /** 적용 시 필요한 조정 목록 */
  adjustments: AdjustmentInput[];
  /** 영향받는 날짜 범위 */
  affectedDateRange: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  } | null;
}

/**
 * 제안 생성 입력
 */
export interface SuggestionInput {
  /** 지연 분석 결과 */
  delayAnalysis: DelayAnalysis;
  /** 플랜 그룹 콘텐츠 목록 */
  contents: PlanContent[];
  /** 플랜 그룹 시작일 */
  startDate: string; // YYYY-MM-DD
  /** 플랜 그룹 종료일 */
  endDate: string; // YYYY-MM-DD
}

// ============================================
// 제안 생성 로직
// ============================================

/**
 * 기한 연장 제안 생성
 */
function generateExtendDeadlineSuggestion(
  input: SuggestionInput
): RescheduleSuggestion | null {
  const { delayAnalysis } = input;
  if (delayAnalysis.delayDays <= 0) {
    return null;
  }

  const extensionDays = Math.ceil(delayAnalysis.delayDays * 1.2); // 20% 여유 추가

  return {
    type: "extend_deadline",
    priority: delayAnalysis.severity === "critical" ? 5 : 4,
    title: "기한 연장",
    description: `학습 지연을 고려하여 기한을 ${extensionDays}일 연장하는 것을 제안합니다.`,
    reason: `현재 약 ${delayAnalysis.delayDays}일 지연되어 있으며, 계획된 기한 내 완료가 어려울 것으로 예상됩니다.`,
    expectedImpact: `기한 연장으로 여유 있는 학습 일정을 확보할 수 있습니다.`,
    adjustments: [], // 기한 연장은 플랜 그룹 레벨 조정이므로 여기서는 빈 배열
    affectedDateRange: {
      from: input.endDate,
      to: new Date(
        new Date(input.endDate).getTime() +
          extensionDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10),
    },
  };
}

/**
 * 일일 학습량 증가 제안 생성
 */
function generateIncreaseDailyLoadSuggestion(
  input: SuggestionInput
): RescheduleSuggestion | null {
  const { delayAnalysis } = input;
  if (delayAnalysis.delayDays <= 0 || delayAnalysis.severity === "none") {
    return null;
  }

  const currentDailyPlans = delayAnalysis.details.dailyActualPlans;
  const requiredDailyPlans = delayAnalysis.details.dailyRequiredPlans;
  const increaseRatio = requiredDailyPlans > 0
    ? Math.max(1.1, requiredDailyPlans / currentDailyPlans)
    : 1.2;

  return {
    type: "increase_daily_load",
    priority: delayAnalysis.severity === "critical" ? 5 : 3,
    title: "일일 학습량 증가",
    description: `일일 학습량을 ${Math.round((increaseRatio - 1) * 100)}% 증가시키는 것을 제안합니다.`,
    reason: `현재 일일 평균 ${currentDailyPlans.toFixed(1)}개 플랜을 완료하고 있으나, 계획 대비 ${requiredDailyPlans.toFixed(1)}개가 필요합니다.`,
    expectedImpact: `일일 학습량 증가로 지연을 따라잡을 수 있습니다.`,
    adjustments: [], // 일일 학습량 증가는 스케줄러 레벨 조정이므로 여기서는 빈 배열
    affectedDateRange: {
      from: input.startDate,
      to: input.endDate,
    },
  };
}

/**
 * 콘텐츠 범위 축소 제안 생성
 */
function generateReduceContentRangeSuggestion(
  input: SuggestionInput
): RescheduleSuggestion | null {
  const { delayAnalysis, contents } = input;
  if (delayAnalysis.severity === "none" || delayAnalysis.severity === "low") {
    return null;
  }

  if (contents.length === 0) {
    return null;
  }

  // 가장 큰 범위를 가진 콘텐츠를 10% 축소
  const adjustments: AdjustmentInput[] = contents
    .map((content) => {
      const contentId = content.id || content.content_id;
      const currentRange = content.end_range - content.start_range;
      const reductionRatio = 0.9; // 10% 축소
      const newRange = Math.max(1, Math.round(currentRange * reductionRatio));
      const center = (content.start_range + content.end_range) / 2;
      const newStart = Math.max(0, Math.round(center - newRange / 2));
      const newEnd = newStart + newRange;

      return {
        plan_content_id: contentId,
        change_type: "range" as const,
        before: {
          content_id: content.content_id,
          content_type: content.content_type,
          range: {
            start: content.start_range,
            end: content.end_range,
          },
        },
        after: {
          content_id: content.content_id,
          content_type: content.content_type,
          range: {
            start: newStart,
            end: newEnd,
          },
        },
      };
    })
    .slice(0, 3); // 상위 3개만 제안

  if (adjustments.length === 0) {
    return null;
  }

  return {
    type: "reduce_content_range",
    priority: delayAnalysis.severity === "critical" ? 4 : 3,
    title: "콘텐츠 범위 축소",
    description: `${adjustments.length}개 콘텐츠의 학습 범위를 10% 축소하는 것을 제안합니다.`,
    reason: `학습 지연을 따라잡기 위해 학습량을 조정하는 것이 필요합니다.`,
    expectedImpact: `범위 축소로 학습 부담을 줄이고 완료 가능성을 높일 수 있습니다.`,
    adjustments,
    affectedDateRange: {
      from: input.startDate,
      to: input.endDate,
    },
  };
}

/**
 * 플랜 재분배 제안 생성
 */
function generateRedistributePlansSuggestion(
  input: SuggestionInput
): RescheduleSuggestion | null {
  const { delayAnalysis } = input;
  if (delayAnalysis.severity === "none" || delayAnalysis.severity === "low") {
    return null;
  }

  if (delayAnalysis.affectedDates.length === 0) {
    return null;
  }

  return {
    type: "redistribute_plans",
    priority: delayAnalysis.severity === "critical" ? 5 : 4,
    title: "플랜 재분배",
    description: `누락된 플랜을 미래 날짜로 재분배하는 것을 제안합니다.`,
    reason: `${delayAnalysis.affectedDates.length}일 동안 미완료 플랜이 누적되었습니다.`,
    expectedImpact: `미완료 플랜을 재분배하여 학습 계획을 정상화할 수 있습니다.`,
    adjustments: [], // 플랜 재분배는 스케줄러 레벨 조정이므로 여기서는 빈 배열
    affectedDateRange: {
      from: delayAnalysis.affectedDates[0],
      to: input.endDate,
    },
  };
}

/**
 * 자동 재조정 제안 생성
 * 
 * @param input 제안 생성 입력
 * @returns 재조정 제안 목록 (우선순위 순)
 */
export function generateRescheduleSuggestions(
  input: SuggestionInput
): RescheduleSuggestion[] {
  const suggestions: RescheduleSuggestion[] = [];

  // 지연이 없으면 제안하지 않음
  if (input.delayAnalysis.severity === "none") {
    return [];
  }

  // 1. 기한 연장 제안
  const extendSuggestion = generateExtendDeadlineSuggestion(input);
  if (extendSuggestion) {
    suggestions.push(extendSuggestion);
  }

  // 2. 일일 학습량 증가 제안
  const increaseLoadSuggestion = generateIncreaseDailyLoadSuggestion(input);
  if (increaseLoadSuggestion) {
    suggestions.push(increaseLoadSuggestion);
  }

  // 3. 콘텐츠 범위 축소 제안
  const reduceRangeSuggestion = generateReduceContentRangeSuggestion(input);
  if (reduceRangeSuggestion) {
    suggestions.push(reduceRangeSuggestion);
  }

  // 4. 플랜 재분배 제안
  const redistributeSuggestion = generateRedistributePlansSuggestion(input);
  if (redistributeSuggestion) {
    suggestions.push(redistributeSuggestion);
  }

  // 우선순위 순으로 정렬
  suggestions.sort((a, b) => b.priority - a.priority);

  return suggestions;
}

