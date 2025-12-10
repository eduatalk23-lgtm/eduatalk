/**
 * 재조정 스케줄 엔진
 * 
 * 재조정 기능에서 플랜을 재생성하는 데 사용되는 순수 함수 형태의 스케줄 엔진입니다.
 * DB I/O 없이 순수 계산만 수행합니다.
 * 
 * @module lib/reschedule/scheduleEngine
 */

import type { PlanGroup, PlanContent } from '@/lib/types/plan';
import type { ScheduledPlan } from '@/lib/plan/scheduler';

// ============================================
// 타입 정의
// ============================================

/**
 * 콘텐츠 스냅샷 (재조정 전 상태)
 */
export interface ContentSnapshot {
  content_id: string;
  content_type: 'book' | 'lecture' | 'custom';
  range: {
    start: number;
    end: number;
  };
}

/**
 * 조정 입력 (재조정 요청)
 */
export interface AdjustmentInput {
  plan_content_id: string; // plan_contents 테이블의 ID
  change_type: 'range' | 'replace' | 'full';
  before: ContentSnapshot;
  after: ContentSnapshot;
}
// Note: GeneratedPlanResult와 ScheduleEngineInput 타입은
// generatePlans 함수 제거와 함께 삭제되었습니다.
// 플랜 생성은 reschedule.ts에서 generatePlansFromGroup을 직접 호출합니다.

// ============================================
// 스케줄 엔진 함수
// ============================================

/**
 * 조정된 콘텐츠 목록 생성
 * 
 * adjustments를 기반으로 기존 contents를 수정합니다.
 * 
 * @param contents 기존 콘텐츠 목록
 * @param adjustments 조정 요청 목록
 * @returns 조정된 콘텐츠 목록
 */
export function applyAdjustments(
  contents: PlanContent[],
  adjustments: AdjustmentInput[]
): PlanContent[] {
  const adjustmentMap = new Map<string, AdjustmentInput>();
  adjustments.forEach((adj) => {
    adjustmentMap.set(adj.plan_content_id, adj);
  });

  return contents.map((content) => {
    const adjustment = adjustmentMap.get(content.id || '');
    if (!adjustment) {
      // 조정되지 않은 콘텐츠는 그대로 유지
      return content;
    }

    // 조정 적용
    switch (adjustment.change_type) {
      case 'range':
        // 범위만 수정
        return {
          ...content,
          start_range: adjustment.after.range.start,
          end_range: adjustment.after.range.end,
        };
      case 'replace':
        // 콘텐츠 교체
        return {
          ...content,
          content_id: adjustment.after.content_id,
          content_type: adjustment.after.content_type,
          start_range: adjustment.after.range.start,
          end_range: adjustment.after.range.end,
        };
      case 'full':
        // 전체 재생성 (범위와 콘텐츠 모두 변경)
        return {
          ...content,
          content_id: adjustment.after.content_id,
          content_type: adjustment.after.content_type,
          start_range: adjustment.after.range.start,
          end_range: adjustment.after.range.end,
        };
      default:
        return content;
    }
  });
}

// ============================================
// 플랜 생성 함수
// ============================================
// Note: 플랜 생성 로직은 reschedule.ts에서 직접 generatePlansFromGroup을 호출합니다.
// 이 모듈은 조정(adjustments) 적용과 요약 생성만 담당합니다.

/**
 * 조정 요약 생성
 * 
 * adjustments를 기반으로 변경 요약을 생성합니다.
 * 
 * @param adjustments 조정 요청 목록
 * @returns 조정 요약
 */
export function generateAdjustmentSummary(adjustments: AdjustmentInput[]): {
  range_changes: number;
  replacements: number;
  full_regenerations: number;
} {
  const summary = {
    range_changes: 0,
    replacements: 0,
    full_regenerations: 0,
  };

  adjustments.forEach((adj) => {
    switch (adj.change_type) {
      case 'range':
        summary.range_changes++;
        break;
      case 'replace':
        summary.replacements++;
        break;
      case 'full':
        summary.full_regenerations++;
        break;
    }
  });

  return summary;
}

