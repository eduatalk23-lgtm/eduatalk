/**
 * Phase C-3 Sprint 2: applyArtifactEdit 서버 액션 가드 테스트.
 *
 * 네트워크/DB 부작용이 있는 경로(실제 updateInternalScoreData 호출)는 HITL
 * 수동 검증으로 갈음하고, 여기서는 **사전 차단 분기**(auth/tenant/type/row.id)만
 * 커버한다. Supabase mock 은 builder chain 패턴 재사용.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// getCurrentUser / createSupabaseServerClient / 관련 외부 의존을 먼저 mock.
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/domains/analysis/actions/riskIndex", () => ({
  recalculateRiskIndex: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { applyArtifactEdit } from "../artifactApply";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    "update",
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

/**
 * from(table) 호출 순서대로 response 를 반환. 순서가 바뀌면 테스트 가정도 수정해야 한다.
 * applyArtifactEdit 내부 호출 순서:
 *   1) ai_artifacts
 *   2) ai_artifact_versions
 *   3) student_internal_scores (in)
 *   4) curriculum_revisions (in) — rows 있으면
 *   5) subject_types / subjects / subject_groups (병렬, 순서 불확정)
 */
function makeSupabaseWithResponses(
  responses: Array<FakeResponse<unknown>>,
) {
  let i = 0;
  return {
    from: (_table: string) => {
      const r = responses[i] ?? { data: [], error: null };
      i += 1;
      return makeThenable(r);
    },
  };
}

// Sprint 3: applyArtifactEdit 의 artifactId 가 Zod 로 UUID 형식 검증됨.
const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("applyArtifactEdit — guard paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result).toEqual({ ok: false, reason: "로그인이 필요합니다." });
  });

  it("tenantId 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: null,
      email: null,
    });
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/기관 정보/);
  });

  it("artifact 찾을 수 없으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        { data: null, error: null }, // ai_artifacts lookup empty
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/아티팩트/);
  });

  it("type 이 'scores' 아닌 미지원 type 은 일반 에러 reason", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "generic", // not in SUPPORTED nor FUTURE
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/성적 아티팩트만/);
  });

  it("version props 못 찾으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 2,
          },
          error: null,
        },
        { data: null, error: null }, // version lookup empty
      ]) as never,
    );
    const result = await applyArtifactEdit({
      artifactId: VALID_UUID,
      versionNo: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/v2/);
  });

  it("props.rows 비어있으면 ok:false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
        { data: { props: { ok: true, rows: [] }, version_no: 1 }, error: null },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/행이 없습니다/);
  });

  it("과거 artifact(row.id 누락) 는 안내 reason 반환", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "student",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
        {
          data: {
            props: {
              ok: true,
              rows: [
                {
                  subjectGroup: "수학",
                  subject: "수학I",
                  grade: 2,
                  semester: 1,
                  rawScore: 92,
                  rankGrade: 2,
                  creditHours: 4,
                  // id 없음 — 구 버전 스냅샷
                },
              ],
            },
            version_no: 1,
          },
          error: null,
        },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/구 버전 스냅샷/);
  });
});

// ============================================
// Sprint 3 — Zod 입력·props 런타임 검증 + 향후 type dispatch
// ============================================

describe("applyArtifactEdit — Sprint 3 Zod input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("UUID 형식이 아닌 artifactId 는 즉시 차단 (auth/DB 호출 전)", async () => {
    const result = await applyArtifactEdit({ artifactId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("versionNo 가 음수면 차단", async () => {
    const result = await applyArtifactEdit({
      artifactId: VALID_UUID,
      versionNo: -1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });

  it("versionNo 가 0 (positive 위반) 도 차단", async () => {
    const result = await applyArtifactEdit({
      artifactId: VALID_UUID,
      versionNo: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/입력 형식 오류/);
  });
});

describe("applyArtifactEdit — Sprint 3 future type dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Sprint P2 (2026-04-21): 'plan' 은 이제 SUPPORTED_TYPES — FUTURE 에서 제외.
  for (const futureType of ["analysis", "blueprint"] as const) {
    it(`'${futureType}' type 은 곧 지원 예정 안내`, async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        userId: "u-1",
        role: "admin",
        tenantId: "t-1",
        email: null,
      });
      vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
        makeSupabaseWithResponses([
          {
            data: {
              id: VALID_UUID,
              type: futureType,
              tenant_id: "t-1",
              owner_user_id: "u-1",
              latest_version: 1,
            },
            error: null,
          },
        ]) as never,
      );
      const result = await applyArtifactEdit({ artifactId: VALID_UUID });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(futureType);
        expect(result.reason).toMatch(/곧 지원/);
      }
    });
  }
});

describe("applyArtifactEdit — Sprint 3 props.rows shape validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rawScore 가 100 초과면 데이터 형식 오류", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
        {
          data: {
            props: {
              ok: true,
              rows: [
                {
                  id: "score-1",
                  subjectGroup: "수학",
                  subject: "수학I",
                  grade: 2,
                  semester: 1,
                  rawScore: 999, // 범위 초과
                  rankGrade: 1,
                  creditHours: 4,
                },
              ],
            },
            version_no: 1,
          },
          error: null,
        },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/데이터 형식 오류/);
  });

  it("rankGrade 가 9 초과면 데이터 형식 오류", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
        {
          data: {
            props: {
              ok: true,
              rows: [
                {
                  id: "score-1",
                  subjectGroup: "수학",
                  subject: "수학I",
                  grade: 2,
                  semester: 1,
                  rawScore: 90,
                  rankGrade: 12, // 범위 초과
                  creditHours: 4,
                },
              ],
            },
            version_no: 1,
          },
          error: null,
        },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/데이터 형식 오류/);
  });

  it("rows 가 array 가 아니면 데이터 형식 오류", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      userId: "u-1",
      role: "admin",
      tenantId: "t-1",
      email: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseWithResponses([
        {
          data: {
            id: VALID_UUID,
            type: "scores",
            tenant_id: "t-1",
            owner_user_id: "u-1",
            latest_version: 1,
          },
          error: null,
        },
        {
          data: {
            props: { ok: true, rows: "not-an-array" },
            version_no: 1,
          },
          error: null,
        },
      ]) as never,
    );
    const result = await applyArtifactEdit({ artifactId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/데이터 형식 오류/);
  });
});
