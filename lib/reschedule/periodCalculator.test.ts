/**
 * 재조정 기간 계산기 단위 테스트
 * 
 * @module lib/reschedule/periodCalculator.test
 */

import { describe, it, expect } from 'vitest';
import {
  getTodayDateString,
  getNextDayString,
  getDaysBetween,
  isDateBefore,
  isDateBeforeOrEqual,
  getAdjustedPeriod,
  getAdjustedPeriodWithDetails,
  validateReschedulePeriod,
  PeriodCalculationError,
} from './periodCalculator';

describe('유틸리티 함수', () => {
  describe('getTodayDateString', () => {
    it('YYYY-MM-DD 형식 반환', () => {
      const today = getTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getNextDayString', () => {
    it('다음 날 반환', () => {
      expect(getNextDayString('2025-12-10')).toBe('2025-12-11');
    });

    it('월말 → 다음달 초', () => {
      expect(getNextDayString('2025-12-31')).toBe('2026-01-01');
    });

    it('2월 말 → 3월 초', () => {
      expect(getNextDayString('2025-02-28')).toBe('2025-03-01');
    });
  });

  describe('getDaysBetween', () => {
    it('같은 날은 1일', () => {
      expect(getDaysBetween('2025-12-10', '2025-12-10')).toBe(1);
    });

    it('연속 이틀은 2일', () => {
      expect(getDaysBetween('2025-12-10', '2025-12-11')).toBe(2);
    });

    it('일주일은 7일', () => {
      expect(getDaysBetween('2025-12-10', '2025-12-16')).toBe(7);
    });
  });

  describe('isDateBefore', () => {
    it('이전 날짜 확인', () => {
      expect(isDateBefore('2025-12-10', '2025-12-11')).toBe(true);
      expect(isDateBefore('2025-12-11', '2025-12-10')).toBe(false);
    });

    it('같은 날짜는 false', () => {
      expect(isDateBefore('2025-12-10', '2025-12-10')).toBe(false);
    });
  });

  describe('isDateBeforeOrEqual', () => {
    it('이전 또는 같은 날짜 확인', () => {
      expect(isDateBeforeOrEqual('2025-12-10', '2025-12-11')).toBe(true);
      expect(isDateBeforeOrEqual('2025-12-10', '2025-12-10')).toBe(true);
      expect(isDateBeforeOrEqual('2025-12-11', '2025-12-10')).toBe(false);
    });
  });
});

describe('getAdjustedPeriod', () => {
  const today = '2025-12-10';
  const groupEnd = '2025-12-31';

  describe('전체 재조정 (날짜 범위 미지정)', () => {
    it('오늘 다음날부터 그룹 종료일까지 반환', () => {
      const result = getAdjustedPeriod(null, today, groupEnd);
      expect(result.start).toBe('2025-12-11');
      expect(result.end).toBe('2025-12-31');
    });

    it('includeToday=true면 오늘부터 시작', () => {
      const result = getAdjustedPeriod(null, today, groupEnd, true);
      expect(result.start).toBe('2025-12-10');
      expect(result.end).toBe('2025-12-31');
    });

    it('그룹 종료일이 오늘 이전이면 에러', () => {
      expect(() => {
        getAdjustedPeriod(null, today, '2025-12-09');
      }).toThrow(PeriodCalculationError);
    });
  });

  describe('날짜 범위 지정', () => {
    it('선택 범위가 오늘 이후면 그대로 사용', () => {
      const dateRange = { from: '2025-12-15', to: '2025-12-20' };
      const result = getAdjustedPeriod(dateRange, today, groupEnd);
      expect(result.start).toBe('2025-12-15');
      expect(result.end).toBe('2025-12-20');
    });

    it('시작일이 오늘 이전이면 오늘 다음날로 조정', () => {
      const dateRange = { from: '2025-12-05', to: '2025-12-20' };
      const result = getAdjustedPeriod(dateRange, today, groupEnd);
      expect(result.start).toBe('2025-12-11');
      expect(result.end).toBe('2025-12-20');
    });

    it('종료일이 그룹 종료일 이후면 그룹 종료일로 조정', () => {
      const dateRange = { from: '2025-12-15', to: '2026-01-15' };
      const result = getAdjustedPeriod(dateRange, today, groupEnd);
      expect(result.start).toBe('2025-12-15');
      expect(result.end).toBe('2025-12-31');
    });

    it('종료일이 시작일 이전이면 에러', () => {
      const dateRange = { from: '2025-12-20', to: '2025-12-15' };
      expect(() => {
        getAdjustedPeriod(dateRange, today, groupEnd);
      }).toThrow(PeriodCalculationError);
    });

    it('선택 범위 전체가 오늘 이전이면 에러', () => {
      const dateRange = { from: '2025-12-01', to: '2025-12-09' };
      expect(() => {
        getAdjustedPeriod(dateRange, today, groupEnd);
      }).toThrow(PeriodCalculationError);
    });
  });
});

describe('getAdjustedPeriodWithDetails', () => {
  const today = '2025-12-10';
  const groupEnd = '2025-12-31';

  it('조정 여부 와 가용 일수 반환', () => {
    const dateRange = { from: '2025-12-05', to: '2025-12-20' };
    const result = getAdjustedPeriodWithDetails(dateRange, today, groupEnd);
    
    expect(result.period.start).toBe('2025-12-11');
    expect(result.period.end).toBe('2025-12-20');
    expect(result.adjustedFromToday).toBe(true);
    expect(result.originalStart).toBe('2025-12-05');
    expect(result.availableDays).toBe(10); // 12/11 ~ 12/20 = 10일
  });

  it('조정이 필요 없으면 adjustedFromToday=false', () => {
    const dateRange = { from: '2025-12-15', to: '2025-12-20' };
    const result = getAdjustedPeriodWithDetails(dateRange, today, groupEnd);
    
    expect(result.adjustedFromToday).toBe(false);
    expect(result.originalStart).toBeUndefined();
  });
});

describe('validateReschedulePeriod', () => {
  const today = '2025-12-10';
  const groupEnd = '2025-12-31';

  it('유효한 기간은 valid=true', () => {
    const result = validateReschedulePeriod(
      { from: '2025-12-15', to: '2025-12-20' },
      today,
      groupEnd
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('유효하지 않은 기간은 valid=false와 에러 메시지', () => {
    const result = validateReschedulePeriod(
      { from: '2025-12-01', to: '2025-12-09' },
      today,
      groupEnd
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.errorCode).toBe('PAST_DATE_RANGE');
  });
});
