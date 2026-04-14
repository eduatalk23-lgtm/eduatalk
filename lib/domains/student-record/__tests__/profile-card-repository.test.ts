// ============================================
// profile-card-repository.ts 유닛 테스트
//
// 대상:
//   findProfileCard             — 단일 조회
//   upsertProfileCard           — payload 매핑 검증
//   getProfileCardFreshness     — content_hash 비교 staleness 판정
//   rowToProfileCard            — DB row → StudentProfileCard 변환
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findProfileCard,
  upsertProfileCard,
  getProfileCardFreshness,
  rowToProfileCard,
  type PersistedProfileCard,
} from "../repository/profile-card-repository";
import type { StudentProfileCard } from "@/lib/domains/record-analysis/pipeline/pipeline-types";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- 공통 fixture ----

const baseCard: StudentProfileCard = {
  priorSchoolYears: [2024, 2025],
  overallAverageGrade: "B+",
  persistentStrengths: [
    { competencyItem: "academic_inquiry", bestGrade: "A-", years: [2024, 2025] },
  ],
  persistentWeaknesses: [
    { competencyItem: "community_leadership", worstGrade: "C", years: [2025] },
  ],
  recurringQualityIssues: [{ code: "P1_nullajjic", count: 3 }],
  averageQualityScore: 72.3,
  careerTrajectory: {
    byYear: [
      { year: 2024, averageNumericGrade: 3.5 },
      { year: 2025, averageNumericGrade: 4.5 },
    ],
    trend: "rising",
    growthDelta: 1.0,
  },
  depthProgression: {
    byYear: [
      { year: 2024, averageDepth: 2.8 },
      { year: 2025, averageDepth: 3.4 },
    ],
    trend: "rising",
  },
  crossGradeThemes: [
    { id: "theme-1", label: "불평등 탐구", years: [2024, 2025], affectedSubjects: ["사회", "국어"] },
  ],
  interestConsistency: {
    narrative: "일관된 사회과학 관심.",
    sourceThemeIds: ["theme-1"],
    confidence: 0.8,
  },
};

/** findProfileCard / getProfileCardFreshness 용 maybeSingle chain mock */
function mockMaybeSingle(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const chain = { eq: vi.fn(), select: vi.fn(), maybeSingle };
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain) };
}

// ============================================
// 1. findProfileCard
// ============================================

describe("findProfileCard", () => {
  it("카드 없음 → null", async () => {
    const client = mockMaybeSingle(null);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    );

    const result = await findProfileCard("student-1", "tenant-1", 3);
    expect(result).toBeNull();
  });

  it("카드 존재 → PersistedProfileCard 반환", async () => {
    const row: PersistedProfileCard = {
      id: "pc-1",
      tenant_id: "tenant-1",
      student_id: "student-1",
      pipeline_id: null,
      target_grade: 3,
      target_school_year: 2026,
      prior_school_years: [2024, 2025],
      overall_average_grade: "B+",
      average_quality_score: 70.0,
      persistent_strengths: [],
      persistent_weaknesses: [],
      recurring_quality_issues: [],
      career_trajectory: null,
      depth_progression: null,
      cross_grade_themes: null,
      interest_consistency: null,
      content_hash: "h-1",
      source: "ai",
      model_name: null,
      created_at: "2026-04-14T00:00:00Z",
      updated_at: "2026-04-14T00:00:00Z",
    };
    const client = mockMaybeSingle(row);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    );

    const result = await findProfileCard("student-1", "tenant-1", 3);
    expect(result?.id).toBe("pc-1");
    expect(result?.content_hash).toBe("h-1");
  });
});

// ============================================
// 2. upsertProfileCard — payload 매핑
// ============================================

describe("upsertProfileCard — 카드 → DB 컬럼 매핑", () => {
  it("all structural + LLM 필드를 payload로 전달", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    let capturedConflict: string | undefined;

    const selectSingle = { single: vi.fn(() => Promise.resolve({ data: {}, error: null })) };
    const upsertFn = vi.fn((payload: Record<string, unknown>, opts: { onConflict?: string }) => {
      capturedPayload = payload;
      capturedConflict = opts.onConflict;
      return { select: vi.fn(() => selectSingle) };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = { from: vi.fn(() => ({ upsert: upsertFn })) };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    await upsertProfileCard("student-1", "tenant-1", {
      targetGrade: 3,
      targetSchoolYear: 2026,
      card: baseCard,
      contentHash: "abc123",
      source: "ai",
      modelName: "gemini-2.5-flash",
      pipelineId: "pipe-7",
    });

    expect(capturedPayload).not.toBeNull();
    expect(capturedConflict).toBe("tenant_id,student_id,target_grade,source");
    expect(capturedPayload!.tenant_id).toBe("tenant-1");
    expect(capturedPayload!.student_id).toBe("student-1");
    expect(capturedPayload!.pipeline_id).toBe("pipe-7");
    expect(capturedPayload!.target_grade).toBe(3);
    expect(capturedPayload!.target_school_year).toBe(2026);
    expect(capturedPayload!.prior_school_years).toEqual([2024, 2025]);
    expect(capturedPayload!.overall_average_grade).toBe("B+");
    expect(capturedPayload!.average_quality_score).toBe(72.3);
    expect(capturedPayload!.content_hash).toBe("abc123");
    expect(capturedPayload!.source).toBe("ai");
    expect(capturedPayload!.model_name).toBe("gemini-2.5-flash");
    // JSONB 필드
    expect(Array.isArray(capturedPayload!.persistent_strengths)).toBe(true);
    expect(capturedPayload!.career_trajectory).toMatchObject({ trend: "rising" });
    expect(capturedPayload!.interest_consistency).toMatchObject({ confidence: 0.8 });
  });

  it("optional 필드 omit 시 null로 저장", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    const selectSingle = { single: vi.fn(() => Promise.resolve({ data: {}, error: null })) };
    const upsertFn = vi.fn((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return { select: vi.fn(() => selectSingle) };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = { from: vi.fn(() => ({ upsert: upsertFn })) };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client);

    const minimal: StudentProfileCard = {
      priorSchoolYears: [2025],
      overallAverageGrade: "B",
      persistentStrengths: [],
      persistentWeaknesses: [],
      recurringQualityIssues: [],
      averageQualityScore: null,
    };

    await upsertProfileCard("s", "t", {
      targetGrade: 2,
      targetSchoolYear: 2026,
      card: minimal,
      contentHash: "h-min",
    });

    expect(capturedPayload!.career_trajectory).toBeNull();
    expect(capturedPayload!.depth_progression).toBeNull();
    expect(capturedPayload!.cross_grade_themes).toBeNull();
    expect(capturedPayload!.interest_consistency).toBeNull();
    expect(capturedPayload!.model_name).toBeNull();
    expect(capturedPayload!.pipeline_id).toBeNull();
    expect(capturedPayload!.source).toBe("ai"); // default
  });
});

// ============================================
// 3. getProfileCardFreshness — staleness 판정
// ============================================

describe("getProfileCardFreshness — content_hash 비교", () => {
  function existingRow(hash: string): PersistedProfileCard {
    return {
      id: "pc-1",
      tenant_id: "tenant-1",
      student_id: "student-1",
      pipeline_id: null,
      target_grade: 3,
      target_school_year: 2026,
      prior_school_years: [2024, 2025],
      overall_average_grade: "B+",
      average_quality_score: null,
      persistent_strengths: [],
      persistent_weaknesses: [],
      recurring_quality_issues: [],
      career_trajectory: null,
      depth_progression: null,
      cross_grade_themes: null,
      interest_consistency: null,
      content_hash: hash,
      source: "ai",
      model_name: null,
      created_at: "2026-04-14T00:00:00Z",
      updated_at: "2026-04-14T00:00:00Z",
    };
  }

  it("카드 없음 → null (새 빌드 필요)", async () => {
    const client = mockMaybeSingle(null);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    );
    const result = await getProfileCardFreshness("s", "t", 3, "hash-new");
    expect(result).toBeNull();
  });

  it("해시 일치 → { stale: false }", async () => {
    const client = mockMaybeSingle(existingRow("hash-match"));
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    );
    const result = await getProfileCardFreshness("s", "t", 3, "hash-match");
    expect(result?.stale).toBe(false);
  });

  it("해시 불일치 → { stale: true }", async () => {
    const client = mockMaybeSingle(existingRow("hash-old"));
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
    );
    const result = await getProfileCardFreshness("s", "t", 3, "hash-new");
    expect(result?.stale).toBe(true);
    expect(result?.card.content_hash).toBe("hash-old");
  });
});

// ============================================
// 4. rowToProfileCard — DB row → 타입 변환
// ============================================

describe("rowToProfileCard", () => {
  it("optional 필드 null → StudentProfileCard omit", () => {
    const row: PersistedProfileCard = {
      id: "pc-1",
      tenant_id: "t",
      student_id: "s",
      pipeline_id: null,
      target_grade: 2,
      target_school_year: 2026,
      prior_school_years: [2025],
      overall_average_grade: "B",
      average_quality_score: null,
      persistent_strengths: [],
      persistent_weaknesses: [],
      recurring_quality_issues: [],
      career_trajectory: null,
      depth_progression: null,
      cross_grade_themes: null,
      interest_consistency: null,
      content_hash: "h",
      source: "ai",
      model_name: null,
      created_at: "",
      updated_at: "",
    };
    const card = rowToProfileCard(row);
    expect(card.priorSchoolYears).toEqual([2025]);
    expect(card.overallAverageGrade).toBe("B");
    expect(card.careerTrajectory).toBeUndefined();
    expect(card.depthProgression).toBeUndefined();
    expect(card.crossGradeThemes).toBeUndefined();
    expect(card.interestConsistency).toBeUndefined();
  });

  it("optional 필드 존재 → 그대로 복원", () => {
    const row: PersistedProfileCard = {
      id: "pc-1",
      tenant_id: "t",
      student_id: "s",
      pipeline_id: null,
      target_grade: 3,
      target_school_year: 2026,
      prior_school_years: [2024, 2025],
      overall_average_grade: "A-",
      average_quality_score: 80,
      persistent_strengths: [
        { competencyItem: "a", bestGrade: "A+", years: [2024] },
      ],
      persistent_weaknesses: [],
      recurring_quality_issues: [{ code: "P1", count: 2 }],
      career_trajectory: {
        byYear: [{ year: 2024, averageNumericGrade: 4 }],
        trend: "stable",
        growthDelta: 0,
      },
      depth_progression: null,
      cross_grade_themes: null,
      interest_consistency: {
        narrative: "일관된 관심.",
        sourceThemeIds: [],
        confidence: 0.7,
      },
      content_hash: "h",
      source: "ai",
      model_name: "gemini-2.5-flash",
      created_at: "",
      updated_at: "",
    };
    const card = rowToProfileCard(row);
    expect(card.persistentStrengths[0].competencyItem).toBe("a");
    expect(card.careerTrajectory?.trend).toBe("stable");
    expect(card.interestConsistency?.confidence).toBe(0.7);
  });
});
