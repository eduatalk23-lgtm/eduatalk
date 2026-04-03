/**
 * Scores API 라우트 단위 테스트
 *
 * 커버리지:
 *   - scores/internal (POST) — @deprecated, 하위 호환 유지용
 *   - scores/mock     (POST) — @deprecated, 하위 호환 유지용
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/data/studentTerms", () => ({
  getOrCreateStudentTerm: vi.fn(),
  getStudentTerm: vi.fn(),
  calculateSchoolYear: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getOrCreateStudentTerm,
  getStudentTerm,
  calculateSchoolYear,
} from "@/lib/data/studentTerms";
import type { InternalScoreInputForm, MockScoreInputForm } from "@/lib/types/scoreInput";

// ============================================
// 공통 헬퍼
// ============================================

function makePostRequest(url: string, body: object): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Supabase insert 체이닝 mock */
function makeInsertMock(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetOrCreateStudentTerm = vi.mocked(getOrCreateStudentTerm);
const mockGetStudentTerm = vi.mocked(getStudentTerm);
const mockCalculateSchoolYear = vi.mocked(calculateSchoolYear);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// 샘플 데이터 빌더
// ============================================

function makeInternalScore(overrides: Partial<InternalScoreInputForm> = {}): InternalScoreInputForm {
  return {
    subject_group_id: "sg-1",
    subject_id: "subj-1",
    subject_type_id: "st-1",
    grade: 2,
    semester: 1,
    credit_hours: 4,
    rank_grade: 3,
    raw_score: 85,
    avg_score: 72.5,
    std_dev: 10.2,
    total_students: 300,
    ...overrides,
  };
}

function makeMockScore(overrides: Partial<MockScoreInputForm> = {}): MockScoreInputForm {
  return {
    exam_date: "2025-06-01",
    exam_title: "6월 모평",
    grade: 2,
    subject_id: "subj-math",
    subject_group_id: "sg-math",
    grade_score: 2,
    standard_score: 130,
    percentile: 92,
    raw_score: 96,
    ...overrides,
  };
}

// ============================================
// scores/internal
// ============================================

describe("POST /api/scores/internal", () => {
  const BASE_URL = "http://localhost/api/scores/internal";

  async function callRoute(body: object) {
    const { POST } = await import("../internal/route");
    return POST(makePostRequest(BASE_URL, body) as Parameters<typeof POST>[0]);
  }

  it("미인증 요청 → 401 반환", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(401);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("로그인이 필요합니다.");
  });

  it("studentId 누락 → 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const res = await callRoute({
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("필수 파라미터가 누락되었습니다.");
  });

  it("tenantId 누락 → 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const res = await callRoute({
      studentId: "s1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(400);
  });

  it("curriculumRevisionId 누락 → 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(400);
  });

  it("schoolYear 누락 → 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(400);
  });

  it("scores 빈 배열 → 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [],
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toBe("성적 데이터가 없습니다.");
  });

  it("정상 저장 → 201 + internal_scores 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetOrCreateStudentTerm.mockResolvedValue("term-1");

    const insertedData = [{ id: "score-1", student_id: "s1" }];
    const supabaseMock = makeInsertMock({ data: insertedData, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(201);
    const json = await res.json() as {
      success: boolean;
      data: { internal_scores: unknown[] };
    };
    expect(json.success).toBe(true);
    expect(json.data.internal_scores).toHaveLength(1);
  });

  it("복수 성적 저장 → getOrCreateStudentTerm 성적 수만큼 호출", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetOrCreateStudentTerm.mockResolvedValue("term-1");

    const scores = [
      makeInternalScore({ grade: 1, semester: 1 }),
      makeInternalScore({ grade: 1, semester: 2 }),
      makeInternalScore({ grade: 2, semester: 1 }),
    ];
    const supabaseMock = makeInsertMock({
      data: scores.map((_, i) => ({ id: `score-${i}` })),
      error: null,
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores,
    });

    expect(mockGetOrCreateStudentTerm).toHaveBeenCalledTimes(3);
  });

  it("DB insert 에러 → 500 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetOrCreateStudentTerm.mockResolvedValue("term-1");

    const supabaseMock = makeInsertMock({
      data: null,
      error: { message: "unique constraint", code: "23505" },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    // handleApiError가 23505 에러 → 409 DUPLICATE_ENTRY
    expect(res.status).toBe(409);
  });

  it("예외 발생(throw) → 500 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetOrCreateStudentTerm.mockRejectedValue(new Error("term 생성 실패"));

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      curriculumRevisionId: "r1",
      schoolYear: 2025,
      scores: [makeInternalScore()],
    });

    expect(res.status).toBe(500);
  });
});

// ============================================
// scores/mock
// ============================================

describe("POST /api/scores/mock", () => {
  const BASE_URL = "http://localhost/api/scores/mock";

  async function callRoute(body: object) {
    const { POST } = await import("../mock/route");
    return POST(makePostRequest(BASE_URL, body) as Parameters<typeof POST>[0]);
  }

  it("studentId 누락 → 400 반환", async () => {
    const res = await callRoute({
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("필수 파라미터가 누락되었습니다.");
  });

  it("tenantId 누락 → 400 반환", async () => {
    const res = await callRoute({
      studentId: "s1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toBe("필수 파라미터가 누락되었습니다.");
  });

  it("scores 빈 배열 → 400 반환", async () => {
    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [],
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toBe("성적 데이터가 없습니다.");
  });

  it("정상 저장 → 201 + mock_scores 반환", async () => {
    const schoolYear = 2025;
    mockCalculateSchoolYear.mockReturnValue(schoolYear);
    mockGetStudentTerm.mockResolvedValue({
      id: "term-1",
      tenant_id: "t1",
      student_id: "s1",
      school_year: schoolYear,
      grade: 2,
      semester: 1,
    } as Awaited<ReturnType<typeof getStudentTerm>>);

    const insertedData = [{ id: "mock-score-1", student_id: "s1" }];
    const supabaseMock = makeInsertMock({ data: insertedData, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(201);
    const json = await res.json() as {
      success: boolean;
      data: { mock_scores: unknown[] };
    };
    expect(json.success).toBe(true);
    expect(json.data.mock_scores).toHaveLength(1);
  });

  it("term이 없으면 student_term_id=null로 저장", async () => {
    mockCalculateSchoolYear.mockReturnValue(2025);
    mockGetStudentTerm.mockResolvedValue(null);

    const insertedData = [{ id: "mock-score-no-term", student_id: "s1", student_term_id: null }];
    const supabaseMock = makeInsertMock({ data: insertedData, error: null });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(201);
    // getStudentTerm이 null 반환해도 저장 성공
    const json = await res.json() as { data: { mock_scores: unknown[] } };
    expect(json.data.mock_scores).toHaveLength(1);
  });

  it("복수 성적 → calculateSchoolYear 성적 수만큼 호출", async () => {
    mockCalculateSchoolYear.mockReturnValue(2025);
    mockGetStudentTerm.mockResolvedValue(null);

    const scores = [
      makeMockScore({ exam_date: "2025-03-20", exam_title: "3월 학력평가", grade: 2 }),
      makeMockScore({ exam_date: "2025-06-05", exam_title: "6월 모평", grade: 2 }),
    ];
    const supabaseMock = makeInsertMock({
      data: scores.map((_, i) => ({ id: `ms-${i}` })),
      error: null,
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    await callRoute({ studentId: "s1", tenantId: "t1", scores });

    expect(mockCalculateSchoolYear).toHaveBeenCalledTimes(2);
    expect(mockGetStudentTerm).toHaveBeenCalledTimes(2);
  });

  it("DB insert 에러 → 500 반환", async () => {
    mockCalculateSchoolYear.mockReturnValue(2025);
    mockGetStudentTerm.mockResolvedValue(null);

    const supabaseMock = makeInsertMock({
      data: null,
      error: { message: "DB error", code: "42501" },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    // handleApiError가 42501 → 403 Forbidden
    expect(res.status).toBe(403);
  });

  it("예외 발생(throw) → 500 반환", async () => {
    mockCalculateSchoolYear.mockImplementation(() => {
      throw new Error("날짜 파싱 실패");
    });

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(500);
  });

  it("인증 없이도 처리 (auth 불필요한 라우트)", async () => {
    // scores/mock route는 getCurrentUser 호출 없음
    mockCalculateSchoolYear.mockReturnValue(2025);
    mockGetStudentTerm.mockResolvedValue(null);

    const supabaseMock = makeInsertMock({
      data: [{ id: "ms-1" }],
      error: null,
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const res = await callRoute({
      studentId: "s1",
      tenantId: "t1",
      scores: [makeMockScore()],
    });

    expect(res.status).toBe(201);
    // getCurrentUser가 전혀 호출되지 않았음을 확인
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });
});
