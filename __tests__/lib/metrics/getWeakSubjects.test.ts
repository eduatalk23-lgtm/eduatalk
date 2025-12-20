import { describe, it, expect, vi, beforeEach } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { WEAK_SUBJECT_CONSTANTS } from "@/lib/metrics/constants";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("@/lib/studySessions/queries");
vi.mock("@/lib/supabase/safeQuery");

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

describe("getWeakSubjects", () => {
  let mockSupabase: SupabaseServerClient;
  const studentId = "student-123";
  const weekStart = new Date("2025-01-06");
  const weekEnd = new Date("2025-01-12");

  // Context 기반 모킹을 위한 데이터 저장소
  let mockPlansData: any[] = [];
  let mockBooksData: any[] = [];
  let mockLecturesData: any[] = [];
  let mockCustomData: any[] = [];
  let mockAnalysisData: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    } as unknown as SupabaseServerClient;

    // 기본값 초기화
    mockPlansData = [];
    mockBooksData = [];
    mockLecturesData = [];
    mockCustomData = [];
    mockAnalysisData = [];

    // Context 기반 모킹 구현
    (safeQueryArray as Mock).mockImplementation(
      async (queryFn: any, fallbackFn: any, options?: { context?: string }) => {
        const context = options?.context || "";

        if (context.includes("플랜 조회")) return mockPlansData;
        if (context.includes("책 조회")) return mockBooksData;
        if (context.includes("강의 조회")) return mockLecturesData;
        if (context.includes("커스텀 콘텐츠 조회")) return mockCustomData;
        if (context.includes("분석 조회")) return mockAnalysisData;

        return []; // 기본값
      }
    );
  });

  describe("데이터 그룹화 로직 검증", () => {
    it("플랜 ID를 통해 콘텐츠 정보를 올바르게 매핑해야 함", async () => {
      // Mock sessions with plan_id
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: 3600, // 60분
          content_type: null,
          content_id: null,
        },
        {
          id: "session-2",
          plan_id: "plan-2",
          duration_seconds: 1800, // 30분
          content_type: null,
          content_id: null,
        },
      ];

      // Mock plans
      const mockPlans = [
        { id: "plan-1", content_type: "book", content_id: "book-1" },
        { id: "plan-2", content_type: "lecture", content_id: "lecture-1" },
      ];

      // Mock contents
      const mockBooks = [{ id: "book-1", subject: "수학" }];
      const mockLectures = [{ id: "lecture-1", subject: "영어" }];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹: 각 데이터를 변수에 할당
      mockPlansData = mockPlans;
      mockBooksData = mockBooks;
      mockLecturesData = mockLectures;
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // 수학: 60분, 영어: 30분
      expect(result.subjectStudyTime.get("수학")).toBe(60);
      expect(result.subjectStudyTime.get("영어")).toBe(30);
      expect(result.totalStudyTime).toBe(90);
    });

    it("직접 세션의 content_type/content_id를 통해 과목을 매핑해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: null,
          content_type: "book",
          content_id: "book-1",
          duration_seconds: 1800, // 30분
        },
      ];

      const mockBooks = [{ id: "book-1", subject: "국어" }];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹: plan_id가 null이므로 plans query는 호출되지 않음
      mockPlansData = [];
      mockBooksData = mockBooks;
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result.subjectStudyTime.get("국어")).toBe(30);
      expect(result.totalStudyTime).toBe(30);
    });

    it("같은 과목의 여러 세션을 합산해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: 1800, // 30분
        },
        {
          id: "session-2",
          plan_id: "plan-2",
          duration_seconds: 3600, // 60분
        },
      ];

      const mockPlans = [
        { id: "plan-1", content_type: "book", content_id: "book-1" },
        { id: "plan-2", content_type: "book", content_id: "book-1" },
      ];

      const mockBooks = [{ id: "book-1", subject: "수학" }];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹
      mockPlansData = mockPlans;
      mockBooksData = mockBooks;
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // 수학: 30분 + 60분 = 90분
      expect(result.subjectStudyTime.get("수학")).toBe(90);
      expect(result.totalStudyTime).toBe(90);
    });
  });

  describe("취약 과목 필터링 검증", () => {
    it("risk_score >= 50인 과목만 취약 과목으로 분류해야 함", async () => {
      const mockSessions: any[] = [];
      const mockAnalyses = [
        { subject: "수학", risk_score: 60 },
        { subject: "영어", risk_score: 45 }, // 50 미만
        { subject: "국어", risk_score: 50 }, // 경계값
        { subject: "과학", risk_score: null }, // null
      ];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions);

      // Context 기반 모킹: planIds.size === 0이므로 plans query는 호출되지 않음
      mockPlansData = [];
      mockBooksData = [];
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = mockAnalyses;

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // 수학(60), 국어(50)만 취약 과목
      expect(result.weakSubjects).toHaveLength(2);
      expect(result.weakSubjects).toContain("수학");
      expect(result.weakSubjects).toContain("국어");
      expect(result.weakSubjects).not.toContain("영어");
      expect(result.weakSubjects).not.toContain("과학");
    });

    it("constants.ts의 RISK_SCORE_THRESHOLD 값을 사용해야 함", async () => {
      const mockSessions: any[] = [];
      const mockAnalyses = [
        {
          subject: "수학",
          risk_score: WEAK_SUBJECT_CONSTANTS.RISK_SCORE_THRESHOLD - 1,
        },
        {
          subject: "영어",
          risk_score: WEAK_SUBJECT_CONSTANTS.RISK_SCORE_THRESHOLD,
        },
      ];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions);

      // Context 기반 모킹: planIds.size === 0이므로 plans query는 호출되지 않음
      mockPlansData = [];
      mockBooksData = [];
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = mockAnalyses;

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // RISK_SCORE_THRESHOLD(50) 이상만 취약 과목
      expect(result.weakSubjects).toHaveLength(1);
      expect(result.weakSubjects).toContain("영어");
      expect(result.weakSubjects).not.toContain("수학");
    });
  });

  describe("취약 과목 학습시간 비율 계산", () => {
    it("취약 과목 학습시간 비율을 올바르게 계산해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: 3600, // 60분 - 수학
        },
        {
          id: "session-2",
          plan_id: "plan-2",
          duration_seconds: 1800, // 30분 - 영어
        },
        {
          id: "session-3",
          plan_id: "plan-3",
          duration_seconds: 1800, // 30분 - 국어
        },
      ];

      const mockPlans = [
        { id: "plan-1", content_type: "book", content_id: "book-1" },
        { id: "plan-2", content_type: "book", content_id: "book-2" },
        { id: "plan-3", content_type: "book", content_id: "book-3" },
      ];

      const mockBooks = [
        { id: "book-1", subject: "수학" },
        { id: "book-2", subject: "영어" },
        { id: "book-3", subject: "국어" },
      ];

      const mockAnalyses = [
        { subject: "수학", risk_score: 60 }, // 취약
        { subject: "영어", risk_score: 45 }, // 비취약
        { subject: "국어", risk_score: 55 }, // 취약
      ];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹
      mockPlansData = mockPlans;
      mockBooksData = mockBooks;
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = mockAnalyses;

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // 전체: 120분, 취약 과목(수학 60분 + 국어 30분): 90분
      // 비율: 90/120 * 100 = 75%
      expect(result.totalStudyTime).toBe(120);
      expect(result.weakSubjectStudyTimeRatio).toBe(75);
      expect(result.weakSubjects).toContain("수학");
      expect(result.weakSubjects).toContain("국어");
    });

    it("전체 학습시간이 0이면 비율도 0이어야 함", async () => {
      const mockSessions: any[] = [];
      const mockAnalyses = [{ subject: "수학", risk_score: 60 }];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions);

      // Context 기반 모킹: planIds.size === 0이므로 plans query는 호출되지 않음
      mockPlansData = [];
      mockBooksData = [];
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = mockAnalyses;

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result.totalStudyTime).toBe(0);
      expect(result.weakSubjectStudyTimeRatio).toBe(0);
    });
  });

  describe("방어 로직 검증", () => {
    it("세션에 duration_seconds가 없으면 무시해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: null,
        },
        {
          id: "session-2",
          plan_id: "plan-2",
          duration_seconds: 1800,
        },
      ];

      const mockPlans = [
        { id: "plan-1", content_type: "book", content_id: "book-1" },
        { id: "plan-2", content_type: "book", content_id: "book-2" },
      ];

      const mockBooks = [
        { id: "book-1", subject: "수학" },
        { id: "book-2", subject: "영어" },
      ];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹
      mockPlansData = mockPlans;
      mockBooksData = mockBooks;
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // duration_seconds가 null인 세션은 무시
      expect(result.subjectStudyTime.get("수학")).toBeUndefined();
      expect(result.subjectStudyTime.get("영어")).toBe(30);
      expect(result.totalStudyTime).toBe(30);
    });

    it("플랜에 content_type이나 content_id가 null이면 무시해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: 1800,
        },
      ];

      const mockPlans = [
        { id: "plan-1", content_type: null, content_id: "book-1" },
      ];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹
      mockPlansData = mockPlans;
      mockBooksData = [];
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // content_type이 null이면 매핑되지 않음
      expect(result.totalStudyTime).toBe(0);
      expect(result.subjectStudyTime.size).toBe(0);
    });

    it("콘텐츠에 subject가 null이면 무시해야 함", async () => {
      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          duration_seconds: 1800,
        },
      ];

      const mockPlans = [
        { id: "plan-1", content_type: "book", content_id: "book-1" },
      ];

      const mockBooks = [{ id: "book-1", subject: null }];

      vi.mocked(getSessionsByDateRange).mockResolvedValue(mockSessions as any);

      // Context 기반 모킹
      mockPlansData = mockPlans;
      mockBooksData = mockBooks;
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      // subject가 null이면 학습시간에 포함되지 않음
      expect(result.totalStudyTime).toBe(0);
      expect(result.subjectStudyTime.size).toBe(0);
    });

    it("빈 세션 배열에 대해 빈 결과를 반환해야 함", async () => {
      vi.mocked(getSessionsByDateRange).mockResolvedValue([]);

      // Context 기반 모킹: 빈 세션 배열이므로 모든 데이터는 빈 배열
      mockPlansData = [];
      mockBooksData = [];
      mockLecturesData = [];
      mockCustomData = [];
      mockAnalysisData = [];

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result.weakSubjects).toEqual([]);
      expect(result.subjectStudyTime.size).toBe(0);
      expect(result.totalStudyTime).toBe(0);
      expect(result.weakSubjectStudyTimeRatio).toBe(0);
    });
  });

  describe("에러 처리", () => {
    it("에러 발생 시 빈 결과를 반환해야 함", async () => {
      vi.mocked(getSessionsByDateRange).mockRejectedValue(
        new Error("Database error")
      );

      const result = await getWeakSubjects(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result.weakSubjects).toEqual([]);
      expect(result.subjectStudyTime.size).toBe(0);
      expect(result.totalStudyTime).toBe(0);
      expect(result.weakSubjectStudyTimeRatio).toBe(0);
    });
  });
});

