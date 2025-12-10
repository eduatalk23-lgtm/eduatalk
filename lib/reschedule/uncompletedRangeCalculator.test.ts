/**
 * 미진행 범위 계산기 단위 테스트
 * 
 * @module lib/reschedule/uncompletedRangeCalculator.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateUncompletedRange,
  calculateUncompletedRangeBounds,
  applyUncompletedRangeToContents,
  type UncompletedPlanData,
  type UncompletedRangeBounds,
} from './uncompletedRangeCalculator';

describe('calculateUncompletedRange', () => {
  it('빈 플랜 목록에서 빈 Map 반환', () => {
    const result = calculateUncompletedRange([]);
    expect(result.size).toBe(0);
  });

  it('완료된 플랜은 미진행 범위 0', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 19 },
    ];
    const result = calculateUncompletedRange(plans);
    expect(result.get('c1')).toBe(0);
  });

  it('미완료 플랜의 미진행 범위 계산', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 10 },
    ];
    const result = calculateUncompletedRange(plans);
    // 계획: 1-20 (19페이지), 완료: 10, 미진행: 9
    expect(result.get('c1')).toBe(9);
  });

  it('여러 플랜의 미진행 범위 합산', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 10 }, // 미진행: 9
      { content_id: 'c1', planned_start_page_or_time: 21, planned_end_page_or_time: 40, completed_amount: 0 }, // 미진행: 19
    ];
    const result = calculateUncompletedRange(plans);
    expect(result.get('c1')).toBe(28); // 9 + 19
  });

  it('다른 콘텐츠는 별도로 계산', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 10, completed_amount: 0 }, // 미진행: 9
      { content_id: 'c2', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 5 }, // 미진행: 14
    ];
    const result = calculateUncompletedRange(plans);
    expect(result.get('c1')).toBe(9);
    expect(result.get('c2')).toBe(14);
  });

  it('초과 완료된 경우 미진행 0 (음수 방지)', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 30 },
    ];
    const result = calculateUncompletedRange(plans);
    expect(result.get('c1')).toBe(0);
  });

  it('null 값 처리', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: null, planned_end_page_or_time: null, completed_amount: null },
    ];
    const result = calculateUncompletedRange(plans);
    expect(result.get('c1')).toBe(0);
  });
});

describe('calculateUncompletedRangeBounds', () => {
  it('빈 플랜 목록에서 빈 Map 반환', () => {
    const result = calculateUncompletedRangeBounds([]);
    expect(result.size).toBe(0);
  });

  it('단일 미진행 플랜의 범위 계산', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 11, planned_end_page_or_time: 20, completed_amount: 0 },
    ];
    const result = calculateUncompletedRangeBounds(plans);
    const bounds = result.get('c1');
    expect(bounds).toBeDefined();
    expect(bounds?.startRange).toBe(11);
    expect(bounds?.endRange).toBe(20);
    expect(bounds?.totalUncompleted).toBe(9);
  });

  it('부분 완료된 플랜의 시작점 조정', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 11, planned_end_page_or_time: 20, completed_amount: 5 },
    ];
    const result = calculateUncompletedRangeBounds(plans);
    const bounds = result.get('c1');
    expect(bounds).toBeDefined();
    // 시작점: 11 + 5 = 16 (완료된 만큼 이동)
    expect(bounds?.startRange).toBe(16);
    expect(bounds?.endRange).toBe(20);
    expect(bounds?.totalUncompleted).toBe(4);
  });

  it('여러 플랜의 범위 병합 (min/max)', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 11, planned_end_page_or_time: 15, completed_amount: 0 },
      { content_id: 'c1', planned_start_page_or_time: 16, planned_end_page_or_time: 20, completed_amount: 2 },
      { content_id: 'c1', planned_start_page_or_time: 21, planned_end_page_or_time: 30, completed_amount: 0 },
    ];
    const result = calculateUncompletedRangeBounds(plans);
    const bounds = result.get('c1');
    expect(bounds).toBeDefined();
    expect(bounds?.startRange).toBe(11); // 최소 시작점
    expect(bounds?.endRange).toBe(30); // 최대 종료점
    expect(bounds?.totalUncompleted).toBe(4 + 2 + 9); // 합계
  });

  it('완료된 플랜만 있으면 결과 없음', () => {
    const plans: UncompletedPlanData[] = [
      { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 10, completed_amount: 9 },
    ];
    const result = calculateUncompletedRangeBounds(plans);
    expect(result.has('c1')).toBe(false);
  });
});

describe('applyUncompletedRangeToContents', () => {
  it('미진행 범위가 없으면 원본 유지', () => {
    const contents = [{ content_id: 'c1', start_range: 1, end_range: 100 }];
    const boundsMap = new Map<string, UncompletedRangeBounds>();
    
    const result = applyUncompletedRangeToContents(contents, boundsMap);
    
    expect(result[0].start_range).toBe(1);
    expect(result[0].end_range).toBe(100);
  });

  it('미진행 시작점으로 start_range 조정', () => {
    const contents = [{ content_id: 'c1', start_range: 1, end_range: 100 }];
    const boundsMap = new Map<string, UncompletedRangeBounds>([
      ['c1', { startRange: 21, endRange: 50, totalUncompleted: 30 }],
    ]);
    
    const result = applyUncompletedRangeToContents(contents, boundsMap);
    
    // start_range는 미진행 시작점으로 조정
    expect(result[0].start_range).toBe(21);
    // end_range는 원래 값 유지 (수정된 로직)
    expect(result[0].end_range).toBe(100);
  });

  it('원본 시작점보다 미진행 시작점이 작으면 원본 시작점 유지', () => {
    const contents = [{ content_id: 'c1', start_range: 30, end_range: 100 }];
    const boundsMap = new Map<string, UncompletedRangeBounds>([
      ['c1', { startRange: 10, endRange: 50, totalUncompleted: 40 }],
    ]);
    
    const result = applyUncompletedRangeToContents(contents, boundsMap);
    
    // 원본 시작점이 더 크므로 유지
    expect(result[0].start_range).toBe(30);
    expect(result[0].end_range).toBe(100);
  });

  it('selectedContentIds로 필터링', () => {
    const contents = [
      { content_id: 'c1', start_range: 1, end_range: 100 },
      { content_id: 'c2', start_range: 1, end_range: 50 },
    ];
    const boundsMap = new Map<string, UncompletedRangeBounds>([
      ['c1', { startRange: 21, endRange: 50, totalUncompleted: 30 }],
      ['c2', { startRange: 11, endRange: 30, totalUncompleted: 20 }],
    ]);
    const selectedContentIds = new Set(['c1']);
    
    const result = applyUncompletedRangeToContents(contents, boundsMap, selectedContentIds);
    
    // c1은 조정됨
    expect(result[0].start_range).toBe(21);
    // c2는 선택되지 않아 원본 유지
    expect(result[1].start_range).toBe(1);
  });

  it('조정 결과가 유효하지 않으면 원본 유지', () => {
    const contents = [{ content_id: 'c1', start_range: 1, end_range: 10 }];
    const boundsMap = new Map<string, UncompletedRangeBounds>([
      // 시작점이 끝점보다 크거나 같은 경우
      ['c1', { startRange: 20, endRange: 5, totalUncompleted: 0 }],
    ]);
    
    const result = applyUncompletedRangeToContents(contents, boundsMap);
    
    // 미진행 범위가 0이면 원본 유지
    expect(result[0].start_range).toBe(1);
    expect(result[0].end_range).toBe(10);
  });

  it('id 필드로도 매칭 가능', () => {
    const contents = [{ id: 'c1', start_range: 1, end_range: 100 }];
    const boundsMap = new Map<string, UncompletedRangeBounds>([
      ['c1', { startRange: 21, endRange: 50, totalUncompleted: 30 }],
    ]);
    
    const result = applyUncompletedRangeToContents(contents, boundsMap);
    
    expect(result[0].start_range).toBe(21);
    expect(result[0].end_range).toBe(100);
  });
});
