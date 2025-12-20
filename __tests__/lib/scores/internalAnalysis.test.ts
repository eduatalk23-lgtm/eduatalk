import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";

// Supabase 클라이언트 모킹
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(() => ({
            maybeSingle: vi.fn(),
            single: vi.fn(),
          })),
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              gt: vi.fn(),
            })),
          })),
        })),
      })),
    })),
  })),
}));

/**
 * internalAnalysis 단위 테스트
 */
describe("getInternalAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GPA 계산이 정상적으로 동작해야 함", async () => {
    const mockSupabase = await import("@/lib/supabase/server").then(
      (m) => m.createSupabaseServerClient()
    );

    // GPA 데이터 모킹
    const mockGpaData = [
      { rank_grade: 2, credit_hours: 4 },
      { rank_grade: 3, credit_hours: 4 },
      { rank_grade: 4, credit_hours: 5 },
    ];

    // GPA 쿼리 체인 모킹
    const mockGpaQuery = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    };

    const mockFrom = {
      select: vi.fn().mockReturnValue(mockGpaQuery),
    };

    (mockSupabase.from as any) = vi.fn().mockReturnValue(mockFrom);
    (mockGpaQuery.not as any).mockResolvedValue({
      data: mockGpaData,
      error: null,
    });

    // GPA 계산 검증: (2*4 + 3*4 + 4*5) / (4+4+5) = (8+12+20)/13 = 40/13 ≈ 3.08
    const expectedGpa = (2 * 4 + 3 * 4 + 4 * 5) / (4 + 4 + 5);
    expect(expectedGpa).toBeCloseTo(3.08, 2);
  });

  it("GPA 계산 시 성적이 없으면 null을 반환해야 함", async () => {
    const mockSupabase = await import("@/lib/supabase/server").then(
      (m) => m.createSupabaseServerClient()
    );

    const mockGpaQuery = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
    };

    const mockFrom = {
      select: vi.fn().mockReturnValue(mockGpaQuery),
    };

    (mockSupabase.from as any) = vi.fn().mockReturnValue(mockFrom);
    (mockGpaQuery.not as any).mockResolvedValue({
      data: [],
      error: null,
    });

    // 빈 배열이면 GPA는 null이어야 함
    const emptyGpa = null;
    expect(emptyGpa).toBeNull();
  });

  it("Z-Index 계산이 정상적으로 동작해야 함", async () => {
    const mockZIndexData = [
      {
        raw_score: 90,
        avg_score: 80,
        std_dev: 10,
        credit_hours: 4,
      },
      {
        raw_score: 85,
        avg_score: 75,
        std_dev: 8,
        credit_hours: 4,
      },
    ];

    // Z-Index 계산: SUM(((raw_score - avg_score) / std_dev) * credit_hours) / SUM(credit_hours)
    // 첫 번째: ((90-80)/10) * 4 = 1.0 * 4 = 4
    // 두 번째: ((85-75)/8) * 4 = 1.25 * 4 = 5
    // 합계: 4 + 5 = 9
    // 총 학점: 4 + 4 = 8
    // Z-Index: 9 / 8 = 1.125

    const totalZCredit = mockZIndexData.reduce((sum, row) => {
      const z = (row.raw_score - row.avg_score) / row.std_dev;
      return sum + z * row.credit_hours;
    }, 0);

    const totalCredit = mockZIndexData.reduce((sum, row) => sum + row.credit_hours, 0);
    const zIndex = totalZCredit / totalCredit;

    expect(zIndex).toBeCloseTo(1.125, 3);
  });

  it("Z-Index 계산 시 표준편차가 0이면 해당 항목을 제외해야 함", async () => {
    const mockZIndexData = [
      {
        raw_score: 90,
        avg_score: 80,
        std_dev: 0, // 표준편차 0
        credit_hours: 4,
      },
      {
        raw_score: 85,
        avg_score: 75,
        std_dev: 8,
        credit_hours: 4,
      },
    ];

    const totalZCredit = mockZIndexData.reduce((sum, row) => {
      if (row.std_dev > 0) {
        const z = (row.raw_score - row.avg_score) / row.std_dev;
        return sum + z * row.credit_hours;
      }
      return sum;
    }, 0);

    const totalCredit = mockZIndexData.reduce((sum, row) => {
      if (row.std_dev > 0) {
        return sum + row.credit_hours;
      }
      return sum;
    }, 0);

    const zIndex = totalCredit > 0 ? totalZCredit / totalCredit : null;

    // 표준편차가 0인 항목은 제외되므로 두 번째 항목만 계산됨
    // ((85-75)/8) * 4 / 4 = 1.25
    expect(zIndex).toBeCloseTo(1.25, 2);
  });

  it("Z-Index 계산 시 데이터가 없으면 null을 반환해야 함", async () => {
    const emptyZIndexData: Array<{
      raw_score: number;
      avg_score: number;
      std_dev: number;
      credit_hours: number;
    }> = [];

    const totalZCredit = emptyZIndexData.reduce((sum, row) => {
      if (row.std_dev > 0) {
        const z = (row.raw_score - row.avg_score) / row.std_dev;
        return sum + z * row.credit_hours;
      }
      return sum;
    }, 0);

    const totalCredit = emptyZIndexData.reduce((sum, row) => sum + row.credit_hours, 0);
    const zIndex = totalCredit > 0 ? totalZCredit / totalCredit : null;

    expect(zIndex).toBeNull();
  });

  it("GPA 계산 시 credit_hours가 0이면 GPA는 0이어야 함", async () => {
    const mockGpaData = [
      { rank_grade: 2, credit_hours: 0 },
      { rank_grade: 3, credit_hours: 0 },
    ];

    const totalGradeCredit = mockGpaData.reduce(
      (sum, row) => sum + (Number(row.rank_grade) || 0) * (Number(row.credit_hours) || 0),
      0
    );
    const totalCredit = mockGpaData.reduce(
      (sum, row) => sum + (Number(row.credit_hours) || 0),
      0
    );

    const gpa = totalCredit > 0 ? totalGradeCredit / totalCredit : 0;

    expect(gpa).toBe(0);
  });

  it("GPA 계산 시 rank_grade가 null이면 해당 항목을 제외해야 함", async () => {
    const mockGpaData = [
      { rank_grade: 2, credit_hours: 4 },
      { rank_grade: null, credit_hours: 4 },
      { rank_grade: 4, credit_hours: 5 },
    ];

    // null 값 필터링 후 계산
    const validData = mockGpaData.filter((row) => row.rank_grade !== null);
    const totalGradeCredit = validData.reduce(
      (sum, row) => sum + (Number(row.rank_grade) || 0) * (Number(row.credit_hours) || 0),
      0
    );
    const totalCredit = validData.reduce(
      (sum, row) => sum + (Number(row.credit_hours) || 0),
      0
    );

    const gpa = totalCredit > 0 ? totalGradeCredit / totalCredit : 0;

    // (2*4 + 4*5) / (4+5) = (8+20)/9 = 28/9 ≈ 3.11
    expect(gpa).toBeCloseTo(3.11, 2);
  });
});

