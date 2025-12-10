/**
 * 일괄 조정기
 * 
 * 여러 콘텐츠를 한 번에 조정하는 로직을 제공합니다.
 * - 비율 기반 범위 조정
 * - 절대값 기반 범위 조정
 * - 일괄 콘텐츠 교체
 * 
 * @module lib/reschedule/batchAdjuster
 */

import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "./scheduleEngine";

// ============================================
// 타입 정의
// ============================================

/**
 * 일괄 조정 타입
 */
export type BatchAdjustmentType = "ratio" | "absolute" | "replace";

/**
 * 일괄 조정 설정
 */
export interface BatchAdjustmentConfig {
  type: BatchAdjustmentType;
  // 비율 기반 조정
  ratio?: number; // 예: 1.1 (10% 증가), 0.9 (10% 감소)
  // 절대값 기반 조정
  absoluteChange?: number; // 예: +10 (10 증가), -5 (5 감소)
  // 콘텐츠 교체
  replacementMap?: Map<string, string>; // content_id -> new_content_id
}

// ============================================
// 일괄 범위 조정
// ============================================

/**
 * 비율 기반 범위 조정
 * 
 * @param contents 조정할 콘텐츠 목록
 * @param ratio 조정 비율 (1.0 = 변화 없음, 1.1 = 10% 증가, 0.9 = 10% 감소)
 * @returns 조정된 AdjustmentInput 목록
 */
export function applyRatioAdjustment(
  contents: PlanContent[],
  ratio: number
): AdjustmentInput[] {
  const adjustments: AdjustmentInput[] = [];

  contents.forEach((content) => {
    const contentId = content.id || content.content_id;
    const currentRange = content.end_range - content.start_range;
    const newRange = Math.round(currentRange * ratio);
    const center = (content.start_range + content.end_range) / 2;
    const newStart = Math.max(0, Math.round(center - newRange / 2));
    const newEnd = newStart + newRange;

    adjustments.push({
      plan_content_id: contentId,
      change_type: "range",
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
    });
  });

  return adjustments;
}

/**
 * 절대값 기반 범위 조정
 * 
 * @param contents 조정할 콘텐츠 목록
 * @param absoluteChange 절대값 변화 (양수 = 증가, 음수 = 감소)
 * @returns 조정된 AdjustmentInput 목록
 */
export function applyAbsoluteAdjustment(
  contents: PlanContent[],
  absoluteChange: number
): AdjustmentInput[] {
  const adjustments: AdjustmentInput[] = [];

  contents.forEach((content) => {
    const contentId = content.id || content.content_id;
    const currentRange = content.end_range - content.start_range;
    const newRange = Math.max(1, currentRange + absoluteChange);
    const center = (content.start_range + content.end_range) / 2;
    const newStart = Math.max(0, Math.round(center - newRange / 2));
    const newEnd = newStart + newRange;

    adjustments.push({
      plan_content_id: contentId,
      change_type: "range",
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
    });
  });

  return adjustments;
}

/**
 * 일괄 콘텐츠 교체
 * 
 * @param contents 조정할 콘텐츠 목록
 * @param replacementMap 교체 매핑 (content_id -> new_content_id)
 * @returns 조정된 AdjustmentInput 목록
 */
export function applyReplacementAdjustment(
  contents: PlanContent[],
  replacementMap: Map<string, string>
): AdjustmentInput[] {
  const adjustments: AdjustmentInput[] = [];

  contents.forEach((content) => {
    const contentId = content.id || content.content_id;
    const newContentId = replacementMap.get(content.content_id);

    if (!newContentId || newContentId === content.content_id) {
      return; // 교체할 콘텐츠가 없거나 동일하면 스킵
    }

    adjustments.push({
      plan_content_id: contentId,
      change_type: "replace",
      before: {
        content_id: content.content_id,
        content_type: content.content_type,
        range: {
          start: content.start_range,
          end: content.end_range,
        },
      },
      after: {
        content_id: newContentId,
        content_type: content.content_type, // TODO: 실제 타입 조회 필요
        range: {
          start: content.start_range,
          end: content.end_range,
        },
      },
    });
  });

  return adjustments;
}

/**
 * 일괄 조정 적용
 * 
 * @param contents 조정할 콘텐츠 목록
 * @param config 일괄 조정 설정
 * @returns 조정된 AdjustmentInput 목록
 */
export function applyBatchAdjustment(
  contents: PlanContent[],
  config: BatchAdjustmentConfig
): AdjustmentInput[] {
  switch (config.type) {
    case "ratio":
      if (config.ratio === undefined) {
        throw new Error("비율 기반 조정에는 ratio가 필요합니다.");
      }
      return applyRatioAdjustment(contents, config.ratio);
    case "absolute":
      if (config.absoluteChange === undefined) {
        throw new Error("절대값 기반 조정에는 absoluteChange가 필요합니다.");
      }
      return applyAbsoluteAdjustment(contents, config.absoluteChange);
    case "replace":
      if (!config.replacementMap) {
        throw new Error("콘텐츠 교체에는 replacementMap이 필요합니다.");
      }
      return applyReplacementAdjustment(contents, config.replacementMap);
    default:
      return [];
  }
}

/**
 * 일괄 조정 미리보기
 * 
 * @param contents 조정할 콘텐츠 목록
 * @param config 일괄 조정 설정
 * @returns 미리보기 정보
 */
export function previewBatchAdjustment(
  contents: PlanContent[],
  config: BatchAdjustmentConfig
): {
  affectedCount: number;
  totalRangeBefore: number;
  totalRangeAfter: number;
  rangeChange: number;
  sampleAdjustments: Array<{
    content_id: string;
    before: { start: number; end: number };
    after: { start: number; end: number };
  }>;
} {
  const adjustments = applyBatchAdjustment(contents, config);

  let totalRangeBefore = 0;
  let totalRangeAfter = 0;

  adjustments.forEach((adj) => {
    const beforeRange = adj.before.range.end - adj.before.range.start;
    const afterRange = adj.after.range.end - adj.after.range.start;
    totalRangeBefore += beforeRange;
    totalRangeAfter += afterRange;
  });

  const sampleAdjustments = adjustments.slice(0, 3).map((adj) => ({
    content_id: adj.before.content_id,
    before: adj.before.range,
    after: adj.after.range,
  }));

  return {
    affectedCount: adjustments.length,
    totalRangeBefore,
    totalRangeAfter,
    rangeChange: totalRangeAfter - totalRangeBefore,
    sampleAdjustments,
  };
}

