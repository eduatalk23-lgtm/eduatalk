/**
 * Students API 라우트 단위 테스트
 *
 * 커버리지:
 *   - students/[id]/score-dashboard (GET)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUserRole", () => ({
  getCachedUserRole: vi.fn(),
}));

vi.mock("@/lib/scores/internalAnalysis", () => ({
  getInternalAnalysis: vi.fn(),
}));

vi.mock("@/lib/scores/mockAnalysis", () => ({
  getMockAnalysis: vi.fn(),
}));

vi.mock("@/lib/scores/admissionStrategy", () => ({
  getInternalPercentile: vi.fn(),
  analyzeAdmissionStrategy: vi.fn(),
}));

vi.mock("@/lib/domains/student/resolveStudentCurriculum", () => ({
  resolveStudentCurriculumId: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import { getInternalPercentile, analyzeAdmissionStrategy } from "@/lib/scores/admissionStrategy";
import { resolveStudentCurriculumId } from "@/lib/domains/student/resolveStudentCurriculum";

// ============================================
// 공통 헬퍼
// ============================================

function makeGetRequest(
  studentId: string,
  searchParams?: Record<string, string>
): NextRequest {
  const urlObj = new URL(`http://localhost/api/students/${studentId}/score-dashboard`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => urlObj.searchParams.set(k, v));
  }
  return new NextRequest(urlObj.toString(), { method: "GET" });
}

type SupabaseMockOptions = {
  studentData?: unknown;
  studentError?: unknown;
  termData?: unknown;
  termError?: unknown;
  revisionData?: unknown;
  schoolInfoData?: unknown;
};

/** Supabase 체이닝 mock — from() 반환값이 학생/학기/revision/school 순서에 맞게 응답 */
function makeSupabaseMock(opts: SupabaseMockOptions = {}) {
  let callIndex = 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      callIndex++;
      const current = callIndex;

      const resolveData = (): { data: unknown; error: unknown } => {
        if (table === "students") {
          return { data: opts.studentData ?? null, error: opts.studentError ?? null };
        }
        if (table === "student_terms") {
          return { data: opts.termData ?? null, error: opts.termError ?? null };
        }
        if (table === "curriculum_revisions") {
          return { data: opts.revisionData ?? { id: "rev-1" }, error: null };
        }
        if (table === "school_info") {
          return { data: opts.schoolInfoData ?? null, error: null };
        }
        return { data: null, error: null };
      };

      const result = resolveData();

      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(result),
        then: (resolve: (v: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };

      // self-referential for chaining
      (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.order as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      (chain.limit as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      // 명시적 unused variable 제거
      void current;
      return chain;
    }),
  };
}

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetCachedUserRole = vi.mocked(getCachedUserRole);
const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetInternalAnalysis = vi.mocked(getInternalAnalysis);
const mockGetMockAnalysis = vi.mocked(getMockAnalysis);
const mockGetInternalPercentile = vi.mocked(getInternalPercentile);
const mockAnalyzeAdmissionStrategy = vi.mocked(analyzeAdmissionStrategy);
const mockResolveStudentCurriculumId = vi.mocked(resolveStudentCurriculumId);

beforeEach(() => {
  vi.clearAllMocks();
  // 기본값: 학생 교육과정 resolve 성공 (대부분 테스트의 happy path)
  mockResolveStudentCurriculumId.mockResolvedValue({
    curriculumRevisionId: "rev-1",
    curriculumYear: 2022,
    curriculumName: "2022 개정",
  });
});

// ============================================
// 기본 결과 빌더
// ============================================

function makeDefaultAnalysis() {
  return {
    totalGpa: 2.5,
    adjustedGpa: 2.3,
    zIndex: 0.8,
    subjectStrength: { 국어: 2, 수학: 3 },
  };
}

function makeDefaultMockAnalysis() {
  return {
    recentExam: { examDate: "2025-06-01", examTitle: "6월 모평" },
    avgPercentile: 75,
    totalStdScore: 280,
    best3GradeSum: 6,
  };
}

function makeDefaultStrategy() {
  return {
    type: "수시_유리",
    message: "수시 전략이 유리합니다.",
    data: { internalPct: 30, mockPct: 25, diff: 5 },
  };
}

// ============================================
// score-dashboard
// ============================================

describe("GET /api/students/[id]/score-dashboard", () => {
  async function callRoute(
    studentId: string,
    searchParams?: Record<string, string>
  ) {
    const { GET } = await import("../[id]/score-dashboard/route");
    return GET(
      makeGetRequest(studentId, searchParams),
      { params: Promise.resolve({ id: studentId }) }
    );
  }

  it("학생 역할이 타 학생 ID 요청 시 403 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "student-a",
      role: "student",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "student-a",
      role: "student",
      tenantId: "t1",
    });

    const res = await callRoute("student-b", { tenantId: "t1" });

    expect(res.status).toBe(403);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Forbidden");
  });

  it("학생을 찾을 수 없으면 404 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({ studentData: null, studentError: null });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    const res = await callRoute("no-student", { tenantId: "t1" });

    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Student not found");
  });

  it("학생 조회 에러 → 500 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({
      studentData: null,
      studentError: { message: "DB connection error", code: "500" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    const res = await callRoute("student-1", { tenantId: "t1" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Failed to fetch student");
  });

  it("effectiveTenantId 없으면 400 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    // tenant_id도 null인 학생
    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 2,
        class: "3",
        school_id: null,
        school_type: null,
        tenant_id: null,
        user_profiles: { name: "홍길동" },
      },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    // tenantId 파라미터도 없음 (null 문자열 = 처리됨)
    const res = await callRoute("student-1");

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Tenant ID not found for student");
  });

  it("정상 조회 → 200 + studentProfile, internalAnalysis, mockAnalysis, strategyResult", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 2,
        class: "3",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: { name: "김철수" },
      },
      termData: {
        id: "term-1",
        grade: 2,
        semester: 1,
        school_year: 2025,
      },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockGetInternalAnalysis.mockResolvedValue(makeDefaultAnalysis());
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());
    mockGetInternalPercentile.mockResolvedValue(30);
    mockAnalyzeAdmissionStrategy.mockReturnValue(makeDefaultStrategy());

    const res = await callRoute("student-1", { tenantId: "t1" });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      studentProfile: { id: string; name: string };
      internalAnalysis: { totalGpa: number | null };
      mockAnalysis: { avgPercentile: number | null };
      strategyResult: { type: string };
    };
    expect(json.studentProfile.id).toBe("student-1");
    expect(json.studentProfile.name).toBe("김철수");
    expect(json.internalAnalysis.totalGpa).toBe(2.5);
    expect(json.mockAnalysis.avgPercentile).toBe(75);
    expect(json.strategyResult.type).toBe("수시_유리");
  });

  it("학생 역할이 자기 ID 조회 → 200 (정상 접근)", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "student-self",
      role: "student",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "student-self",
      role: "student",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-self",
        grade: 1,
        class: "2",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: { name: "이민수" },
      },
      termData: { id: "term-self", grade: 1, semester: 2, school_year: 2025 },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockGetInternalAnalysis.mockResolvedValue(makeDefaultAnalysis());
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());
    mockGetInternalPercentile.mockResolvedValue(null);
    mockAnalyzeAdmissionStrategy.mockReturnValue(makeDefaultStrategy());

    const res = await callRoute("student-self", { tenantId: "t1" });

    expect(res.status).toBe(200);
    const json = await res.json() as { studentProfile: { id: string } };
    expect(json.studentProfile.id).toBe("student-self");
  });

  it("adminClient 생성 실패(null) → serverClient fallback 후 정상 처리", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    // adminClient null 반환 → serverClient로 fallback
    mockCreateSupabaseAdminClient.mockReturnValue(
      null as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    const serverMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 2,
        class: "1",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: { name: "박지수" },
      },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(
      serverMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    mockGetInternalAnalysis.mockResolvedValue(makeDefaultAnalysis());
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());
    mockGetInternalPercentile.mockResolvedValue(null);
    mockAnalyzeAdmissionStrategy.mockReturnValue(makeDefaultStrategy());

    const res = await callRoute("student-1", { tenantId: "t1" });

    // serverClient fallback이 작동하여 정상 처리
    expect(res.status).toBe(200);
    expect(mockCreateSupabaseServerClient).toHaveBeenCalled();
  });

  it("grade, semester 파라미터로 term 조회", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 2,
        class: "1",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: { name: "최연수" },
      },
      termData: { id: "term-grade2", grade: 2, semester: 2, school_year: 2025 },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockGetInternalAnalysis.mockResolvedValue(makeDefaultAnalysis());
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());
    mockGetInternalPercentile.mockResolvedValue(40);
    mockAnalyzeAdmissionStrategy.mockReturnValue(makeDefaultStrategy());

    const res = await callRoute("student-1", {
      tenantId: "t1",
      grade: "2",
      semester: "2",
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      studentProfile: { termGrade: number | null; semester: number | null };
    };
    expect(json.studentProfile.termGrade).toBe(2);
    expect(json.studentProfile.semester).toBe(2);
  });

  it("인증 정보가 없어도(currentUser=null) admin fallback → 정상 처리", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetCachedUserRole.mockResolvedValue({
      userId: null,
      role: null,
      tenantId: null,
    });

    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 1,
        class: "5",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: null,
      },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockGetInternalAnalysis.mockResolvedValue(makeDefaultAnalysis());
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());
    mockGetInternalPercentile.mockResolvedValue(null);
    mockAnalyzeAdmissionStrategy.mockReturnValue(makeDefaultStrategy());

    const res = await callRoute("student-1", { tenantId: "t1" });

    expect(res.status).toBe(200);
    const json = await res.json() as { studentProfile: { name: string } };
    expect(json.studentProfile.name).toBe("");
  });

  it("분석 함수가 throw하면 500 반환", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "u1",
      role: "admin",
      tenantId: "t1",
    });

    const adminMock = makeSupabaseMock({
      studentData: {
        id: "student-1",
        grade: 2,
        class: "1",
        school_id: null,
        school_type: null,
        tenant_id: "t1",
        user_profiles: { name: "정유진" },
      },
      revisionData: { id: "rev-1" },
    });
    mockCreateSupabaseAdminClient.mockReturnValue(
      adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    mockGetInternalAnalysis.mockRejectedValue(new Error("내신 분석 실패"));
    mockGetMockAnalysis.mockResolvedValue(makeDefaultMockAnalysis());

    const res = await callRoute("student-1", { tenantId: "t1" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string; message: string };
    expect(json.error).toBe("Internal server error");
    expect(json.message).toContain("내신 분석 실패");
  });
});
