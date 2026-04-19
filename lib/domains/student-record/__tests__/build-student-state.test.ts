// ============================================
// α1-3: buildStudentState 유닛 테스트
//
// 시나리오:
//   1. 빈 학생: 모든 Layer null/빈. completenessRatio=0, aux.volunteer=null.
//   2. 봉사 + ctx.results 주입: VolunteerState 합산 + themes/caringEvidence 전달.
//   3. 봉사만 DB (ctx 없음): caringEvidence 는 activity_tags 근거로 폴백.
//   4. metadata: layer1 존재 + volunteer 존재 → hakjongScoreComputable=true.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: () => 2026,
  gradeToSchoolYear: (grade: number, currentGrade: number, currentYear: number) =>
    currentYear - (currentGrade - grade),
}));

const mockFindProfileCard = vi.fn();
const mockRowToProfileCard = vi.fn();
vi.mock("../repository/profile-card-repository", () => ({
  findProfileCard: (...args: unknown[]) => mockFindProfileCard(...args),
  rowToProfileCard: (...args: unknown[]) => mockRowToProfileCard(...args),
}));

const mockFindCompetencyScoresBySchoolYears = vi.fn();
const mockFindActivityTags = vi.fn();
vi.mock("../repository/competency-repository", () => ({
  findCompetencyScoresBySchoolYears: (...args: unknown[]) =>
    mockFindCompetencyScoresBySchoolYears(...args),
  findActivityTags: (...args: unknown[]) => mockFindActivityTags(...args),
}));

const mockFindHyperedges = vi.fn();
vi.mock("../repository/hyperedge-repository", () => ({
  findHyperedges: (...args: unknown[]) => mockFindHyperedges(...args),
}));

const mockFindNarrativeArcsByStudent = vi.fn();
vi.mock("../repository/narrative-arc-repository", () => ({
  findNarrativeArcsByStudent: (...args: unknown[]) =>
    mockFindNarrativeArcsByStudent(...args),
}));

const mockGetActiveMainExploration = vi.fn();
vi.mock("../repository/main-exploration-repository", () => ({
  getActiveMainExploration: (...args: unknown[]) =>
    mockGetActiveMainExploration(...args),
}));

const mockFetchVolunteerUpTo = vi.fn();
vi.mock("../repository/volunteer-repository", () => ({
  fetchVolunteerUpTo: (...args: unknown[]) => mockFetchVolunteerUpTo(...args),
}));

const mockListTrajectory = vi.fn().mockResolvedValue([]);
vi.mock("../repository/student-state-repository", () => ({
  listTrajectory: (...args: unknown[]) => mockListTrajectory(...args),
}));

// ---- supabase client mock ----

function makeChain(
  readResolve: { data: unknown[]; error: unknown } = { data: [], error: null },
) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.lte = vi.fn().mockImplementation(self);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(readResolve).then(resolve);
  return chain;
}

function makeClient(fromReturns: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (fromReturns[table]) return fromReturns[table];
      return makeChain();
    }),
  };
}

// ---- SUT ----

import { buildStudentState } from "../state/build-student-state";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ---- Helpers ----

beforeEach(() => {
  vi.clearAllMocks();
  mockFindProfileCard.mockResolvedValue(null);
  mockFindCompetencyScoresBySchoolYears.mockResolvedValue([]);
  mockFindActivityTags.mockResolvedValue([]);
  mockFindHyperedges.mockResolvedValue([]);
  mockFindNarrativeArcsByStudent.mockResolvedValue([]);
  mockGetActiveMainExploration.mockResolvedValue(null);
  mockFetchVolunteerUpTo.mockResolvedValue([]);
  mockListTrajectory.mockResolvedValue([]);
});

// ============================================
// 1. 빈 학생
// ============================================

describe("buildStudentState — 빈 학생", () => {
  it("모든 Layer null/빈 + completenessRatio=0", async () => {
    const client = makeClient() as unknown as SupabaseClient<Database>;

    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "test", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.profileCard).toBeNull();
    expect(state.competencies).toBeNull();
    expect(state.hyperedges).toEqual([]);
    expect(state.narrativeArc).toEqual([]);
    expect(state.aux.volunteer).toBeNull();
    expect(state.aux.awards?.items).toEqual([]);
    expect(state.aux.attendance).toBeNull();
    expect(state.aux.reading).toBeNull();
    expect(state.blueprint).toBeNull();
    expect(state.hakjongScore).toBeNull();
    expect(state.metadata.completenessRatio).toBe(0);
    expect(state.metadata.hakjongScoreComputable).toBe(false);
  });
});

// ============================================
// 2. 봉사 + ctx.results 주입
// ============================================

describe("buildStudentState — 봉사 + pipelineResults", () => {
  it("totalHours 합산 + themes/caring 전달 + lastActivityAt 최신", async () => {
    mockFetchVolunteerUpTo.mockResolvedValue([
      { id: "v-1", hours: 5, activity_date: "2025-04-01", school_year: 2025 },
      { id: "v-2", hours: 3, activity_date: "2025-06-15", school_year: 2025 },
      { id: "v-3", hours: 4, activity_date: null, school_year: 2024 },
    ]);
    mockFindActivityTags.mockResolvedValue([
      {
        competency_item: "community_caring",
        evidence_summary: "[AI] 지속적 돌봄 확인",
        record_type: "volunteer",
      },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      {
        client,
        pipelineResults: {
          competency_volunteer: {
            recurringThemes: ["복지 지원", "환경 보전"],
            caringEvidence: ["노인복지관 정기 방문"],
          },
        },
      },
    );

    expect(state.aux.volunteer).not.toBeNull();
    expect(state.aux.volunteer!.totalHours).toBe(12);
    expect(state.aux.volunteer!.lastActivityAt).toBe("2025-06-15");
    expect(state.aux.volunteer!.recurringThemes).toEqual(["복지 지원", "환경 보전"]);
    expect(state.aux.volunteer!.caringEvidence).toEqual(["노인복지관 정기 방문"]);
    expect(state.metadata.auxVolunteerPresent).toBe(true);
  });
});

// ============================================
// 3. 봉사만 DB (ctx 없음) → caringEvidence 태그 폴백
// ============================================

describe("buildStudentState — ctx 없을 때 activity_tags 폴백", () => {
  it("caringEvidence 는 태그의 evidence_summary 에서 '[AI]' 프리픽스 제거 후 주입", async () => {
    mockFetchVolunteerUpTo.mockResolvedValue([
      { id: "v-1", hours: 2, activity_date: "2025-03-01", school_year: 2025 },
    ]);
    mockFindActivityTags.mockResolvedValue([
      {
        competency_item: "community_caring",
        evidence_summary: "[AI] 노인복지관 정기 방문",
        record_type: "volunteer",
      },
      {
        competency_item: "community_leadership",
        evidence_summary: "[AI] 무관한 리더십 증거",
        record_type: "volunteer",
      },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client }, // pipelineResults 없음
    );

    expect(state.aux.volunteer!.recurringThemes).toEqual([]);
    expect(state.aux.volunteer!.caringEvidence).toEqual(["노인복지관 정기 방문"]);
  });
});

// ============================================
// 4. hakjongScoreComputable — Layer1 + volunteer
// ============================================

describe("buildStudentState — metadata.hakjongScoreComputable", () => {
  it("competency_scores(ai) 존재 + volunteer 존재 → true", async () => {
    mockFindCompetencyScoresBySchoolYears.mockImplementation(
      async (_sid: string, _years: number[], _tid: string, source: string) => {
        if (source !== "ai") return [];
        return [
          {
            competency_item: "academic_achievement",
            competency_area: "academic",
            grade_value: "B+",
            scope: "yearly",
            school_year: 2025,
            narrative: null,
            source_record_ids: null,
          },
        ];
      },
    );
    mockFetchVolunteerUpTo.mockResolvedValue([
      { id: "v-1", hours: 5, activity_date: "2025-04-01", school_year: 2025 },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.competencies).not.toBeNull();
    const axis = state.competencies!.axes.find(
      (a) => a.code === "academic_achievement",
    );
    expect(axis?.grade).toBe("B+");
    expect(state.metadata.layer1Present).toBe(true);
    expect(state.metadata.auxVolunteerPresent).toBe(true);
    expect(state.metadata.hakjongScoreComputable).toBe(true);
  });
});
