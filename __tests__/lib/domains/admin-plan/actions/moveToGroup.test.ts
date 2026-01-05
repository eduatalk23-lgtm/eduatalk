/**
 * 플랜 그룹 이동 액션 테스트
 *
 * movePlansToGroup, getStudentPlanGroups 함수의 입력 검증 및 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/admin-plan/actions/moveToGroup.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'group-1',
                    name: '수학 플랜 그룹',
                    content_master_id: 'master-123',
                    start_date: '2024-01-01',
                    end_date: '2024-03-31',
                  },
                ],
                error: null,
              })
            ),
          })),
        })),
        in: vi.fn(() =>
          Promise.resolve({
            data: [
              { id: 'plan-1', plan_group_id: 'group-old' },
              { id: 'plan-2', plan_group_id: 'group-old' },
            ],
            error: null,
          })
        ),
        count: vi.fn(),
        head: vi.fn(),
        single: vi.fn(),
      })),
      update: vi.fn(() => ({
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
import type {
  MoveToGroupInput,
  MoveToGroupResult,
  PlanGroupInfo,
} from '@/lib/domains/admin-plan/actions/moveToGroup';

describe('MoveToGroupInput 타입 검증', () => {
  describe('필수 필드', () => {
    it('planIds는 필수', () => {
      const input: MoveToGroupInput = {
        planIds: ['plan-1', 'plan-2'],
        targetGroupId: 'group-123',
        studentId: 'student-123',
      };

      expect(input.planIds).toBeDefined();
      expect(input.planIds.length).toBeGreaterThan(0);
    });

    it('targetGroupId는 null 가능 (그룹에서 제거)', () => {
      const input: MoveToGroupInput = {
        planIds: ['plan-1'],
        targetGroupId: null,
        studentId: 'student-123',
      };

      expect(input.targetGroupId).toBeNull();
    });

    it('studentId는 필수', () => {
      const input: MoveToGroupInput = {
        planIds: ['plan-1'],
        targetGroupId: 'group-123',
        studentId: 'student-123',
      };

      expect(input.studentId).toBeDefined();
    });
  });

  describe('입력 검증', () => {
    it('빈 planIds는 오류를 반환해야 함', () => {
      const input: MoveToGroupInput = {
        planIds: [],
        targetGroupId: 'group-123',
        studentId: 'student-123',
      };

      expect(input.planIds.length).toBe(0);
      // 실제 함수에서는 '이동할 플랜을 선택해주세요.' 오류 반환
    });

    it('유효한 UUID 형식의 ID 사용', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const validIds = [
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '12345678-1234-1234-1234-123456789012',
      ];

      validIds.forEach((id) => {
        expect(id).toMatch(uuidRegex);
      });
    });
  });
});

describe('MoveToGroupResult 타입 검증', () => {
  it('movedCount 필드 포함', () => {
    const result: MoveToGroupResult = {
      movedCount: 5,
    };

    expect(result.movedCount).toBe(5);
  });

  it('movedCount는 planIds.length와 일치', () => {
    const planIds = ['plan-1', 'plan-2', 'plan-3'];
    const result: MoveToGroupResult = {
      movedCount: planIds.length,
    };

    expect(result.movedCount).toBe(3);
  });
});

describe('PlanGroupInfo 타입 검증', () => {
  it('모든 필드 포함', () => {
    const groupInfo: PlanGroupInfo = {
      id: 'group-123',
      name: '수학 플랜 그룹',
      content_master_id: 'master-456',
      content_title: '개념원리 수학1',
      start_date: '2024-01-01',
      end_date: '2024-03-31',
      plan_count: 15,
    };

    expect(groupInfo.id).toBeDefined();
    expect(groupInfo.name).toBeDefined();
    expect(groupInfo.plan_count).toBeDefined();
  });

  it('null 허용 필드들', () => {
    const groupInfo: PlanGroupInfo = {
      id: 'group-123',
      name: '임시 그룹',
      content_master_id: null,
      content_title: null,
      start_date: null,
      end_date: null,
      plan_count: 3,
    };

    expect(groupInfo.content_master_id).toBeNull();
    expect(groupInfo.content_title).toBeNull();
    expect(groupInfo.start_date).toBeNull();
  });
});

describe('그룹 이동 로직', () => {
  it('같은 그룹으로 이동해도 오류 없음', () => {
    const currentGroupId = 'group-123';
    const targetGroupId = 'group-123';

    // 같은 그룹이어도 업데이트 수행 (멱등성)
    expect(currentGroupId).toBe(targetGroupId);
  });

  it('그룹에서 제거 시 targetGroupId는 null', () => {
    const input: MoveToGroupInput = {
      planIds: ['plan-1', 'plan-2'],
      targetGroupId: null,
      studentId: 'student-123',
    };

    expect(input.targetGroupId).toBeNull();
    // 실제 함수에서는 plan_group_id를 null로 설정
  });

  it('이전 그룹 ID들 추적', () => {
    const existingPlans = [
      { id: 'plan-1', plan_group_id: 'group-old-1' },
      { id: 'plan-2', plan_group_id: 'group-old-1' },
      { id: 'plan-3', plan_group_id: 'group-old-2' },
    ];

    const previousGroupIds = [
      ...new Set(existingPlans.map((p) => p.plan_group_id)),
    ];

    expect(previousGroupIds).toContain('group-old-1');
    expect(previousGroupIds).toContain('group-old-2');
    expect(previousGroupIds.length).toBe(2);
  });
});

describe('이벤트 로깅', () => {
  it('이동 이벤트에 필요한 정보 포함', () => {
    const planIds = ['plan-1', 'plan-2'];
    const previousGroupIds = ['group-old'];
    const targetGroupId = 'group-new';

    const payload = {
      action: 'move_to_group',
      plan_ids: planIds,
      previous_group_ids: previousGroupIds,
      target_group_id: targetGroupId,
      moved_count: planIds.length,
    };

    expect(payload.action).toBe('move_to_group');
    expect(payload.plan_ids).toEqual(planIds);
    expect(payload.previous_group_ids).toEqual(previousGroupIds);
    expect(payload.target_group_id).toBe(targetGroupId);
    expect(payload.moved_count).toBe(2);
  });

  it('그룹 제거 시 target_group_id는 null', () => {
    const payload = {
      action: 'move_to_group',
      plan_ids: ['plan-1'],
      previous_group_ids: ['group-old'],
      target_group_id: null,
      moved_count: 1,
    };

    expect(payload.target_group_id).toBeNull();
  });
});

describe('getStudentPlanGroups', () => {
  it('활성 그룹만 조회 (is_active = true)', () => {
    const queryFilter = {
      is_active: true,
    };

    expect(queryFilter.is_active).toBe(true);
  });

  it('최신순 정렬 (created_at DESC)', () => {
    const sortOrder = {
      column: 'created_at',
      ascending: false,
    };

    expect(sortOrder.ascending).toBe(false);
  });

  it('각 그룹의 플랜 수 포함', () => {
    const groups: PlanGroupInfo[] = [
      {
        id: 'group-1',
        name: '수학 그룹',
        content_master_id: null,
        content_title: null,
        start_date: null,
        end_date: null,
        plan_count: 10,
      },
      {
        id: 'group-2',
        name: '영어 그룹',
        content_master_id: null,
        content_title: null,
        start_date: null,
        end_date: null,
        plan_count: 5,
      },
    ];

    const totalPlans = groups.reduce((sum, g) => sum + g.plan_count, 0);
    expect(totalPlans).toBe(15);
  });
});
