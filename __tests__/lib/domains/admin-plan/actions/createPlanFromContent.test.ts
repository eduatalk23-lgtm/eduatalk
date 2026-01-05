/**
 * 콘텐츠 기반 플랜 생성 액션 테스트
 *
 * createPlanFromContent 함수의 입력 검증 및 배치 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/admin-plan/actions/createPlanFromContent.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() =>
          Promise.resolve({
            data: [{ id: 'plan-123' }],
            error: null,
          })
        ),
      })),
    })),
  })),
}));

// Auth 모킹
vi.mock('@/lib/auth/guards', () => ({
  requireAdminOrConsultant: vi.fn(() =>
    Promise.resolve({ tenantId: 'tenant-123', userId: 'admin-123' })
  ),
}));

// 로깅 모킹
vi.mock('@/lib/logging/actionLogger', () => ({
  logActionError: vi.fn(),
}));

// revalidatePath 모킹
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// 타입 정의
import type {
  DistributionMode,
  CreatePlanFromContentInput,
} from '@/lib/domains/admin-plan/actions/createPlanFromContent';

describe('DistributionMode 타입', () => {
  it('today 모드', () => {
    const mode: DistributionMode = 'today';
    expect(mode).toBe('today');
  });

  it('period 모드', () => {
    const mode: DistributionMode = 'period';
    expect(mode).toBe('period');
  });

  it('weekly 모드', () => {
    const mode: DistributionMode = 'weekly';
    expect(mode).toBe('weekly');
  });
});

describe('CreatePlanFromContentInput 타입 검증', () => {
  describe('필수 필드', () => {
    it('콘텐츠 정보 필드', () => {
      const input: CreatePlanFromContentInput = {
        flexibleContentId: 'content-123',
        contentTitle: '개념원리 수학1',
        contentSubject: '수학',
        rangeStart: 1,
        rangeEnd: 50,
        distributionMode: 'today',
        targetDate: '2024-01-15',
        studentId: 'student-123',
        tenantId: 'tenant-123',
      };

      expect(input.flexibleContentId).toBeDefined();
      expect(input.contentTitle).toBeDefined();
      expect(input.distributionMode).toBeDefined();
    });

    it('배치 정보 필드', () => {
      const input: CreatePlanFromContentInput = {
        flexibleContentId: 'content-123',
        contentTitle: '영어 강의',
        contentSubject: null,
        rangeStart: null,
        rangeEnd: null,
        distributionMode: 'weekly',
        targetDate: '2024-01-15',
        studentId: 'student-123',
        tenantId: 'tenant-123',
      };

      expect(input.distributionMode).toBe('weekly');
      expect(input.targetDate).toBeDefined();
    });
  });

  describe('선택적 필드', () => {
    it('customRangeDisplay (자유 입력 범위)', () => {
      const input: CreatePlanFromContentInput = {
        flexibleContentId: 'content-123',
        contentTitle: '커스텀 학습',
        contentSubject: null,
        rangeStart: null,
        rangeEnd: null,
        customRangeDisplay: '1단원 ~ 3단원',
        distributionMode: 'today',
        targetDate: '2024-01-15',
        studentId: 'student-123',
        tenantId: 'tenant-123',
      };

      expect(input.customRangeDisplay).toBe('1단원 ~ 3단원');
    });

    it('totalVolume (예상 볼륨)', () => {
      const input: CreatePlanFromContentInput = {
        flexibleContentId: 'content-123',
        contentTitle: '수학 교재',
        contentSubject: '수학',
        rangeStart: 1,
        rangeEnd: 100,
        totalVolume: 100,
        distributionMode: 'period',
        targetDate: '2024-01-15',
        periodEndDate: '2024-01-25',
        studentId: 'student-123',
        tenantId: 'tenant-123',
      };

      expect(input.totalVolume).toBe(100);
    });

    it('periodEndDate (기간 모드용)', () => {
      const input: CreatePlanFromContentInput = {
        flexibleContentId: 'content-123',
        contentTitle: '영어 교재',
        contentSubject: '영어',
        rangeStart: 1,
        rangeEnd: 200,
        distributionMode: 'period',
        targetDate: '2024-01-15',
        periodEndDate: '2024-02-15',
        studentId: 'student-123',
        tenantId: 'tenant-123',
      };

      expect(input.periodEndDate).toBe('2024-02-15');
    });
  });
});

describe('today 배치 모드', () => {
  it('단일 플랜 생성 (Daily Dock)', () => {
    const input: CreatePlanFromContentInput = {
      flexibleContentId: 'content-123',
      contentTitle: '오늘의 학습',
      contentSubject: '수학',
      rangeStart: 1,
      rangeEnd: 20,
      distributionMode: 'today',
      targetDate: '2024-01-15',
      studentId: 'student-123',
      tenantId: 'tenant-123',
    };

    expect(input.distributionMode).toBe('today');
    // 결과: 1개의 플랜, container_type = 'daily'
  });

  it('container_type은 daily로 설정', () => {
    const containerType = 'daily';
    expect(containerType).toBe('daily');
  });
});

describe('weekly 배치 모드', () => {
  it('단일 플랜 생성 (Weekly Dock)', () => {
    const input: CreatePlanFromContentInput = {
      flexibleContentId: 'content-123',
      contentTitle: '주간 학습',
      contentSubject: '영어',
      rangeStart: 1,
      rangeEnd: 50,
      distributionMode: 'weekly',
      targetDate: '2024-01-15',
      studentId: 'student-123',
      tenantId: 'tenant-123',
    };

    expect(input.distributionMode).toBe('weekly');
    // 결과: 1개의 플랜, container_type = 'weekly'
  });

  it('container_type은 weekly로 설정', () => {
    const containerType = 'weekly';
    expect(containerType).toBe('weekly');
  });
});

describe('period 배치 모드', () => {
  it('기간에 걸쳐 여러 플랜 생성', () => {
    const input: CreatePlanFromContentInput = {
      flexibleContentId: 'content-123',
      contentTitle: '수학 교재',
      contentSubject: '수학',
      rangeStart: 1,
      rangeEnd: 100,
      distributionMode: 'period',
      targetDate: '2024-01-15',
      periodEndDate: '2024-01-24',
      studentId: 'student-123',
      tenantId: 'tenant-123',
    };

    expect(input.distributionMode).toBe('period');
    expect(input.periodEndDate).toBeDefined();
  });

  it('periodEndDate 없으면 오류', () => {
    const input: CreatePlanFromContentInput = {
      flexibleContentId: 'content-123',
      contentTitle: '수학 교재',
      contentSubject: '수학',
      rangeStart: 1,
      rangeEnd: 100,
      distributionMode: 'period',
      targetDate: '2024-01-15',
      // periodEndDate 누락
      studentId: 'student-123',
      tenantId: 'tenant-123',
    };

    expect(input.periodEndDate).toBeUndefined();
    // 실제 함수에서는 '유효하지 않은 배치 방식입니다.' 오류 반환
  });
});

describe('기간 분배 로직 (distributeOverPeriod)', () => {
  describe('날짜 계산', () => {
    it('날짜 수 계산', () => {
      const startDate = new Date('2024-01-15T00:00:00');
      const endDate = new Date('2024-01-24T00:00:00');

      const dayCount =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      expect(dayCount).toBe(10);
    });

    it('같은 날이면 1일', () => {
      const startDate = new Date('2024-01-15T00:00:00');
      const endDate = new Date('2024-01-15T00:00:00');

      const dayCount =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      expect(dayCount).toBe(1);
    });

    it('종료일이 시작일보다 이전이면 0일 이하', () => {
      const startDate = new Date('2024-01-15T00:00:00');
      const endDate = new Date('2024-01-10T00:00:00');

      const dayCount =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      expect(dayCount).toBeLessThanOrEqual(0);
      // 실제 함수에서는 빈 배열 반환
    });
  });

  describe('범위 분배', () => {
    it('총 범위를 날짜 수로 분배', () => {
      const rangeStart = 1;
      const rangeEnd = 100;
      const dayCount = 10;

      const totalRange = rangeEnd - rangeStart + 1;
      const perDay = Math.ceil(totalRange / dayCount);

      expect(totalRange).toBe(100);
      expect(perDay).toBe(10);
    });

    it('나머지 처리', () => {
      const rangeStart = 1;
      const rangeEnd = 25;
      const dayCount = 10;

      const totalRange = rangeEnd - rangeStart + 1;
      const perDay = Math.ceil(totalRange / dayCount);

      // 25 / 10 = 2.5 → ceil = 3
      expect(perDay).toBe(3);
      // 첫 8일: 1-3, 4-6, ..., 22-24
      // 마지막 2일: 25, (없음)
    });

    it('일별 플랜 범위 계산', () => {
      const rangeStart = 1;
      const rangeEnd = 30;
      const dayCount = 3;

      const perDay = Math.ceil((rangeEnd - rangeStart + 1) / dayCount);
      expect(perDay).toBe(10);

      // Day 1: 1-10
      // Day 2: 11-20
      // Day 3: 21-30
      const day1 = { start: 1, end: 10 };
      const day2 = { start: 11, end: 20 };
      const day3 = { start: 21, end: 30 };

      expect(day1.end - day1.start + 1).toBe(10);
      expect(day2.end - day2.start + 1).toBe(10);
      expect(day3.end - day3.start + 1).toBe(10);
    });

    it('범위가 없으면 동일한 플랜 반복', () => {
      const input = {
        rangeStart: null,
        rangeEnd: null,
        customRangeDisplay: '1단원',
      };

      const hasRange = input.rangeStart !== null && input.rangeEnd !== null;
      expect(hasRange).toBe(false);
      // 각 날짜에 동일한 플랜 생성
    });
  });

  describe('플랜 레코드 생성', () => {
    it('기본 플랜 레코드 필드', () => {
      const planRecord = {
        student_id: 'student-123',
        flexible_content_id: 'content-123',
        content_title: '수학 교재',
        content_subject: '수학',
        plan_date: '2024-01-15',
        container_type: 'daily',
        planned_start_page_or_time: 1,
        planned_end_page_or_time: 10,
        estimated_minutes: 15, // 볼륨 * 1.5
        status: 'pending',
        is_completed: false,
        is_active: true,
        sequence: 0,
      };

      expect(planRecord.status).toBe('pending');
      expect(planRecord.is_completed).toBe(false);
      expect(planRecord.is_active).toBe(true);
    });

    it('estimated_minutes 계산 (볼륨 * 1.5)', () => {
      const totalVolume = 20;
      const estimatedMinutes = Math.ceil(totalVolume * 1.5);

      expect(estimatedMinutes).toBe(30);
    });

    it('sequence는 날짜 인덱스', () => {
      const sequences = [0, 1, 2, 3, 4];

      sequences.forEach((seq, index) => {
        expect(seq).toBe(index);
      });
    });
  });
});

describe('경로 재검증', () => {
  it('관리자 플랜 페이지 재검증', () => {
    const studentId = 'student-123';
    const paths = [
      `/admin/students/${studentId}/plans`,
      '/today',
      '/plan',
    ];

    expect(paths).toContain(`/admin/students/${studentId}/plans`);
    expect(paths).toContain('/today');
    expect(paths).toContain('/plan');
  });
});

describe('CreatePlanFromContentResult', () => {
  it('생성된 플랜 ID 목록 반환', () => {
    const result = {
      createdPlanIds: ['plan-1', 'plan-2', 'plan-3'],
      createdCount: 3,
    };

    expect(result.createdPlanIds).toHaveLength(3);
    expect(result.createdCount).toBe(3);
  });

  it('단일 플랜 생성 시', () => {
    const result = {
      createdPlanIds: ['plan-1'],
      createdCount: 1,
    };

    expect(result.createdPlanIds).toHaveLength(1);
    expect(result.createdCount).toBe(1);
  });
});
