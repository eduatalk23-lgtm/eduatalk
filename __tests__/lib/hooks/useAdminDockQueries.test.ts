import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  adminDockKeys,
  getWeekRange,
  dailyPlansQueryOptions,
  weeklyPlansQueryOptions,
  unfinishedPlansQueryOptions,
} from '@/lib/query-options/adminDock';

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}));

describe('adminDockKeys', () => {
  describe('all', () => {
    it('기본 쿼리 키를 반환한다', () => {
      expect(adminDockKeys.all).toEqual(['adminDock']);
    });
  });

  describe('daily', () => {
    it('학생 ID와 날짜를 포함한 쿼리 키를 반환한다', () => {
      const studentId = 'student-123';
      const date = '2024-01-15';

      const key = adminDockKeys.daily(studentId, date);

      expect(key).toEqual(['adminDock', 'daily', 'student-123', '2024-01-15']);
    });
  });

  describe('dailyAdHoc', () => {
    it('학생 ID와 날짜를 포함한 ad-hoc 쿼리 키를 반환한다', () => {
      const studentId = 'student-123';
      const date = '2024-01-15';

      const key = adminDockKeys.dailyAdHoc(studentId, date);

      expect(key).toEqual(['adminDock', 'dailyAdHoc', 'student-123', '2024-01-15']);
    });
  });

  describe('weekly', () => {
    it('학생 ID와 주간 범위를 포함한 쿼리 키를 반환한다', () => {
      const studentId = 'student-123';
      const weekStart = '2024-01-15';
      const weekEnd = '2024-01-21';

      const key = adminDockKeys.weekly(studentId, weekStart, weekEnd);

      expect(key).toEqual(['adminDock', 'weekly', 'student-123', '2024-01-15', '2024-01-21']);
    });
  });

  describe('weeklyAdHoc', () => {
    it('학생 ID와 주간 범위를 포함한 ad-hoc 쿼리 키를 반환한다', () => {
      const studentId = 'student-123';
      const weekStart = '2024-01-15';
      const weekEnd = '2024-01-21';

      const key = adminDockKeys.weeklyAdHoc(studentId, weekStart, weekEnd);

      expect(key).toEqual(['adminDock', 'weeklyAdHoc', 'student-123', '2024-01-15', '2024-01-21']);
    });
  });

  describe('unfinished', () => {
    it('학생 ID를 포함한 미완료 쿼리 키를 반환한다', () => {
      const studentId = 'student-123';

      const key = adminDockKeys.unfinished(studentId);

      expect(key).toEqual(['adminDock', 'unfinished', 'student-123']);
    });
  });
});

describe('getWeekRange', () => {
  it('주간 범위의 시작과 종료가 7일 차이이다', () => {
    const result = getWeekRange('2024-01-15');
    const start = new Date(result.start + 'T00:00:00');
    const end = new Date(result.end + 'T00:00:00');
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    expect(diffDays).toBe(6); // 시작일 포함 7일
  });

  it('같은 주의 다른 날짜는 같은 주간 범위를 반환한다', () => {
    const result1 = getWeekRange('2024-01-15');
    const result2 = getWeekRange('2024-01-17');
    const result3 = getWeekRange('2024-01-19');

    // 모두 같은 주라면 같은 범위
    expect(result1.start).toBe(result2.start);
    expect(result1.end).toBe(result2.end);
    expect(result2.start).toBe(result3.start);
    expect(result2.end).toBe(result3.end);
  });

  it('다음 주 월요일은 다른 주간 범위를 반환한다', () => {
    const result1 = getWeekRange('2024-01-15');
    const result2 = getWeekRange('2024-01-22');

    expect(result1.start).not.toBe(result2.start);
    expect(result1.end).not.toBe(result2.end);
  });

  it('start와 end가 올바른 날짜 형식이다', () => {
    const result = getWeekRange('2024-01-15');

    // YYYY-MM-DD 형식 검증
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('입력 날짜가 반환 범위 내에 포함된다', () => {
    const inputDate = '2024-01-17';
    const result = getWeekRange(inputDate);

    const input = new Date(inputDate + 'T00:00:00');
    const start = new Date(result.start + 'T00:00:00');
    const end = new Date(result.end + 'T00:00:00');

    expect(input.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(input.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it('월 경계를 넘는 경우도 올바른 범위를 반환한다', () => {
    // 2024-02-01은 목요일 - 주가 1월과 2월에 걸침
    const result = getWeekRange('2024-02-01');

    // 범위가 유효한지 확인
    expect(result.start).toBeDefined();
    expect(result.end).toBeDefined();

    // 7일 범위인지 확인
    const start = new Date(result.start + 'T00:00:00');
    const end = new Date(result.end + 'T00:00:00');
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });
});

describe('Query Options', () => {
  describe('dailyPlansQueryOptions', () => {
    it('올바른 쿼리 키를 포함한다', () => {
      const studentId = 'student-123';
      const date = '2024-01-15';

      const options = dailyPlansQueryOptions(studentId, date);

      expect(options.queryKey).toEqual(['adminDock', 'daily', 'student-123', '2024-01-15']);
    });

    it('queryFn이 함수이다', () => {
      const options = dailyPlansQueryOptions('student-123', '2024-01-15');

      expect(typeof options.queryFn).toBe('function');
    });

    it('staleTime이 설정되어 있다', () => {
      const options = dailyPlansQueryOptions('student-123', '2024-01-15');

      expect(options.staleTime).toBeDefined();
      expect(typeof options.staleTime).toBe('number');
    });

    it('gcTime이 설정되어 있다', () => {
      const options = dailyPlansQueryOptions('student-123', '2024-01-15');

      expect(options.gcTime).toBeDefined();
      expect(typeof options.gcTime).toBe('number');
    });
  });

  describe('weeklyPlansQueryOptions', () => {
    it('올바른 쿼리 키를 포함한다', () => {
      const studentId = 'student-123';
      const weekStart = '2024-01-15';
      const weekEnd = '2024-01-21';

      const options = weeklyPlansQueryOptions(studentId, weekStart, weekEnd);

      expect(options.queryKey).toEqual([
        'adminDock',
        'weekly',
        'student-123',
        '2024-01-15',
        '2024-01-21',
      ]);
    });

    it('queryFn이 함수이다', () => {
      const options = weeklyPlansQueryOptions('student-123', '2024-01-15', '2024-01-21');

      expect(typeof options.queryFn).toBe('function');
    });
  });

  describe('unfinishedPlansQueryOptions', () => {
    it('올바른 쿼리 키를 포함한다', () => {
      const studentId = 'student-123';

      const options = unfinishedPlansQueryOptions(studentId);

      expect(options.queryKey).toEqual(['adminDock', 'unfinished', 'student-123']);
    });

    it('queryFn이 함수이다', () => {
      const options = unfinishedPlansQueryOptions('student-123');

      expect(typeof options.queryFn).toBe('function');
    });
  });
});

describe('Query Key Uniqueness', () => {
  it('다른 학생은 다른 쿼리 키를 가진다', () => {
    const key1 = adminDockKeys.daily('student-1', '2024-01-15');
    const key2 = adminDockKeys.daily('student-2', '2024-01-15');

    expect(key1).not.toEqual(key2);
  });

  it('다른 날짜는 다른 쿼리 키를 가진다', () => {
    const key1 = adminDockKeys.daily('student-1', '2024-01-15');
    const key2 = adminDockKeys.daily('student-1', '2024-01-16');

    expect(key1).not.toEqual(key2);
  });

  it('같은 파라미터는 같은 쿼리 키를 가진다', () => {
    const key1 = adminDockKeys.daily('student-1', '2024-01-15');
    const key2 = adminDockKeys.daily('student-1', '2024-01-15');

    expect(key1).toEqual(key2);
  });

  it('daily와 weekly는 다른 쿼리 키를 가진다', () => {
    const dailyKey = adminDockKeys.daily('student-1', '2024-01-15');
    const weeklyKey = adminDockKeys.weekly('student-1', '2024-01-15', '2024-01-21');

    expect(dailyKey[1]).toBe('daily');
    expect(weeklyKey[1]).toBe('weekly');
    expect(dailyKey).not.toEqual(weeklyKey);
  });
});
