/**
 * 재조정 핵심 로직 단위 테스트
 * 
 * @module lib/reschedule/core.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRescheduleInput } from './core';
import type { AdjustmentInput } from './scheduleEngine';
import type { PlanContent } from '@/lib/types/plan';

describe('validateRescheduleInput', () => {
  const mockContents: PlanContent[] = [
    {
      id: 'content-1',
      plan_group_id: 'group-1',
      content_id: 'book-1',
      content_type: 'book',
      start_page_or_time: 1,
      end_page_or_time: 10,
      subject: '수학',
      order: 1,
    },
    {
      id: 'content-2',
      plan_group_id: 'group-1',
      content_id: 'book-2',
      content_type: 'book',
      start_page_or_time: 1,
      end_page_or_time: 20,
      subject: '영어',
      order: 2,
    },
  ];

  describe('유효한 입력', () => {
    it('유효한 조정 요청은 valid=true', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, mockContents);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('여러 조정 요청도 모두 유효하면 통과', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
        {
          plan_content_id: 'content-2',
          type: 'replace',
          replacement_content_id: 'book-3',
        },
      ];

      const result = validateRescheduleInput(adjustments, mockContents);
      expect(result.valid).toBe(true);
    });
  });

  describe('유효하지 않은 입력', () => {
    it('조정 요청이 없으면 에러', () => {
      const result = validateRescheduleInput([], mockContents);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조정 요청이 없습니다.');
    });

    it('조정 요청이 null이면 에러', () => {
      const result = validateRescheduleInput(null as any, mockContents);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('조정 요청이 없습니다.');
    });

    it('플랜 콘텐츠가 없으면 에러', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, []);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('플랜 콘텐츠가 없습니다.');
    });

    it('플랜 콘텐츠가 null이면 에러', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('플랜 콘텐츠가 없습니다.');
    });

    it('존재하지 않는 콘텐츠 ID 참조는 에러', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-999', // 존재하지 않는 ID
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, mockContents);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('유효하지 않은 플랜 콘텐츠 ID: content-999');
    });

    it('일부 조정 요청이 유효하지 않으면 에러', () => {
      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1', // 유효
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
        {
          plan_content_id: 'content-999', // 유효하지 않음
          type: 'range',
          start_page_or_time: 1,
          end_page_or_time: 10,
        },
      ];

      const result = validateRescheduleInput(adjustments, mockContents);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('유효하지 않은 플랜 콘텐츠 ID: content-999');
    });
  });

  describe('엣지 케이스', () => {
    it('콘텐츠 ID가 null인 경우 처리', () => {
      const contentsWithNullId: PlanContent[] = [
        {
          id: null as any,
          plan_group_id: 'group-1',
          content_id: 'book-1',
          content_type: 'book',
          start_page_or_time: 1,
          end_page_or_time: 10,
          subject: '수학',
          order: 1,
        },
      ];

      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: 'content-1',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, contentsWithNullId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('유효하지 않은 플랜 콘텐츠 ID: content-1');
    });

    it('빈 문자열 콘텐츠 ID는 유효하지 않음', () => {
      const contentsWithEmptyId: PlanContent[] = [
        {
          id: '',
          plan_group_id: 'group-1',
          content_id: 'book-1',
          content_type: 'book',
          start_page_or_time: 1,
          end_page_or_time: 10,
          subject: '수학',
          order: 1,
        },
      ];

      const adjustments: AdjustmentInput[] = [
        {
          plan_content_id: '',
          type: 'range',
          start_page_or_time: 5,
          end_page_or_time: 15,
        },
      ];

      const result = validateRescheduleInput(adjustments, contentsWithEmptyId);
      // 빈 문자열은 Set에 포함되지 않으므로 유효하지 않음
      expect(result.valid).toBe(false);
    });
  });
});

