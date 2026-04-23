/**
 * Phase E-1 Sprint 2.1: applyCreatePlan 서버 액션 가드 테스트.
 *
 * 실제 DB INSERT 경로는 HITL 수동 검증으로 갈음하고, 여기서는 auth / role /
 * 학생·tenant / 스키마 / UNIQUE-skip 분기를 커버. Supabase mock 은
 * artifactApply.test.ts 패턴 재사용.
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

import { applyCreatePlan } from "../createPlan";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CreatePlanInput } from "@/lib/mcp/tools/createPlan";

type FakeResponse<T> = { data: T | null; error: { message: string } | null };

function makeThenable(finalResponse: FakeResponse<unknown>) {
  const self: Record<string, unknown> = {};
  const chain = (..._args: unknown[]) => self;
  for (const fn of [
    "select",
    "eq",
    "in",
    "is",
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
const SUBJECT_ID_A = "22222222-2222-2222-2222-222222222222";
const SUBJECT_ID_B = "33333333-3333-3333-3333-333333333333";

function makeValidInput(overrides?: Partial<CreatePlanInput>): CreatePlanInput {
  return {
    studentId: STUDENT_ID,
    studentName: "김세린",
    courses: [
      {
        subjectId: SUBJECT_ID_A,
        subjectName: "경제수학",
        grade: 2,
        semester: 2,
      },
      {
        subjectId: SUBJECT_ID_B,
        subjectName: "물리학I",
        grade: 2,
        semester: 2,
      },
    ],
    ...overrides,
  };
}

describe("applyCreatePlan — guard paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await applyCreatePlan(makeValidInput());
    expect(result).toEqual({ ok: false, reason: "로그인이 필요합니다." });
  });

  it("student role 은 차단", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    const result = await applyCreatePlan(makeValidInput());
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
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/관리자·컨설턴트/);
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
    const result = await applyCreatePlan(makeValidInput());
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
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/학생을 찾을 수 없거나/);
  });

  it("superadmin 은 cross-tenant 학생 접근 가능", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "superadmin",
      tenantId: null,
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-OTHER" }, error: null }, // 학생
        { data: [], error: null }, // 기존 plans 없음
        { data: [{ id: "p-1" }, { id: "p-2" }], error: null }, // insert 반환
      ]) as never,
    );
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdCount).toBe(2);
      expect(result.skippedCount).toBe(0);
    }
  });

  it("모든 slot 이 이미 존재하면 ok:false 로 전체 skip 안내", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "consultant",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        {
          data: [
            { subject_id: SUBJECT_ID_A, grade: 2, semester: 2 },
            { subject_id: SUBJECT_ID_B, grade: 2, semester: 2 },
          ],
          error: null,
        },
      ]) as never,
    );
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/이미 등록된/);
  });

  it("일부 slot 만 존재하면 나머지를 INSERT", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        {
          data: [{ subject_id: SUBJECT_ID_A, grade: 2, semester: 2 }],
          error: null,
        },
        { data: [{ id: "p-new" }], error: null },
      ]) as never,
    );
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    }
  });

  it("정상 경로: 2건 INSERT 성공", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        { data: [], error: null },
        { data: [{ id: "p-1" }, { id: "p-2" }], error: null },
      ]) as never,
    );
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.studentId).toBe(STUDENT_ID);
    }
  });

  it("INSERT DB 오류 시 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: { id: STUDENT_ID, tenant_id: "t-1" }, error: null },
        { data: [], error: null },
        { data: null, error: { message: "unique violation" } },
      ]) as never,
    );
    const result = await applyCreatePlan(makeValidInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/수강 계획 생성 실패/);
  });

  it("Zod validation 실패 (studentId UUID 아님)", async () => {
    const result = await applyCreatePlan({
      ...makeValidInput(),
      studentId: "not-a-uuid",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });

  it("Zod validation 실패 (courses 빈 배열)", async () => {
    const result = await applyCreatePlan({
      ...makeValidInput(),
      courses: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });
});
