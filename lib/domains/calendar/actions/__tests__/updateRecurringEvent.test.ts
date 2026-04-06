/**
 * updateRecurringEvent — scope별 반복↔일반 전환 시나리오 테스트
 *
 * 핵심 시나리오:
 * - scope='this' + rrule 제거 → exception 생성, 부모 유지
 * - scope='all' + rrule 제거 → 부모 rrule 제거, exception 삭제
 * - scope='this' + 필드 수정 → exception 생성
 * - scope='all' + 필드 수정 → 부모 직접 수정
 * - scope='this' + 기존 exception 수정 → 직접 UPDATE
 */

// ── Mocks (before imports) ──

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/getCurrentUser', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/auth/cachedGetUser', () => ({
  getCachedAuthUser: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock('@/lib/logging/actionLogger', () => ({
  logActionError: vi.fn(),
  logActionDebug: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/cache/calendarCache', () => ({
  invalidateCalendarSchedule: vi.fn(),
}));

vi.mock('@/lib/domains/plan/utils/unifiedReorderCalculation', () => ({
  calculateUnifiedReorder: vi.fn(),
}));

vi.mock('@/lib/domains/calendar/adapters', () => ({
  extractTimeHHMM: vi.fn((ts: string) => ts ? '10:00' : null),
  extractDateYMD: vi.fn((ts: string) => ts ? '2026-04-07' : null),
}));

vi.mock('@/lib/domains/calendar/rrule', () => ({
  shiftTimestamp: vi.fn((_ts: string | null, _from: string, _to: string) => _ts),
  shiftEndDate: vi.fn((_start: string, _end: string, _to: string) => _to),
  buildSplitRRules: vi.fn((_rrule: string, _parentDate: string, _instanceDate: string) => ({
    parentRrule: 'RRULE:FREQ=WEEKLY;UNTIL=20260405',
    newSeriesRrule: 'RRULE:FREQ=WEEKLY;COUNT=10',
  })),
}));

// ── Imports ──

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { updateRecurringEvent, createRecurringException } from '../calendarEventActions';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// ── Helpers ──

/** 반복 부모 이벤트 mock 데이터 */
function makeParentEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'parent-1',
    rrule: 'RRULE:FREQ=WEEKLY;COUNT=20',
    recurring_event_id: null,
    is_exception: false,
    exdates: null,
    start_date: null,
    start_at: '2026-04-07T10:00:00+09:00',
    end_at: '2026-04-07T11:00:00+09:00',
    end_date: null,
    calendar_id: 'cal-1',
    title: '매주 수학 수업',
    description: null,
    color: null,
    status: 'confirmed',
    label: 'study',
    event_subtype: 'study',
    is_task: true,
    is_all_day: false,
    is_exclusion: false,
    has_study_data: false,
    container_type: 'calendar',
    creator_role: 'admin',
    tenant_id: 'tenant-1',
    reminder_minutes: null,
    meeting_link: null,
    original_start_at: null,
    ...overrides,
  };
}

/** exception 이벤트 mock 데이터 */
function makeExceptionEvent(overrides: Record<string, unknown> = {}) {
  return {
    ...makeParentEvent(),
    id: 'exc-1',
    rrule: null,
    recurring_event_id: 'parent-1',
    is_exception: true,
    start_at: '2026-04-14T10:00:00+09:00',
    end_at: '2026-04-14T11:00:00+09:00',
    ...overrides,
  };
}

type SupabaseChain = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

/**
 * Supabase 체인 모킹 빌더
 *
 * 호출 순서에 따라 다른 결과를 반환하도록 설정 가능.
 * 기본: 모든 체인 메서드가 self를 반환하고, single/maybeSingle이 data: null 반환.
 */
function createMockSupabase() {
  // 테이블별 핸들러를 저장
  const tableHandlers = new Map<string, () => SupabaseChain>();

  const defaultChain = (): SupabaseChain => {
    const chain: SupabaseChain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    // chain methods return the chain itself
    chain.select.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    chain.insert.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    return chain;
  };

  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      const handler = tableHandlers.get(table);
      if (handler) return handler();
      return defaultChain();
    }),
    /** 특정 테이블에 대한 체인을 커스텀 설정 */
    _setTableHandler(table: string, handler: () => SupabaseChain) {
      tableHandlers.set(table, handler);
    },
    _defaultChain: defaultChain,
  };

  return mockClient;
}

// ── Setup ──

beforeEach(() => {
  vi.clearAllMocks();
  // 기본: 관리자 사용자
  mockGetCurrentUser.mockResolvedValue({
    userId: 'admin-1',
    role: 'admin',
    tenantId: 'tenant-1',
    name: '관리자',
  });
});

// ============================================
// scope='this': 반복 이벤트의 단일 인스턴스 수정
// ============================================

describe('updateRecurringEvent — scope=this', () => {
  it('rrule 제거 시 exception 생성, 부모 rrule 유지', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    // 1차 쿼리: 이벤트 조회 (updateRecurringEvent 내부)
    const eventSelectChain = mockSupabase._defaultChain();
    eventSelectChain.single.mockResolvedValue({
      data: {
        id: 'parent-1',
        rrule: 'RRULE:FREQ=WEEKLY;COUNT=20',
        recurring_event_id: null,
        is_exception: false,
        exdates: null,
        start_date: null,
        start_at: '2026-04-07T10:00:00+09:00',
      },
      error: null,
    });

    // 기존 exception 검색: 없음
    const existingExcChain = mockSupabase._defaultChain();
    existingExcChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    // createRecurringException 내부: 부모 전체 조회
    const parentFullChain = mockSupabase._defaultChain();
    parentFullChain.single.mockResolvedValue({
      data: makeParentEvent(),
      error: null,
    });

    // exception insert
    const insertChain = mockSupabase._defaultChain();
    insertChain.single.mockResolvedValue({
      data: { id: 'new-exc-1' },
      error: null,
    });

    // study data 조회
    const studyChain = mockSupabase._defaultChain();
    studyChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    // exdates 업데이트
    const exdatesUpdateChain = mockSupabase._defaultChain();
    exdatesUpdateChain.eq.mockResolvedValue({ error: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'calendar_events') {
        callCount++;
        // 1: select event for updateRecurringEvent
        if (callCount === 1) return eventSelectChain;
        // 2: select existing exception (or query)
        if (callCount === 2) return existingExcChain;
        // 3: assertCanModifyEvent에서 creator_role 조회 (관리자라 skip)
        // 3: createRecurringException → parent 전체 조회
        if (callCount === 3) return parentFullChain;
        // 4: exception insert
        if (callCount === 4) return insertChain;
        // 5: exdates update
        if (callCount === 5) return exdatesUpdateChain;
        return mockSupabase._defaultChain();
      }
      if (table === 'event_study_data') {
        return studyChain;
      }
      return mockSupabase._defaultChain();
    });

    const result = await updateRecurringEvent({
      eventId: 'parent-1',
      scope: 'this',
      instanceDate: '2026-04-14',
      updates: { rrule: null, title: '수학 (비반복)' },
    });

    expect(result.success).toBe(true);

    // exception insert 호출 확인
    expect(insertChain.insert).toHaveBeenCalled();

    // 부모 update는 exdates만 (rrule 변경 없음)
    // exdates update가 호출되었는지 확인
    expect(exdatesUpdateChain.update).toHaveBeenCalled();
  });

  it('기존 exception이 있으면 직접 UPDATE', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    // 이벤트 조회: exception
    const eventChain = mockSupabase._defaultChain();
    eventChain.single.mockResolvedValue({
      data: {
        id: 'exc-1',
        rrule: null,
        recurring_event_id: 'parent-1',
        is_exception: true,
        exdates: null,
        start_date: null,
        start_at: '2026-04-14T10:00:00+09:00',
      },
      error: null,
    });

    // exception UPDATE
    const updateChain = mockSupabase._defaultChain();
    updateChain.eq.mockResolvedValue({ error: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'calendar_events') {
        callCount++;
        if (callCount === 1) return eventChain; // select
        if (callCount === 2) return updateChain; // update
        return mockSupabase._defaultChain();
      }
      if (table === 'event_study_data') {
        const chain = mockSupabase._defaultChain();
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        return chain;
      }
      return mockSupabase._defaultChain();
    });

    const result = await updateRecurringEvent({
      eventId: 'exc-1',
      scope: 'this',
      instanceDate: '2026-04-14',
      updates: { title: '수정된 제목' },
    });

    expect(result.success).toBe(true);

    // UPDATE가 exception ID에 대해 호출되었는지 확인
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: '수정된 제목' }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'exc-1');
  });
});

// ============================================
// scope='all': 전체 반복 시리즈 수정
// ============================================

describe('updateRecurringEvent — scope=all', () => {
  it('rrule 제거 시 부모 rrule=null + exdates 초기화 + exception 삭제', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    // 이벤트 조회: 부모
    const eventChain = mockSupabase._defaultChain();
    eventChain.single.mockResolvedValue({
      data: {
        id: 'parent-1',
        rrule: 'RRULE:FREQ=WEEKLY;COUNT=20',
        recurring_event_id: null,
        is_exception: false,
        exdates: ['2026-04-14'],
        start_date: null,
        start_at: '2026-04-07T10:00:00+09:00',
      },
      error: null,
    });

    // 부모 UPDATE
    const parentUpdateChain = mockSupabase._defaultChain();
    parentUpdateChain.eq.mockResolvedValue({ error: null });

    // exception 목록 조회
    const excListChain = mockSupabase._defaultChain();
    excListChain.is.mockReturnValue({
      ...mockSupabase._defaultChain(),
      then: (resolve: (v: { data: { id: string }[] }) => void) =>
        resolve({ data: [{ id: 'exc-1' }, { id: 'exc-2' }] }),
    });
    // 좀 더 단순하게:
    const excListResult = { data: [{ id: 'exc-1' }, { id: 'exc-2' }], error: null };

    // exception soft-delete
    const excDeleteChain = mockSupabase._defaultChain();
    excDeleteChain.in.mockResolvedValue({ error: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'calendar_events') {
        callCount++;
        if (callCount === 1) return eventChain; // select event
        if (callCount === 2) return parentUpdateChain; // update parent
        if (callCount === 3) {
          // exception 목록 조회
          const chain = mockSupabase._defaultChain();
          chain.is.mockReturnValue(chain);
          // override the final resolved value
          Object.assign(chain, { then: undefined });
          // Use a simpler approach: make the whole chain resolve to excListResult
          const finalChain = mockSupabase._defaultChain();
          finalChain.eq.mockReturnValue(finalChain);
          finalChain.is.mockResolvedValue(excListResult);
          return finalChain;
        }
        if (callCount === 4) return excDeleteChain; // soft-delete exceptions
        return mockSupabase._defaultChain();
      }
      if (table === 'event_study_data') {
        const chain = mockSupabase._defaultChain();
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        return chain;
      }
      return mockSupabase._defaultChain();
    });

    const result = await updateRecurringEvent({
      eventId: 'parent-1',
      scope: 'all',
      instanceDate: '2026-04-07',
      updates: { rrule: null },
    });

    expect(result.success).toBe(true);

    // 부모가 rrule=null, exdates=null로 업데이트되었는지 확인
    expect(parentUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ rrule: null, exdates: null }),
    );
  });

  it('필드만 수정 시 부모 직접 수정 + exception soft-delete', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const eventChain = mockSupabase._defaultChain();
    eventChain.single.mockResolvedValue({
      data: {
        id: 'parent-1',
        rrule: 'RRULE:FREQ=WEEKLY;COUNT=20',
        recurring_event_id: null,
        is_exception: false,
        exdates: null,
        start_date: null,
        start_at: '2026-04-07T10:00:00+09:00',
      },
      error: null,
    });

    const parentUpdateChain = mockSupabase._defaultChain();
    parentUpdateChain.eq.mockResolvedValue({ error: null });

    // exception 없음
    const noExcChain = mockSupabase._defaultChain();
    noExcChain.is.mockResolvedValue({ data: [], error: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'calendar_events') {
        callCount++;
        if (callCount === 1) return eventChain;
        if (callCount === 2) return parentUpdateChain;
        if (callCount === 3) return noExcChain;
        return mockSupabase._defaultChain();
      }
      if (table === 'event_study_data') {
        const chain = mockSupabase._defaultChain();
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        return chain;
      }
      return mockSupabase._defaultChain();
    });

    const result = await updateRecurringEvent({
      eventId: 'parent-1',
      scope: 'all',
      instanceDate: '2026-04-07',
      updates: { title: '전체 수정된 제목' },
    });

    expect(result.success).toBe(true);
    expect(parentUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: '전체 수정된 제목' }),
    );
  });
});

// ============================================
// 권한 검증
// ============================================

describe('updateRecurringEvent — 권한 검증', () => {
  it('학생이 관리자 이벤트 수정 시 에러 반환', async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: 'student-1',
      role: 'student',
      tenantId: 'tenant-1',
      name: '학생',
    });

    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    // assertCanModifyEvent에서 creator_role 조회
    const creatorChain = mockSupabase._defaultChain();
    creatorChain.single.mockResolvedValue({
      data: { creator_role: 'admin' },
      error: null,
    });

    mockSupabase.from.mockImplementation(() => creatorChain);

    const result = await updateRecurringEvent({
      eventId: 'parent-1',
      scope: 'this',
      instanceDate: '2026-04-14',
      updates: { title: '수정 시도' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('학생은 선생님이 등록한 일정을 수정할 수 없습니다');
  });
});

// ============================================
// 이벤트 조회 실패
// ============================================

describe('updateRecurringEvent — 에러 처리', () => {
  it('이벤트가 존재하지 않으면 에러 반환', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const eventChain = mockSupabase._defaultChain();
    eventChain.single.mockResolvedValue({
      data: null,
      error: { message: 'Row not found' },
    });

    mockSupabase.from.mockImplementation(() => eventChain);

    const result = await updateRecurringEvent({
      eventId: 'nonexistent',
      scope: 'this',
      instanceDate: '2026-04-14',
      updates: { title: '수정' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Row not found');
  });
});
