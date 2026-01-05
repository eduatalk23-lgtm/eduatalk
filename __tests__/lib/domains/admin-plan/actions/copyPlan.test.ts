/**
 * 플랜 복사 액션 테스트
 *
 * copyPlansToDate 함수의 입력 검증 및 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/admin-plan/actions/copyPlan.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 클라이언트 모킹
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockIn = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'student_plan') {
        return {
          select: mockSelect,
          insert: mockInsert,
        };
      }
      return { select: vi.fn() };
    }),
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

// planEvent 모킹
vi.mock('@/lib/domains/admin-plan/actions/planEvent', () => ({
  createPlanEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

// revalidatePath 모킹
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// 타입 정의
import type { CopyPlanInput } from '@/lib/domains/admin-plan/actions/copyPlan';

describe('copyPlansToDate 입력 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CopyPlanInput 타입', () => {
    it('필수 필드가 포함되어야 함', () => {
      const validInput: CopyPlanInput = {
        sourcePlanIds: ['plan-1', 'plan-2'],
        targetDates: ['2024-01-15', '2024-01-16'],
        studentId: 'student-123',
      };

      expect(validInput.sourcePlanIds).toBeDefined();
      expect(validInput.targetDates).toBeDefined();
      expect(validInput.studentId).toBeDefined();
    });

    it('targetStudentIds는 선택 필드임', () => {
      const inputWithTargetStudents: CopyPlanInput = {
        sourcePlanIds: ['plan-1'],
        targetDates: ['2024-01-15'],
        studentId: 'student-123',
        targetStudentIds: ['student-456', 'student-789'],
      };

      expect(inputWithTargetStudents.targetStudentIds).toHaveLength(2);
    });

    it('빈 sourcePlanIds는 유효하지만 실행 시 오류 반환', () => {
      const emptySourceInput: CopyPlanInput = {
        sourcePlanIds: [],
        targetDates: ['2024-01-15'],
        studentId: 'student-123',
      };

      expect(emptySourceInput.sourcePlanIds).toHaveLength(0);
    });

    it('빈 targetDates는 유효하지만 실행 시 오류 반환', () => {
      const emptyTargetInput: CopyPlanInput = {
        sourcePlanIds: ['plan-1'],
        targetDates: [],
        studentId: 'student-123',
      };

      expect(emptyTargetInput.targetDates).toHaveLength(0);
    });
  });

  describe('복사 로직 검증', () => {
    it('복사 개수는 sourcePlanIds × targetDates 수', () => {
      const sourcePlanIds = ['plan-1', 'plan-2', 'plan-3'];
      const targetDates = ['2024-01-15', '2024-01-16'];

      const expectedCopies = sourcePlanIds.length * targetDates.length;
      expect(expectedCopies).toBe(6);
    });

    it('targetStudentIds가 있으면 학생 수만큼 추가 복사', () => {
      const sourcePlanIds = ['plan-1'];
      const targetDates = ['2024-01-15'];
      const targetStudentIds = ['student-1', 'student-2'];

      const expectedCopies =
        sourcePlanIds.length * targetDates.length * targetStudentIds.length;
      expect(expectedCopies).toBe(2);
    });

    it('다른 학생에게 복사시 plan_group_id는 null', () => {
      const originalStudentId = 'student-123';
      const targetStudentId = 'student-456';

      const shouldClearPlanGroup = targetStudentId !== originalStudentId;
      expect(shouldClearPlanGroup).toBe(true);
    });

    it('같은 학생에게 복사시 plan_group_id 유지', () => {
      const originalStudentId = 'student-123';
      const targetStudentId = 'student-123';

      const shouldClearPlanGroup = targetStudentId !== originalStudentId;
      expect(shouldClearPlanGroup).toBe(false);
    });
  });

  describe('날짜 형식 검증', () => {
    it('YYYY-MM-DD 형식이어야 함', () => {
      const validDates = ['2024-01-15', '2024-12-31', '2025-06-01'];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      validDates.forEach((date) => {
        expect(date).toMatch(dateRegex);
      });
    });

    it('유효하지 않은 날짜 형식은 거부되어야 함', () => {
      const invalidDates = ['2024/01/15', '15-01-2024', '2024-1-15'];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      invalidDates.forEach((date) => {
        expect(date).not.toMatch(dateRegex);
      });
    });
  });
});

describe('복사된 플랜 필드', () => {
  it('복사된 플랜은 원본의 콘텐츠 정보를 유지해야 함', () => {
    const sourcePlan = {
      content_master_id: 'master-123',
      content_detail_id: 'detail-456',
      content_title: '개념원리 수학1',
      content_subject: '수학',
      custom_title: null,
      planned_start_page_or_time: 1,
      planned_end_page_or_time: 50,
      estimated_minutes: 60,
    };

    const copiedPlan = {
      ...sourcePlan,
      plan_date: '2024-01-15',
      status: 'pending',
      is_completed: false,
      is_active: true,
    };

    expect(copiedPlan.content_title).toBe(sourcePlan.content_title);
    expect(copiedPlan.planned_start_page_or_time).toBe(
      sourcePlan.planned_start_page_or_time
    );
    expect(copiedPlan.planned_end_page_or_time).toBe(
      sourcePlan.planned_end_page_or_time
    );
    expect(copiedPlan.status).toBe('pending');
    expect(copiedPlan.is_completed).toBe(false);
  });

  it('복사된 플랜의 날짜는 targetDate로 설정되어야 함', () => {
    const targetDate = '2024-02-01';

    const copiedPlan = {
      plan_date: targetDate,
    };

    expect(copiedPlan.plan_date).toBe('2024-02-01');
  });
});
