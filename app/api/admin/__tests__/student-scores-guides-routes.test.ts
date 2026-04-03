/**
 * Admin API 라우트 단위 테스트
 *
 * 커버리지:
 *   - admin/check-student-scores  (GET)
 *   - admin/guides/generate       (POST)
 *   - admin/guides/generate-retry (POST)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/scheduler/scoreLoader", () => ({
  getSchoolScoreSummary: vi.fn(),
  getMockScoreSummary: vi.fn(),
  getRiskIndexBySubject: vi.fn(),
}));

vi.mock("@/lib/domains/guide/llm/actions/executeGuideGeneration", () => ({
  executeGuideGeneration: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSchoolScoreSummary,
  getMockScoreSummary,
  getRiskIndexBySubject,
} from "@/lib/scheduler/scoreLoader";
import { executeGuideGeneration } from "@/lib/domains/guide/llm/actions/executeGuideGeneration";
import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";

// ============================================
// 공통 헬퍼
// ============================================

/** NextRequest 생성 (nextUrl.searchParams 지원) */
function makeGetRequest(url: string, searchParams?: Record<string, string>): NextRequest {
  const urlObj = new URL(url);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => urlObj.searchParams.set(k, v));
  }
  return new NextRequest(urlObj.toString(), { method: "GET" });
}

function makePostRequest(url: string, body: object): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Supabase 체이닝 mock 생성.
 *
 * check-student-scores 라우트는 같은 테이블을 여러 번 쿼리합니다:
 *   1) students (maybeSingle) — student_id로 조회
 *   2) student_school_scores (await chain) — 해당 학생 성적
 *   3) student_mock_scores (await chain) — 해당 학생 성적
 *   4) student_school_scores (await chain) — 디버그용 전체 샘플
 *   5) student_mock_scores (await chain) — 디버그용 전체 샘플
 *   6) student_school_scores (await chain) — unique student_ids
 *
 * 각 from() 호출마다 체이닝 가능하고 최종 await 시 결과를 반환하는 thenable 객체를 반환.
 */
function makeCheckScoresSupabaseMock(opts: {
  studentsResult: { data: unknown; error: unknown };
  schoolScoresResult?: { data: unknown; error: unknown };
  mockScoresResult?: { data: unknown; error: unknown };
}) {
  const empty = { data: [], error: null };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      const resolveResult = (): { data: unknown; error: unknown } => {
        if (table === "students") return opts.studentsResult;
        if (table === "student_school_scores")
          return opts.schoolScoresResult ?? empty;
        if (table === "student_mock_scores")
          return opts.mockScoresResult ?? empty;
        return empty;
      };

      const result = resolveResult();

      // thenable 체이닝 객체: select/eq/order/limit 모두 자기 자신 반환
      const chain: Record<string, unknown> & PromiseLike<typeof result> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(result),
        // 직접 await 시 (select().eq().order() 체인 끝에서)
        then: (
          onfulfilled?: ((v: typeof result) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null
        ) => Promise.resolve(result).then(onfulfilled, onrejected ?? undefined),
      } as unknown as Record<string, unknown> & PromiseLike<typeof result>;

      // 각 메서드가 chain 자신을 반환하도록 재설정
      (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.limit as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      return chain;
    }),
  };
}

const mockRequireAdminOrConsultant = vi.mocked(requireAdminOrConsultant);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockGetSchoolScoreSummary = vi.mocked(getSchoolScoreSummary);
const mockGetMockScoreSummary = vi.mocked(getMockScoreSummary);
const mockGetRiskIndexBySubject = vi.mocked(getRiskIndexBySubject);
const mockExecuteGuideGeneration = vi.mocked(executeGuideGeneration);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// admin/check-student-scores
// ============================================

describe("GET /api/admin/check-student-scores", () => {
  const BASE_URL = "http://localhost/api/admin/check-student-scores";

  async function callRoute(searchParams?: Record<string, string>) {
    const { GET } = await import("../check-student-scores/route");
    return GET(makeGetRequest(BASE_URL, searchParams));
  }

  it("requireAdminOrConsultant가 throw하면 500 반환", async () => {
    mockRequireAdminOrConsultant.mockRejectedValue(new Error("Unauthorized"));

    const res = await callRoute({ student_id: "s1" });

    expect(res.status).toBe(500);
  });

  it("requireAdminOrConsultant가 null 반환하면 401", async () => {
    // null 반환 케이스 — apiUnauthorized 호출
    mockRequireAdminOrConsultant.mockResolvedValue(null as never);

    const res = await callRoute({ student_id: "s1" });

    expect(res.status).toBe(401);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("관리자 또는 컨설턴트 권한이 필요합니다.");
  });

  it("student_id, email 모두 누락 → 403", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    const res = await callRoute(); // 파라미터 없음

    expect(res.status).toBe(403);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
    expect(json.error.message).toContain("student_id 또는 email 파라미터가 필요합니다");
  });

  it("student_id 제공 — 학생이 tenant에 없으면 403", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    // students maybeSingle → data: null (학생 없음)
    const supabaseMock = makeCheckScoresSupabaseMock({
      studentsResult: { data: null, error: null },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({ student_id: "unknown-student" });

    expect(res.status).toBe(403);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("조회할 권한이 없습니다");
  });

  it("student_id 정상 조회 → 200 + email, studentId, summary, subjectAnalysis 포함", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    const supabaseMock = makeCheckScoresSupabaseMock({
      studentsResult: {
        data: { id: "student-1", email: "student@test.com" },
        error: null,
      },
      schoolScoresResult: { data: [], error: null },
      mockScoresResult: { data: [], error: null },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    mockGetSchoolScoreSummary.mockResolvedValue(new Map());
    mockGetMockScoreSummary.mockResolvedValue(new Map());
    mockGetRiskIndexBySubject.mockResolvedValue(new Map());

    const res = await callRoute({ student_id: "student-1" });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: {
        studentId: string;
        summary: { schoolScoresCount: number; mockScoresCount: number };
        subjectAnalysis: unknown[];
        recommendations: string[];
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.studentId).toBe("student-1");
    expect(json.data.summary).toBeDefined();
    expect(Array.isArray(json.data.subjectAnalysis)).toBe(true);
    expect(Array.isArray(json.data.recommendations)).toBe(true);
  });

  it("email 파라미터 사용 — 학생 조회 실패 시 403", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    // email로 조회 시에도 students maybeSingle → data: null
    const supabaseMock = makeCheckScoresSupabaseMock({
      studentsResult: { data: null, error: null },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({ email: "nobody@test.com" });

    expect(res.status).toBe(403);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("권한이 없거나 학생을 찾을 수 없습니다");
  });
});

// ============================================
// admin/guides/generate
// ============================================

describe("POST /api/admin/guides/generate", () => {
  const BASE_URL = "http://localhost/api/admin/guides/generate";

  const validInput: GuideGenerationInput = {
    source: "keyword",
    keyword: {
      topic: "탄소나노튜브의 전도성",
      subject: "화학",
      difficulty: "심화",
    },
  };

  async function callRoute(body: object) {
    const { POST } = await import("../guides/generate/route");
    return POST(makePostRequest(BASE_URL, body));
  }

  it("requireAdminOrConsultant가 throw하면 500 반환", async () => {
    mockRequireAdminOrConsultant.mockRejectedValue(new Error("Forbidden"));

    const res = await callRoute({ guideId: "g1", input: validInput });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("가이드 생성 요청에 실패했습니다.");
  });

  it("guideId 누락 → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    const res = await callRoute({ input: validInput });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("guideId와 input이 필요합니다.");
  });

  it("input 누락 → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    const res = await callRoute({ guideId: "g1" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("guideId와 input이 필요합니다.");
  });

  it("executeGuideGeneration 성공 → 200 + completed:true", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });
    mockExecuteGuideGeneration.mockResolvedValue(undefined);

    const res = await callRoute({ guideId: "g1", input: validInput });

    expect(res.status).toBe(200);
    const json = await res.json() as { completed: boolean };
    expect(json.completed).toBe(true);
  });

  it("executeGuideGeneration이 modelIndex 에러 throw → 200 + retrying:true, nextModelIndex", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });
    // generate-retry 서버→서버 fetch는 fire-and-forget이므로 전역 fetch mock
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    mockExecuteGuideGeneration.mockRejectedValue(
      new Error("timeout: modelIndex=0 exceeded")
    );

    const res = await callRoute({ guideId: "g1", input: validInput });

    expect(res.status).toBe(200);
    const json = await res.json() as { retrying: boolean; nextModelIndex: number };
    expect(json.retrying).toBe(true);
    expect(json.nextModelIndex).toBe(1);

    vi.unstubAllGlobals();
  });

  it("executeGuideGeneration이 일반 에러 throw → 500 + exploration_guides ai_failed 업데이트", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
    });

    const adminUpdateMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminUpdateMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockExecuteGuideGeneration.mockRejectedValue(new Error("AI 서버 응답 없음"));

    const res = await callRoute({ guideId: "g1", input: validInput });

    expect(res.status).toBe(500);
    expect(adminUpdateMock.from).toHaveBeenCalledWith("exploration_guides");
  });
});

// ============================================
// admin/guides/generate-retry
// ============================================

describe("POST /api/admin/guides/generate-retry", () => {
  const BASE_URL = "http://localhost/api/admin/guides/generate-retry";

  const validInput: GuideGenerationInput = {
    source: "keyword",
    keyword: {
      topic: "그래핀 합성 경로",
      subject: "화학",
      difficulty: "심화",
    },
  };

  async function callRoute(body: object) {
    const { POST } = await import("../guides/generate-retry/route");
    return POST(makePostRequest(BASE_URL, body));
  }

  it("guideId 누락 → 400", async () => {
    const res = await callRoute({ input: validInput, modelStartIndex: 1 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("필수 파라미터 누락");
  });

  it("input 누락 → 400", async () => {
    const res = await callRoute({ guideId: "g1", modelStartIndex: 1 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("필수 파라미터 누락");
  });

  it("modelStartIndex 누락 → 400", async () => {
    const res = await callRoute({ guideId: "g1", input: validInput });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("필수 파라미터 누락");
  });

  it("모든 파라미터 정상 → executeGuideGeneration(guideId, input, { modelStartIndex }) 호출, 200", async () => {
    mockExecuteGuideGeneration.mockResolvedValue(undefined);

    const res = await callRoute({ guideId: "g1", input: validInput, modelStartIndex: 1 });

    expect(res.status).toBe(200);
    const json = await res.json() as { completed: boolean };
    expect(json.completed).toBe(true);
    expect(mockExecuteGuideGeneration).toHaveBeenCalledWith("g1", validInput, {
      modelStartIndex: 1,
    });
  });

  it("executeGuideGeneration throw → 500 + exploration_guides ai_failed 업데이트", async () => {
    const adminUpdateMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminUpdateMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockExecuteGuideGeneration.mockRejectedValue(new Error("모든 모델 응답 없음"));

    const res = await callRoute({ guideId: "g1", input: validInput, modelStartIndex: 2 });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("모든 모델 타임아웃");
    expect(adminUpdateMock.from).toHaveBeenCalledWith("exploration_guides");
  });

  it("외부 예외(JSON parse 실패 등) → 500 + 가이드 재시도 실패 메시지", async () => {
    // 잘못된 JSON body로 request 구성
    const badReq = new NextRequest(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "NOT JSON",
    });
    const { POST } = await import("../guides/generate-retry/route");
    const res = await POST(badReq);

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("가이드 재시도에 실패했습니다.");
  });
});
