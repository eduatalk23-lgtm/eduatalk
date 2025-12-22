import { describe, it, expect, vi, beforeEach } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getScoreTrend } from "@/lib/metrics/getScoreTrend";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { SCORE_CONSTANTS, SCORE_TREND_CONSTANTS } from "@/lib/metrics/constants";

// Mock dependencies
vi.mock("@/lib/supabase/safeQuery");

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// Helper functions to create mock data matching the actual DB structure
const createInternalScore = (
  subjectName: string,
  rankGrade: number | null | undefined,
  createdAt: string | null
) => ({
  rank_grade: rankGrade,
  grade: 1,
  semester: 1,
  created_at: createdAt,
  subject_groups: subjectName ? { name: subjectName } : null,
});

const createMockScore = (
  subjectName: string,
  gradeScore: number | null | undefined,
  examDate: string | null
) => ({
  grade_score: gradeScore,
  exam_date: examDate,
  subject_groups: subjectName ? { name: subjectName } : null,
});

describe("getScoreTrend", () => {
  let mockSupabase: SupabaseServerClient;
  const studentId = "student-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    } as unknown as SupabaseServerClient;
  });

  describe("성적 데이터 정렬 및 그룹화 검증", () => {
    it("내신과 모의고사 성적을 날짜순으로 정렬해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 3, "2025-01-10"),
        createInternalScore("영어", 4, "2025-01-05"),
      ];

      const mockMockRows = [
        createMockScore("국어", 2, "2025-01-15"),
      ];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any) // 내신 성적
        .mockResolvedValueOnce(mockMockRows as any); // 모의고사 성적

      const result = await getScoreTrend(mockSupabase, studentId);

      // 날짜순 정렬: 2025-01-15 > 2025-01-10 > 2025-01-05
      expect(result.recentScores).toHaveLength(3);
      expect(result.recentScores[0].testDate).toBe("2025-01-15");
      expect(result.recentScores[1].testDate).toBe("2025-01-10");
      expect(result.recentScores[2].testDate).toBe("2025-01-05");
    });

    it("과목별로 성적을 올바르게 그룹화해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 3, "2025-01-10"),
        createInternalScore("수학", 4, "2025-01-05"),
        createInternalScore("영어", 5, "2025-01-10"),
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 수학: 2개, 영어: 1개
      expect(result.recentScores).toHaveLength(3);
      const mathScores = result.recentScores.filter((s) => s.subject === "수학");
      const englishScores = result.recentScores.filter(
        (s) => s.subject === "영어"
      );
      expect(mathScores).toHaveLength(2);
      expect(englishScores).toHaveLength(1);
    });

    it("내신과 모의고사 성적을 구분해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 3, "2025-01-10"),
      ];

      const mockMockRows = [
        createMockScore("수학", 4, "2025-01-15"),
      ];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows as any);

      const result = await getScoreTrend(mockSupabase, studentId);

      const internalScore = result.recentScores.find(
        (s) => s.scoreType === "internal"
      );
      const mockScore = result.recentScores.find(
        (s) => s.scoreType === "mock"
      );

      expect(internalScore?.scoreType).toBe("internal");
      expect(mockScore?.scoreType).toBe("mock");
    });
  });

  describe("연속 하락 판단 검증", () => {
    it("최근 2회 연속 등급 하락을 올바르게 감지해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 5, "2025-01-15"), // 최근 (나쁨)
        createInternalScore("수학", 4, "2025-01-10"), // 그 전 (좋음)
        createInternalScore("수학", 3, "2025-01-05"), // 더 전 (더 좋음)
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 5등급 > 4등급 (하락)
      expect(result.hasDecliningTrend).toBe(true);
      expect(result.decliningSubjects).toContain("수학");
    });

    it("2회 미만이면 하락으로 판단하지 않아야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 5, "2025-01-15"),
        // 1개만 있음
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 2회 미만이면 하락으로 판단하지 않음
      expect(result.hasDecliningTrend).toBe(false);
      expect(result.decliningSubjects).toHaveLength(0);
    });

    it("하락이 아니면 하락 목록에 포함하지 않아야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 3, "2025-01-15"), // 최근 (좋음)
        createInternalScore("수학", 4, "2025-01-10"), // 그 전 (나쁨)
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 3등급 < 4등급 (상승)
      expect(result.hasDecliningTrend).toBe(false);
      expect(result.decliningSubjects).toHaveLength(0);
    });

    it("여러 과목의 하락을 모두 감지해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 5, "2025-01-15"),
        createInternalScore("수학", 4, "2025-01-10"),
        createInternalScore("영어", 6, "2025-01-15"),
        createInternalScore("영어", 5, "2025-01-10"),
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      expect(result.hasDecliningTrend).toBe(true);
      expect(result.decliningSubjects).toContain("수학");
      expect(result.decliningSubjects).toContain("영어");
      expect(result.decliningSubjects).toHaveLength(2);
    });

    it("constants.ts의 DECLINING_TREND_THRESHOLD 값을 사용해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 5, "2025-01-15"),
        createInternalScore("수학", 4, "2025-01-10"),
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // DECLINING_TREND_THRESHOLD(2) 이상이므로 하락 감지
      expect(result.hasDecliningTrend).toBe(true);
      expect(result.decliningSubjects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("저등급 과목 필터링 검증", () => {
    it("7등급 이상 과목을 저등급으로 분류해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 7, "2025-01-15"), // 7등급
        createInternalScore("영어", 8, "2025-01-15"), // 8등급
        createInternalScore("국어", 6, "2025-01-15"), // 6등급 (7 미만)
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 7등급 이상만 저등급
      expect(result.lowGradeSubjects).toContain("수학");
      expect(result.lowGradeSubjects).toContain("영어");
      expect(result.lowGradeSubjects).not.toContain("국어");
    });

    it("constants.ts의 LOW_GRADE_THRESHOLD 값을 사용해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", SCORE_CONSTANTS.LOW_GRADE_THRESHOLD, "2025-01-15"), // 7등급
        createInternalScore("영어", SCORE_CONSTANTS.LOW_GRADE_THRESHOLD - 1, "2025-01-15"), // 6등급
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // LOW_GRADE_THRESHOLD(7) 이상만 저등급
      expect(result.lowGradeSubjects).toContain("수학");
      expect(result.lowGradeSubjects).not.toContain("영어");
    });

    it("최신 성적 기준으로 저등급을 판단해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", 5, "2025-01-05"), // 과거 (좋음)
        createInternalScore("수학", 7, "2025-01-15"), // 최신 (나쁨)
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // 최신 성적(7등급) 기준으로 저등급 판단
      expect(result.lowGradeSubjects).toContain("수학");
    });
  });

  describe("방어 로직 검증", () => {
    it("null 값이 있는 성적은 무시해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("", 3, "2025-01-15"), // subject_groups.name null
        createInternalScore("수학", null, "2025-01-15"), // rank_grade null
        createInternalScore("영어", 4, null), // created_at null
        createInternalScore("국어", 5, "2025-01-15"), // 유효
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // null 값이 있는 성적은 제외
      expect(result.recentScores).toHaveLength(1);
      expect(result.recentScores[0].subject).toBe("국어");
    });

    it("undefined 값이 있는 성적은 무시해야 함", async () => {
      const mockInternalRows = [
        createInternalScore("수학", undefined, "2025-01-15"),
        createInternalScore("영어", 4, "2025-01-15"),
      ];

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // undefined 값이 있는 성적은 제외
      expect(result.recentScores).toHaveLength(1);
      expect(result.recentScores[0].subject).toBe("영어");
    });

    it("빈 성적 배열에 대해 빈 결과를 반환해야 함", async () => {
      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce([]) // 내신 성적
        .mockResolvedValueOnce([]); // 모의고사 성적

      const result = await getScoreTrend(mockSupabase, studentId);

      expect(result.hasDecliningTrend).toBe(false);
      expect(result.decliningSubjects).toEqual([]);
      expect(result.lowGradeSubjects).toEqual([]);
      expect(result.recentScores).toEqual([]);
    });

    it("최근 성적 개수 제한을 적용해야 함", async () => {
      const mockInternalRows = Array.from({ length: 30 }, (_, i) =>
        createInternalScore("수학", 3, `2025-01-${String(i + 1).padStart(2, "0")}`)
      );

      const mockMockRows: any[] = [];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockInternalRows as any)
        .mockResolvedValueOnce(mockMockRows);

      const result = await getScoreTrend(mockSupabase, studentId);

      // RETURN_SCORES_LIMIT(10) 개만 반환
      expect(result.recentScores.length).toBeLessThanOrEqual(
        SCORE_TREND_CONSTANTS.RETURN_SCORES_LIMIT
      );
    });
  });

  describe("에러 처리", () => {
    it("에러 발생 시 빈 결과를 반환해야 함", async () => {
      vi.mocked(safeQueryArray).mockRejectedValue(new Error("Database error"));

      const result = await getScoreTrend(mockSupabase, studentId);

      expect(result.hasDecliningTrend).toBe(false);
      expect(result.decliningSubjects).toEqual([]);
      expect(result.lowGradeSubjects).toEqual([]);
      expect(result.recentScores).toEqual([]);
    });
  });
});
