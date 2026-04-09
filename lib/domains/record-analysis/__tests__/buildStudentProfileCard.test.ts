// ============================================
// buildStudentProfileCard + renderStudentProfileCard 유닛 테스트
//
// 대상: Layer 0 학생 프로필 카드 빌더 (이전 학년 competency_scores + content_quality 집계)
// 전략: 테이블별 응답 분기 가능한 Supabase mock + 픽스처 기반 입출력 검증
// ============================================

import { describe, it, expect, vi } from "vitest";
import {
  buildStudentProfileCard,
  renderStudentProfileCard,
} from "../pipeline/pipeline-task-runners-shared";
import type { PipelineContext, StudentProfileCard } from "../pipeline/pipeline-types";

// ============================================
// Supabase mock (테이블별 응답 분기)
// ============================================

type TableData = Record<string, { data: unknown; error: null | Error }>;

function makeSupabaseMock(tableData: TableData = {}, throwOnTable?: string) {
  const defaultResponse = { data: [], error: null };

  const makeChain = (tableName: string, resolveData: unknown) => {
    const chain: Record<string, unknown> = {};
    const terminal = vi.fn().mockImplementation(() => {
      if (throwOnTable && tableName === throwOnTable) {
        return Promise.reject(new Error("DB throw"));
      }
      return Promise.resolve(resolveData);
    });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.limit = terminal;
    // Thenable
    chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      (terminal() as Promise<unknown>).then(resolve, reject);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      const override = tableData[table];
      return makeChain(table, override ?? defaultResponse);
    }),
  } as unknown as PipelineContext["supabase"];
}

// ============================================
// 1. Short-circuit: targetGrade <= 1
// ============================================

describe("buildStudentProfileCard — short-circuit", () => {
  it("returns undefined when targetGrade=1 (no prior years)", async () => {
    const supabase = makeSupabaseMock();
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 1);
    expect(result).toBeUndefined();
  });

  it("returns undefined when targetGrade=0", async () => {
    const supabase = makeSupabaseMock();
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 0);
    expect(result).toBeUndefined();
  });
});

// ============================================
// 2. Empty DB → undefined
// ============================================

describe("buildStudentProfileCard — empty data", () => {
  it("returns undefined when both DB queries return empty", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: { data: [], error: null },
      student_record_content_quality: { data: [], error: null },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeUndefined();
  });
});

// ============================================
// 3. DB throw → undefined (non-fatal)
// ============================================

describe("buildStudentProfileCard — error handling", () => {
  it("returns undefined when DB throws (non-fatal)", async () => {
    const supabase = makeSupabaseMock(
      {
        student_record_competency_scores: { data: [], error: null },
        student_record_content_quality: { data: [], error: null },
      },
      "student_record_competency_scores",
    );
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeUndefined();
  });
});

// ============================================
// 4. Persistent strengths aggregation
// ============================================

describe("buildStudentProfileCard — persistent strengths", () => {
  it("aggregates items with max grade >= A-", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: {
        data: [
          { school_year: 2024, competency_item: "탐구역량", grade: "A+" },
          { school_year: 2025, competency_item: "탐구역량", grade: "A-" },
          { school_year: 2024, competency_item: "학업역량", grade: "B+" },
          { school_year: 2025, competency_item: "공동체역량", grade: "B" },
        ],
        error: null,
      },
      student_record_content_quality: { data: [], error: null },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeDefined();
    expect(result!.persistentStrengths).toHaveLength(1);
    expect(result!.persistentStrengths[0]).toMatchObject({
      competencyItem: "탐구역량",
      bestGrade: "A+",
    });
    expect(result!.persistentStrengths[0].years).toEqual([2024, 2025]);
  });
});

// ============================================
// 5. Persistent weaknesses threshold
// ============================================

describe("buildStudentProfileCard — persistent weaknesses", () => {
  it("requires >=2 distinct years when targetGrade>=3", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: {
        data: [
          // 진로역량 = 2년 모두 B-/C → 포함
          { school_year: 2024, competency_item: "진로역량", grade: "B-" },
          { school_year: 2025, competency_item: "진로역량", grade: "C" },
          // 학업역량 = 1년만 B- → 제외 (threshold=2)
          { school_year: 2024, competency_item: "학업역량", grade: "B-" },
          { school_year: 2025, competency_item: "학업역량", grade: "B" },
        ],
        error: null,
      },
      student_record_content_quality: { data: [], error: null },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeDefined();
    expect(result!.persistentWeaknesses).toHaveLength(1);
    expect(result!.persistentWeaknesses[0]).toMatchObject({
      competencyItem: "진로역량",
      worstGrade: "C",
    });
  });

  it("relaxes to >=1 year when targetGrade=2", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: {
        data: [
          { school_year: 2025, competency_item: "공동체역량", grade: "B-" },
        ],
        error: null,
      },
      student_record_content_quality: { data: [], error: null },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 2);
    expect(result).toBeDefined();
    expect(result!.persistentWeaknesses).toHaveLength(1);
    expect(result!.persistentWeaknesses[0].competencyItem).toBe("공동체역량");
  });
});

// ============================================
// 6. Recurring quality issues (top 3, count >= 2)
// ============================================

describe("buildStudentProfileCard — recurring quality issues", () => {
  it("returns top 3 issues with count >= 2, excludes single-occurrence", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: { data: [], error: null },
      student_record_content_quality: {
        data: [
          { school_year: 2024, overall_score: 60, issues: ["P1_나열식", "F10_성장부재", "X1_단회"] },
          { school_year: 2024, overall_score: 70, issues: ["P1_나열식", "F10_성장부재"] },
          { school_year: 2025, overall_score: 75, issues: ["P1_나열식", "P2_추상적"] },
          { school_year: 2025, overall_score: 80, issues: ["P2_추상적"] },
        ],
        error: null,
      },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeDefined();
    expect(result!.recurringQualityIssues).toHaveLength(3);
    // 첫 번째는 count=3인 P1_나열식이 확정
    expect(result!.recurringQualityIssues[0]).toEqual({ code: "P1_나열식", count: 3 });
    // 2~3위는 count=2 동점이므로 tie-break 순서 무관하게 검증
    const restCodes = new Set(result!.recurringQualityIssues.slice(1).map((x) => x.code));
    expect(restCodes).toEqual(new Set(["P2_추상적", "F10_성장부재"]));
    for (const issue of result!.recurringQualityIssues.slice(1)) {
      expect(issue.count).toBe(2);
    }
    // X1_단회 (count=1) 제외 확인
    const codes = result!.recurringQualityIssues.map((x) => x.code);
    expect(codes).not.toContain("X1_단회");
  });

  it("computes averageQualityScore with 1-decimal rounding", async () => {
    const supabase = makeSupabaseMock({
      student_record_competency_scores: { data: [], error: null },
      student_record_content_quality: {
        data: [
          { school_year: 2024, overall_score: 60, issues: [] },
          { school_year: 2024, overall_score: 70, issues: [] },
          { school_year: 2025, overall_score: 75, issues: [] },
        ],
        error: null,
      },
    });
    const result = await buildStudentProfileCard(supabase, "student-1", "tenant-1", 2026, 3);
    expect(result).toBeDefined();
    // (60+70+75)/3 = 68.333... → 68.3
    expect(result!.averageQualityScore).toBe(68.3);
  });
});

// ============================================
// 7. renderStudentProfileCard
// ============================================

describe("renderStudentProfileCard", () => {
  const fullCard: StudentProfileCard = {
    priorSchoolYears: [2024, 2025],
    overallAverageGrade: "B+",
    persistentStrengths: [
      { competencyItem: "탐구역량", bestGrade: "A+", years: [2024, 2025] },
      { competencyItem: "학업역량", bestGrade: "A-", years: [2024] },
    ],
    persistentWeaknesses: [
      { competencyItem: "공동체역량", worstGrade: "C", years: [2024, 2025] },
    ],
    recurringQualityIssues: [
      { code: "P1_나열식", count: 3 },
      { code: "F10_성장부재", count: 2 },
    ],
    averageQualityScore: 72.5,
  };

  it("includes section title and year range", () => {
    const rendered = renderStudentProfileCard(fullCard);
    expect(rendered).toContain("## 학생 프로필 카드 (이전 학년 누적)");
    expect(rendered).toContain("2024~2025학년도");
  });

  it("includes 평가 지침 (evaluation guidance)", () => {
    const rendered = renderStudentProfileCard(fullCard);
    expect(rendered).toContain("**평가 지침**");
    expect(rendered).toContain("지속 약점");
    expect(rendered).toContain("지속 강점");
  });

  it("renders all 5 bullet sections when full data present", () => {
    const rendered = renderStudentProfileCard(fullCard);
    expect(rendered).toContain("- 누적 역량 평균: B+");
    expect(rendered).toContain("- 누적 품질 평균: 72.5/100");
    expect(rendered).toContain("- 지속 강점: 탐구역량(A+)");
    expect(rendered).toContain("- 지속 약점: 공동체역량(C)");
    expect(rendered).toContain("- 반복 품질 이슈: P1_나열식(3회)");
  });

  it("stays under 900 chars on realistic full card", () => {
    const rendered = renderStudentProfileCard(fullCard);
    expect(rendered.length).toBeLessThan(900);
  });

  it("uses single-year label when priorSchoolYears has 1 entry", () => {
    const singleYearCard: StudentProfileCard = {
      ...fullCard,
      priorSchoolYears: [2025],
    };
    const rendered = renderStudentProfileCard(singleYearCard);
    expect(rendered).toContain("2025학년도");
    expect(rendered).not.toContain("2025~");
  });

  it("omits empty sections gracefully", () => {
    const sparseCard: StudentProfileCard = {
      priorSchoolYears: [2025],
      overallAverageGrade: "B",
      persistentStrengths: [],
      persistentWeaknesses: [],
      recurringQualityIssues: [],
      averageQualityScore: null,
    };
    const rendered = renderStudentProfileCard(sparseCard);
    expect(rendered).toContain("- 누적 역량 평균: B");
    expect(rendered).not.toContain("- 누적 품질 평균");
    expect(rendered).not.toContain("- 지속 강점");
    expect(rendered).not.toContain("- 지속 약점");
    expect(rendered).not.toContain("- 반복 품질 이슈");
    // 평가 지침은 여전히 포함
    expect(rendered).toContain("**평가 지침**");
  });
});
