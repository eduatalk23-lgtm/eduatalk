/**
 * Phase E-1 Sprint 2.2: applyScheduleMeeting 서버 액션 가드 테스트.
 *
 * 실제 DB INSERT 경로는 HITL 수동 검증으로 갈음하고, 여기서는 auth / role /
 * 학생·tenant / 과거 시각 / 충돌 / calendar resolve 분기를 커버.
 * createPlan.test.ts 패턴 복제.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/domains/calendar/helpers", () => ({
  ensureStudentPrimaryCalendar: vi.fn(),
  ensureAdminPrimaryCalendar: vi.fn(),
}));
vi.mock("@/lib/domains/googleCalendar/enqueue", () => ({
  enqueueGoogleCalendarSync: vi.fn().mockResolvedValue(undefined),
}));

import { applyScheduleMeeting } from "../scheduleMeeting";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureStudentPrimaryCalendar,
  ensureAdminPrimaryCalendar,
} from "@/lib/domains/calendar/helpers";
import type { ScheduleMeetingInput } from "@/lib/mcp/tools/scheduleMeeting";

type FakeResponse<T> = { data: T | null; error: { message: string } | null };

function makeThenable(finalResponse: FakeResponse<unknown>) {
  const self: Record<string, unknown> = {};
  const chain = (..._args: unknown[]) => self;
  for (const fn of [
    "select",
    "eq",
    "in",
    "is",
    "neq",
    "lt",
    "gt",
    "order",
    "limit",
    "insert",
    "maybeSingle",
    "single",
  ]) {
    self[fn] = chain;
  }
  self.then = (resolve: (v: FakeResponse<unknown>) => void) =>
    resolve(finalResponse);
  return self;
}

function makeSupabaseWithResponses(responses: Array<FakeResponse<unknown>>) {
  let i = 0;
  return {
    from: (_table: string) => {
      const r = responses[i] ?? { data: [], error: null };
      i += 1;
      return makeThenable(r);
    },
  };
}

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const CAL_ID = "cal-student-1";

// 미래 시각 — 테스트 실행 시 항상 유효하도록 고정 offset.
const FUTURE_START = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const FUTURE_END = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

function makeValidInput(overrides?: Partial<ScheduleMeetingInput>): ScheduleMeetingInput {
  return {
    studentId: STUDENT_ID,
    studentName: "김세린",
    title: "수시 방향 면담",
    startAt: FUTURE_START,
    endAt: FUTURE_END,
    ...overrides,
  } as ScheduleMeetingInput;
}

describe("applyScheduleMeeting — guard paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result).toEqual({ ok: false, reason: "로그인이 필요합니다." });
  });

  it("student role 은 차단", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/관리자·컨설턴트/);
  });

  it("parent role 도 차단", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "parent",
      tenantId: "t-1",
      email: null,
    });
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/관리자·컨설턴트/);
  });

  it("과거 시각은 거부", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = await applyScheduleMeeting({
      ...makeValidInput({ startAt: past, endAt: pastEnd }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/과거 시각/);
  });

  it("학생을 찾을 수 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: null, error: null }, // students lookup empty
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/학생을 찾을 수 없거나/);
  });

  it("admin 이 cross-tenant 학생 접근 시 차단", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-OTHER" }, error: null },
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/학생을 찾을 수 없거나/);
  });

  it("studentId 없음 + user.tenantId 없음(superadmin) 이면 안내 reason", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "superadmin",
      tenantId: null,
      email: null,
    });
    const input = makeValidInput({ studentId: null, studentName: null });
    const result = await applyScheduleMeeting(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/studentId/);
  });

  it("충돌 감지 — 같은 시간대 이벤트 존재 시 차단", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValueOnce(CAL_ID);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        { data: [{ id: "conflict-1" }], error: null }, // 충돌
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/같은 시간대/);
  });

  it("정상 경로(학생 대상) — INSERT 성공 + Google 동기화 요청", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValueOnce(CAL_ID);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        { data: [], error: null }, // 충돌 없음
        { data: { id: "event-1" }, error: null }, // INSERT
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventId).toBe("event-1");
      expect(result.calendarScope).toBe("student");
      expect(result.syncedToGoogle).toBe(true);
      expect(result.studentId).toBe(STUDENT_ID);
    }
  });

  it("정상 경로(관리자 개인) — syncGoogle=false graceful", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(ensureAdminPrimaryCalendar).mockResolvedValueOnce(CAL_ID);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: [], error: null }, // 충돌 없음
        { data: { id: "event-2" }, error: null }, // INSERT
      ]) as never,
    );
    const result = await applyScheduleMeeting(
      makeValidInput({ studentId: null, studentName: null, syncGoogle: false }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.calendarScope).toBe("admin");
      expect(result.syncedToGoogle).toBe(false);
      expect(result.studentId).toBeNull();
    }
  });

  it("superadmin cross-tenant 학생 접근 가능", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-sa",
      role: "superadmin",
      tenantId: null,
      email: null,
    });
    vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValueOnce(CAL_ID);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-OTHER" }, error: null },
        { data: [], error: null },
        { data: { id: "event-sa" }, error: null },
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.calendarScope).toBe("student");
      expect(result.syncedToGoogle).toBe(true);
    }
  });

  it("INSERT DB 오류 시 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValueOnce(CAL_ID);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        { data: [], error: null },
        { data: null, error: { message: "constraint violation" } },
      ]) as never,
    );
    const result = await applyScheduleMeeting(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/일정 등록 실패/);
  });

  it("Zod validation 실패 (endAt < startAt)", async () => {
    const result = await applyScheduleMeeting({
      ...makeValidInput(),
      startAt: FUTURE_END,
      endAt: FUTURE_START,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });

  it("Zod validation 실패 (title 빈 문자열)", async () => {
    const result = await applyScheduleMeeting({
      ...makeValidInput(),
      title: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });
});
