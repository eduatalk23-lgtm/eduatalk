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

const mockFetchAwardsUpTo = vi.fn();
vi.mock("../repository/awards-repository", () => ({
  fetchAwardsUpTo: (...args: unknown[]) => mockFetchAwardsUpTo(...args),
}));

const mockFetchAttendanceUpTo = vi.fn();
const mockFetchDisciplinaryUpTo = vi.fn();
vi.mock("../repository/attendance-repository", () => ({
  fetchAttendanceUpTo: (...args: unknown[]) => mockFetchAttendanceUpTo(...args),
  fetchDisciplinaryUpTo: (...args: unknown[]) => mockFetchDisciplinaryUpTo(...args),
}));

const mockListTrajectory = vi.fn().mockResolvedValue([]);
vi.mock("../repository/student-state-repository", () => ({
  listTrajectory: (...args: unknown[]) => mockListTrajectory(...args),
}));

const mockLoadBlueprintForStudent = vi.fn();
vi.mock("@/lib/domains/record-analysis/blueprint/loader", () => ({
  loadBlueprintForStudent: (...args: unknown[]) => mockLoadBlueprintForStudent(...args),
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
  // recordType 옵션 기반 분기 — 각 테스트는 필요 시 mockImplementation 으로 override
  mockFindActivityTags.mockResolvedValue([]);
  mockFindHyperedges.mockResolvedValue([]);
  mockFindNarrativeArcsByStudent.mockResolvedValue([]);
  mockGetActiveMainExploration.mockResolvedValue(null);
  mockFetchVolunteerUpTo.mockResolvedValue([]);
  mockFetchAwardsUpTo.mockResolvedValue([]);
  mockFetchAttendanceUpTo.mockResolvedValue([]);
  mockFetchDisciplinaryUpTo.mockResolvedValue([]);
  mockListTrajectory.mockResolvedValue([]);
  mockLoadBlueprintForStudent.mockResolvedValue(null);
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
    expect(state.aux.awards).toBeNull();
    expect(state.aux.attendance).toBeNull();
    expect(state.aux.reading).toBeNull();
    expect(state.blueprint).toBeNull();
    // α3-2: blueprint 없으면 blueprintGap 도 null.
    expect(state.blueprintGap).toBeNull();
    // α3-3-2: blueprint 없으면 multiScenarioGap 도 null.
    expect(state.multiScenarioGap).toBeNull();
    // α2: hakjongScore 는 항상 객체. 데이터 없으면 모든 필드 null.
    expect(state.hakjongScore).not.toBeNull();
    expect(state.hakjongScore!.total).toBeNull();
    expect(state.hakjongScore!.academic).toBeNull();
    expect(state.hakjongScore!.career).toBeNull();
    expect(state.hakjongScore!.community).toBeNull();
    // α2 Step C: v2-pre 병행 계산. 빈 state 에서도 객체 존재 + total null.
    expect(state.hakjongScoreV2Pre).not.toBeNull();
    expect(state.hakjongScoreV2Pre!.total).toBeNull();
    expect(state.hakjongScoreV2Pre!.version).toBe("v2_rule_calibrated");
    expect(state.metadata.completenessRatio).toBe(0);
    expect(state.metadata.hakjongScoreComputable).toEqual({
      academic: false,
      career: false,
      community: false,
      total: false,
    });
    expect(state.metadata.areaCompleteness).toEqual({
      academic: 0,
      career: 0,
      community: 0,
    });
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
// 4. α1-4: 수상(Awards) — items + evidence
// ============================================

describe("buildStudentState — α1-4 AwardState", () => {
  it("awards 테이블 + activity_tags(record_type='award') → items.relatedCompetencies + leadership/career evidence 빌드", async () => {
    mockFetchAwardsUpTo.mockResolvedValue([
      {
        id: "a-1",
        award_name: "교내 과학탐구대회 최우수상",
        award_level: "교내",
        award_date: "2025-05-12",
        school_year: 2025,
      },
      {
        id: "a-2",
        award_name: "전국 창의력올림피아드 은상",
        award_level: "전국",
        award_date: "2025-10-01",
        school_year: 2025,
      },
    ]);
    // 두 번째 호출(award 쿼리)에서만 태그 반환 — recordType 옵션으로 분기
    mockFindActivityTags.mockImplementation(
      async (_sid: string, _tid: string, opts?: { recordType?: string }) => {
        if (opts?.recordType !== "award") return [];
        return [
          {
            record_id: "a-1",
            record_type: "award",
            competency_item: "community_leadership",
            evidence_summary: "[AI] 팀을 이끌어 실험 주도",
            tag_context: "analysis",
          },
          {
            record_id: "a-1",
            record_type: "award",
            competency_item: "academic_inquiry",
            evidence_summary: "[AI] 가설 설정 후 검증",
            tag_context: "analysis",
          },
          {
            record_id: "a-2",
            record_type: "award",
            competency_item: "career_exploration",
            evidence_summary: "[AI] 희망 전공 관련 심화 주제",
            tag_context: "analysis",
          },
        ];
      },
    );

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.aux.awards).not.toBeNull();
    expect(state.aux.awards!.items).toHaveLength(2);
    expect(state.aux.awards!.items[0]).toMatchObject({
      recordId: "a-1",
      name: "교내 과학탐구대회 최우수상",
      level: "교내",
    });
    expect(new Set(state.aux.awards!.items[0].relatedCompetencies)).toEqual(
      new Set(["community_leadership", "academic_inquiry"]),
    );
    expect(state.aux.awards!.items[1].relatedCompetencies).toEqual([
      "career_exploration",
    ]);
    // evidence 는 '[AI] ' 프리픽스 제거 후 주입
    expect(state.aux.awards!.leadershipEvidence).toEqual(["팀을 이끌어 실험 주도"]);
    expect(state.aux.awards!.careerRelevance).toEqual(["희망 전공 관련 심화 주제"]);
    expect(state.metadata.auxAwardsPresent).toBe(true);
  });

  it("awards 는 없고 태그만 있으면 items=[] + evidence 만 채워 AwardState 반환 (null 아님)", async () => {
    mockFetchAwardsUpTo.mockResolvedValue([]);
    mockFindActivityTags.mockImplementation(
      async (_sid: string, _tid: string, opts?: { recordType?: string }) => {
        if (opts?.recordType !== "award") return [];
        return [
          {
            record_id: "a-orphan",
            record_type: "award",
            competency_item: "community_leadership",
            evidence_summary: "[AI] 팀장 경험",
            tag_context: "analysis",
          },
        ];
      },
    );

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.aux.awards).not.toBeNull();
    expect(state.aux.awards!.items).toEqual([]);
    expect(state.aux.awards!.leadershipEvidence).toEqual(["팀장 경험"]);
    // items 비어있으면 auxAwardsPresent=false (metadata 기준)
    expect(state.metadata.auxAwardsPresent).toBe(false);
  });
});

// ============================================
// 4.5. α1-5: 출결(Attendance) — 무결점 / 무단결석 / 징계
// ============================================

describe("buildStudentState — α1-5 AttendanceState", () => {
  it("무결점 출결: integrityScore=100 + flags 빈 배열", async () => {
    mockFetchAttendanceUpTo.mockResolvedValue([
      {
        id: "att-1",
        grade: 1,
        school_year: 2024,
        school_days: 190,
        absence_sick: 2,
        absence_unauthorized: 0,
        absence_other: 0,
        lateness_sick: 0,
        lateness_unauthorized: 0,
        lateness_other: 0,
        early_leave_sick: 0,
        early_leave_unauthorized: 0,
        early_leave_other: 0,
        class_absence_sick: 0,
        class_absence_unauthorized: 0,
        class_absence_other: 0,
      },
    ]);
    mockFetchDisciplinaryUpTo.mockResolvedValue([]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.aux.attendance).not.toBeNull();
    expect(state.aux.attendance!.absenceDays).toBe(2);
    expect(state.aux.attendance!.unauthorizedEvents).toBe(0);
    expect(state.aux.attendance!.integrityScore).toBe(100);
    expect(state.aux.attendance!.flags).toEqual([]);
    expect(state.metadata.auxAttendancePresent).toBe(true);
  });

  it("무단결석 3일 + 무단지각 2건 → integrityScore=100-6-2=92 + flags 2건", async () => {
    mockFetchAttendanceUpTo.mockResolvedValue([
      {
        id: "att-1",
        grade: 2,
        school_year: 2025,
        school_days: 190,
        absence_sick: 1,
        absence_unauthorized: 3,
        absence_other: 0,
        lateness_sick: 0,
        lateness_unauthorized: 2,
        lateness_other: 0,
        early_leave_sick: 0,
        early_leave_unauthorized: 0,
        early_leave_other: 0,
        class_absence_sick: 0,
        class_absence_unauthorized: 0,
        class_absence_other: 0,
      },
    ]);
    mockFetchDisciplinaryUpTo.mockResolvedValue([]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.aux.attendance!.absenceDays).toBe(4);
    expect(state.aux.attendance!.lateDays).toBe(2);
    expect(state.aux.attendance!.unauthorizedEvents).toBe(5); // 3 + 2
    expect(state.aux.attendance!.integrityScore).toBe(92); // 100 - 3*2 - 2*1
    expect(state.aux.attendance!.flags).toEqual([
      "무단결석 3일",
      "무단 지각·조퇴 2건",
    ]);
  });

  it("징계 2건 + 과다결석 → integrityScore=80 + flags 2건", async () => {
    mockFetchAttendanceUpTo.mockResolvedValue([
      {
        id: "att-1",
        grade: 1,
        school_year: 2024,
        school_days: 190,
        absence_sick: 12, // 12/190 = 6.3% > 5% → 과다결석
        absence_unauthorized: 0,
        absence_other: 0,
        lateness_sick: 0,
        lateness_unauthorized: 0,
        lateness_other: 0,
        early_leave_sick: 0,
        early_leave_unauthorized: 0,
        early_leave_other: 0,
        class_absence_sick: 0,
        class_absence_unauthorized: 0,
        class_absence_other: 0,
      },
    ]);
    mockFetchDisciplinaryUpTo.mockResolvedValue([
      { id: "d-1", action_type: "교내봉사", decision_date: "2024-09-01" },
      { id: "d-2", action_type: "사회봉사", decision_date: "2025-03-10" },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.aux.attendance!.absenceDays).toBe(12);
    expect(state.aux.attendance!.unauthorizedEvents).toBe(0);
    // 무단 사유 0 → 감점 없음. 징계 2건 → -20.
    expect(state.aux.attendance!.integrityScore).toBe(80);
    expect(state.aux.attendance!.flags).toContain("징계 2건");
    expect(state.aux.attendance!.flags).toContain("과다결석 12/190일");
  });
});

// ============================================
// 5. hakjongScoreComputable — Layer1 + volunteer
// ============================================

describe("buildStudentState — metadata.hakjongScoreComputable (area별 분해)", () => {
  it("academic 3축 중 2축만 grade 있으면 academic=true, 나머지 영역은 false", async () => {
    mockFindCompetencyScoresBySchoolYears.mockImplementation(
      async (_sid: string, _years: number[], _tid: string, source: string) => {
        if (source !== "ai") return [];
        return [
          { competency_item: "academic_achievement", competency_area: "academic", grade_value: "B+", scope: "yearly", school_year: 2025, narrative: null, source_record_ids: null },
          { competency_item: "academic_attitude",    competency_area: "academic", grade_value: "A-", scope: "yearly", school_year: 2025, narrative: null, source_record_ids: null },
        ];
      },
    );
    mockFetchVolunteerUpTo.mockResolvedValue([
      { id: "v-1", hours: 5, activity_date: "2025-04-01", school_year: 2025 },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1", "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.metadata.hakjongScoreComputable).toEqual({
      academic: true,
      career: false,
      community: false,
      total: false,
    });
    expect(state.metadata.areaCompleteness.academic).toBeGreaterThan(0);
    expect(state.metadata.areaCompleteness.career).toBe(0);
    // community 는 Layer1 4축 0 + aux volunteer 1건 → 0.7*0 + 0.3*(1/3) = 0.1
    expect(state.metadata.areaCompleteness.community).toBeCloseTo(0.1, 2);
  });

  it("3 영역 각 2축 이상 + aux 전부 존재 → total=true", async () => {
    mockFindCompetencyScoresBySchoolYears.mockImplementation(
      async (_sid: string, _years: number[], _tid: string, source: string) => {
        if (source !== "ai") return [];
        const row = (item: string, area: string) => ({
          competency_item: item, competency_area: area, grade_value: "B", scope: "yearly",
          school_year: 2025, narrative: null, source_record_ids: null,
        });
        return [
          row("academic_achievement", "academic"),
          row("academic_attitude", "academic"),
          row("career_course_effort", "career"),
          row("career_exploration", "career"),
          row("community_caring", "community"),
          row("community_leadership", "community"),
        ];
      },
    );
    mockFetchVolunteerUpTo.mockResolvedValue([
      { id: "v-1", hours: 5, activity_date: "2025-04-01", school_year: 2025 },
    ]);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1", "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.metadata.hakjongScoreComputable.academic).toBe(true);
    expect(state.metadata.hakjongScoreComputable.career).toBe(true);
    expect(state.metadata.hakjongScoreComputable.community).toBe(true);
    expect(state.metadata.hakjongScoreComputable.total).toBe(true);
  });
});

// ============================================
// α3-2. Blueprint + competencyGrowthTargets → blueprintGap 주입
// ============================================

describe("buildStudentState — α3-2 blueprintGap 주입", () => {
  it("blueprint active + targets 2건 → state.blueprintGap 생성 + anchor.targets 영속", async () => {
    mockGetActiveMainExploration.mockResolvedValue({
      id: "me-1",
      version: 1,
      origin: "auto_bootstrap_v1",
      tier_plan: { foundational: {}, development: {}, advanced: {} },
      career_field: "의학·약학",
      updated_at: "2026-04-01T00:00:00Z",
    });
    mockLoadBlueprintForStudent.mockResolvedValue({
      targetConvergences: [],
      storylineSkeleton: { overarchingTheme: "", yearThemes: {}, narrativeArc: "" },
      competencyGrowthTargets: [
        { competencyItem: "academic_inquiry", targetGrade: "A+", yearTarget: 3, pathway: "" },
        { competencyItem: "community_leadership", targetGrade: "A-", yearTarget: 3, pathway: "" },
        // 유효하지 않은 값 — filter 로 제외되는지 검증
        { competencyItem: "invalid_code", targetGrade: "A+", yearTarget: 3, pathway: "" },
        { competencyItem: "career_exploration", targetGrade: "Z", yearTarget: 3, pathway: "" },
        { competencyItem: "career_exploration", targetGrade: "A+", yearTarget: 99, pathway: "" },
      ],
      milestones: {},
    });

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.blueprint).not.toBeNull();
    // 유효 2건만 통과
    expect(state.blueprint!.competencyGrowthTargets).toHaveLength(2);
    expect(state.blueprint!.competencyGrowthTargets[0]).toMatchObject({
      code: "academic_inquiry",
      targetGrade: "A+",
      yearTarget: 3,
    });

    // blueprintGap 계산됨 (targets 존재 + blueprint 존재)
    expect(state.blueprintGap).not.toBeNull();
    expect(state.blueprintGap!.version).toBe("v1_rule");
    // current axes 없으므로 latent (잔여=2) 패턴 생성
    // remaining = (3-2)*2 + 0 = 2 ≥ LATENT_THRESHOLD 2 → latent
    expect(state.blueprintGap!.remainingSemesters).toBe(2);
    expect(state.blueprintGap!.axisGaps).toHaveLength(2);
    expect(state.blueprintGap!.axisGaps.every((g) => g.pattern === "latent")).toBe(true);

    // α3-3-2: multiScenarioGap 도 동시 계산됨 (baseline + stable + aggressive).
    expect(state.multiScenarioGap).not.toBeNull();
    expect(state.multiScenarioGap!.version).toBe("v1_rule_multi");
    expect(state.multiScenarioGap!.baseline.axisGaps).toHaveLength(2);
    expect(state.multiScenarioGap!.stable).not.toBeNull();
    expect(state.multiScenarioGap!.aggressive).not.toBeNull();
    // stable/aggressive 는 grade shift 를 반영해 targetGrade 가 변경된 상태.
    // baseline A+ → stable A- (shift -1), aggressive A+ (상한 clamp).
    const academicBase = state.multiScenarioGap!.baseline.axisGaps.find((g) => g.code === "academic_inquiry");
    const academicStable = state.multiScenarioGap!.stable!.axisGaps.find((g) => g.code === "academic_inquiry");
    expect(academicBase?.targetGrade).toBe("A+");
    expect(academicStable?.targetGrade).toBe("A-");
    // dominantScenario 는 null 이 아님 (targets 있음).
    expect(state.multiScenarioGap!.dominantScenario).not.toBeNull();
  });

  it("blueprint active + targets 빈 배열 → blueprintGap=null (GAP 계산 skip)", async () => {
    mockGetActiveMainExploration.mockResolvedValue({
      id: "me-2",
      version: 1,
      origin: "consultant_direct",
      tier_plan: null,
      career_field: null,
      updated_at: "2026-04-01T00:00:00Z",
    });
    mockLoadBlueprintForStudent.mockResolvedValue(null);

    const client = makeClient() as unknown as SupabaseClient<Database>;
    const state = await buildStudentState(
      "student-1",
      "tenant-1",
      { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
      { client },
    );

    expect(state.blueprint).not.toBeNull();
    expect(state.blueprint!.competencyGrowthTargets).toEqual([]);
    expect(state.blueprintGap).toBeNull();
    // α3-3-2: targets 빈 경우 multiScenarioGap 도 null.
    expect(state.multiScenarioGap).toBeNull();
  });
});
