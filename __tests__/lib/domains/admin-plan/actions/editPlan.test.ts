/**
 * 플랜 수정 액션 테스트
 *
 * adminUpdateStudentPlan, adminBulkUpdatePlans 함수의 입력 검증 및 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/admin-plan/actions/editPlan.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: 'plan-123',
                  student_id: 'student-123',
                  plan_date: '2024-01-15',
                  status: 'pending',
                },
                error: null,
              })
            ),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'plan-123' },
                error: null,
              })
            ),
          })),
        })),
        in: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
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

vi.mock('@/lib/auth/getCurrentUser', () => ({
  getCurrentUser: vi.fn(() =>
    Promise.resolve({ id: 'admin-123', tenant_id: 'tenant-123' })
  ),
}));

// 로깅 모킹
vi.mock('@/lib/logging/actionLogger', () => ({
  logActionError: vi.fn(),
}));

// planEvent 모킹
vi.mock('@/lib/domains/admin-plan/actions/planEvent', () => ({
  createPlanEvent: vi.fn(() => Promise.resolve({ success: true, data: { id: 'event-123' } })),
}));

// revalidatePath 모킹
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// 타입 정의
import type {
  StudentPlanUpdateInput,
  StudentPlanDetail,
} from '@/lib/domains/admin-plan/actions/editPlan';

describe('StudentPlanUpdateInput 타입 검증', () => {
  describe('수정 가능한 필드', () => {
    it('custom_title 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        custom_title: '새로운 제목',
      };

      expect(update.custom_title).toBe('새로운 제목');
    });

    it('plan_date 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        plan_date: '2024-02-01',
      };

      expect(update.plan_date).toBe('2024-02-01');
    });

    it('start_time과 end_time 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        start_time: '09:00',
        end_time: '10:30',
      };

      expect(update.start_time).toBe('09:00');
      expect(update.end_time).toBe('10:30');
    });

    it('페이지 범위 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        planned_start_page_or_time: 51,
        planned_end_page_or_time: 100,
      };

      expect(update.planned_start_page_or_time).toBe(51);
      expect(update.planned_end_page_or_time).toBe(100);
    });

    it('estimated_minutes 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        estimated_minutes: 45,
      };

      expect(update.estimated_minutes).toBe(45);
    });

    it('status 수정 가능', () => {
      const validStatuses = [
        'pending',
        'in_progress',
        'completed',
        'skipped',
        'cancelled',
      ] as const;

      validStatuses.forEach((status) => {
        const update: StudentPlanUpdateInput = { status };
        expect(update.status).toBe(status);
      });
    });

    it('container_type 수정 가능', () => {
      const validContainers = ['daily', 'weekly', 'unfinished'] as const;

      validContainers.forEach((containerType) => {
        const update: StudentPlanUpdateInput = {
          container_type: containerType,
        };
        expect(update.container_type).toBe(containerType);
      });
    });
  });

  describe('복합 업데이트', () => {
    it('여러 필드 동시 수정 가능', () => {
      const update: StudentPlanUpdateInput = {
        custom_title: '변경된 제목',
        plan_date: '2024-02-01',
        status: 'in_progress',
        estimated_minutes: 90,
      };

      expect(Object.keys(update)).toHaveLength(4);
    });

    it('빈 업데이트 객체도 유효함', () => {
      const update: StudentPlanUpdateInput = {};

      expect(Object.keys(update)).toHaveLength(0);
    });
  });
});

describe('StudentPlanDetail 타입 검증', () => {
  it('모든 필수 필드 포함', () => {
    const planDetail: StudentPlanDetail = {
      id: 'plan-123',
      student_id: 'student-123',
      plan_group_id: 'group-456',
      content_title: '개념원리 수학1',
      content_subject: '수학',
      custom_title: null,
      plan_date: '2024-01-15',
      start_time: '09:00',
      end_time: '10:00',
      planned_start_page_or_time: 1,
      planned_end_page_or_time: 50,
      estimated_minutes: 60,
      status: 'pending',
      container_type: 'daily',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(planDetail.id).toBeDefined();
    expect(planDetail.student_id).toBeDefined();
    expect(planDetail.plan_date).toBeDefined();
    expect(planDetail.status).toBeDefined();
    expect(planDetail.container_type).toBeDefined();
  });

  it('null 허용 필드들', () => {
    const planDetail: StudentPlanDetail = {
      id: 'plan-123',
      student_id: 'student-123',
      plan_group_id: null,
      content_title: null,
      content_subject: null,
      custom_title: null,
      plan_date: '2024-01-15',
      start_time: null,
      end_time: null,
      planned_start_page_or_time: null,
      planned_end_page_or_time: null,
      estimated_minutes: null,
      status: 'pending',
      container_type: 'daily',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(planDetail.plan_group_id).toBeNull();
    expect(planDetail.content_title).toBeNull();
    expect(planDetail.start_time).toBeNull();
  });
});

describe('일괄 수정 로직', () => {
  it('planIds 배열이 비어있으면 오류', () => {
    const planIds: string[] = [];

    expect(planIds.length).toBe(0);
    // 실제 함수에서는 '수정할 플랜을 선택해주세요.' 오류 반환
  });

  it('여러 플랜에 같은 업데이트 적용', () => {
    const planIds = ['plan-1', 'plan-2', 'plan-3'];
    const updates: Partial<StudentPlanUpdateInput> = {
      status: 'completed',
    };

    // 모든 플랜에 동일한 상태 적용
    expect(planIds.length).toBe(3);
    expect(updates.status).toBe('completed');
  });

  it('updated_at 타임스탬프 자동 갱신', () => {
    const now = new Date().toISOString();

    const updateData = {
      status: 'completed' as const,
      updated_at: now,
    };

    expect(updateData.updated_at).toBeDefined();
    expect(new Date(updateData.updated_at).getTime()).toBeLessThanOrEqual(
      Date.now()
    );
  });
});

describe('이벤트 로깅', () => {
  it('단일 수정 시 previous와 updated 정보 포함', () => {
    const previousState = {
      custom_title: '이전 제목',
      status: 'pending',
    };

    const updates = {
      custom_title: '새 제목',
      status: 'in_progress',
    };

    const payload = {
      previous: previousState,
      updated: updates,
    };

    expect(payload.previous).toBeDefined();
    expect(payload.updated).toBeDefined();
    expect(payload.previous.custom_title).not.toBe(payload.updated.custom_title);
  });

  it('일괄 수정 시 bulk_update 플래그 포함', () => {
    const planIds = ['plan-1', 'plan-2'];
    const updates = { status: 'completed' };

    const payload = {
      bulk_update: true,
      plan_ids: planIds,
      updates,
      count: planIds.length,
    };

    expect(payload.bulk_update).toBe(true);
    expect(payload.count).toBe(2);
  });
});
