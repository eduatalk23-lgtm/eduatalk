/**
 * 프롬프트 빌더 테스트
 *
 * planGeneration.ts의 프롬프트 빌드 함수들을 검증합니다.
 *
 * @module __tests__/lib/plan/llm/promptBuilder.test
 */

import { describe, it, expect } from "vitest";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  estimatePromptTokens,
} from "@/lib/domains/plan/llm/prompts/planGeneration";
import type {
  LLMPlanGenerationRequest,
  StudentInfo,
  SubjectScore,
  ContentInfo,
  LearningHistory,
  LearningStyle,
  ExamSchedule,
  PlanGenerationSettings,
  TimeSlotInfo,
} from "@/lib/domains/plan/llm/types";

// ============================================
// 테스트 데이터
// ============================================

const mockStudent: StudentInfo = {
  id: "student-1",
  name: "김철수",
  grade: 11,
  school: "서울고등학교",
  targetUniversity: "서울대학교",
  targetMajor: "컴퓨터공학과",
};

const mockScores: SubjectScore[] = [
  {
    subject: "수학",
    subjectCategory: "수학 가형",
    grade: 3,
    percentile: 85,
    isWeak: true,
    recentTrend: "improving",
  },
  {
    subject: "영어",
    grade: 2,
    percentile: 92,
    isWeak: false,
    recentTrend: "stable",
  },
  {
    subject: "국어",
    grade: 4,
    percentile: 78,
    isWeak: true,
    recentTrend: "declining",
  },
];

const mockContents: ContentInfo[] = [
  {
    id: "content-1",
    title: "수학의 정석",
    subject: "수학",
    subjectCategory: "수학 가형",
    contentType: "book",
    totalPages: 500,
    estimatedHoursTotal: 100,
    difficulty: "hard",
    priority: "high",
  },
  {
    id: "content-2",
    title: "영어 독해 기본",
    subject: "영어",
    contentType: "lecture",
    totalLectures: 30,
    estimatedHoursTotal: 45,
    difficulty: "medium",
    priority: "medium",
  },
];

const mockLearningHistory: LearningHistory = {
  totalPlansCompleted: 150,
  averageCompletionRate: 75,
  averageDailyStudyMinutes: 180,
  preferredStudyTimes: ["morning", "evening"],
  strongDays: [1, 2, 3, 4, 5],
  weakDays: [0, 6],
  frequentlyIncompleteSubjects: ["수학"],
};

const mockLearningStyle: LearningStyle = {
  primary: "visual",
  secondary: "reading",
  preferences: {
    preferVideo: true,
    preferProblemSolving: true,
    preferSummary: false,
    preferRepetition: true,
  },
};

const mockExamSchedules: ExamSchedule[] = [
  {
    examDate: "2026-01-20",
    examName: "1학기 중간고사",
    examType: "midterm",
    subjects: ["수학", "영어", "국어"],
    importance: "high",
  },
  {
    examDate: "2026-03-15",
    examName: "3월 모의고사",
    examType: "mock",
    importance: "medium",
  },
];

const mockSettings: PlanGenerationSettings = {
  startDate: "2026-01-06",
  endDate: "2026-01-19",
  dailyStudyMinutes: 180,
  breakIntervalMinutes: 50,
  breakDurationMinutes: 10,
  excludeDays: [0],
  excludeDates: ["2026-01-10"],
  prioritizeWeakSubjects: true,
  balanceSubjects: true,
  includeReview: true,
  reviewRatio: 0.2,
};

const mockTimeSlots: TimeSlotInfo[] = [
  {
    id: "slot-1",
    name: "오전 1교시",
    startTime: "08:00",
    endTime: "08:50",
    type: "study",
    availableDays: [1, 2, 3, 4, 5],
  },
  {
    id: "slot-2",
    name: "오전 2교시",
    startTime: "09:00",
    endTime: "09:50",
    type: "study",
    availableDays: [1, 2, 3, 4, 5],
  },
  {
    id: "slot-break",
    name: "점심시간",
    startTime: "12:00",
    endTime: "13:00",
    type: "meal",
  },
];

// ============================================
// 시스템 프롬프트 테스트
// ============================================

describe("SYSTEM_PROMPT", () => {
  it("필수 섹션이 포함되어 있다", () => {
    expect(SYSTEM_PROMPT).toContain("핵심 원칙");
    expect(SYSTEM_PROMPT).toContain("출력 형식");
    expect(SYSTEM_PROMPT).toContain("시간 슬롯 활용 규칙");
    expect(SYSTEM_PROMPT).toContain("취약 과목 우선 배치 전략");
    expect(SYSTEM_PROMPT).toContain("복습 비율 적용");
    expect(SYSTEM_PROMPT).toContain("콘텐츠 진도 분배");
    expect(SYSTEM_PROMPT).toContain("제외 규칙");
  });

  it("학습 스타일 반영 섹션이 포함되어 있다", () => {
    expect(SYSTEM_PROMPT).toContain("학습 스타일 반영");
    expect(SYSTEM_PROMPT).toContain("visual");
    expect(SYSTEM_PROMPT).toContain("auditory");
    expect(SYSTEM_PROMPT).toContain("kinesthetic");
    expect(SYSTEM_PROMPT).toContain("reading");
  });

  it("시험 일정 고려 섹션이 포함되어 있다", () => {
    expect(SYSTEM_PROMPT).toContain("시험 일정 고려");
    expect(SYSTEM_PROMPT).toContain("D-day 기반 학습 강도 조절");
    expect(SYSTEM_PROMPT).toContain("D-30");
    expect(SYSTEM_PROMPT).toContain("D-7");
    expect(SYSTEM_PROMPT).toContain("midterm");
    expect(SYSTEM_PROMPT).toContain("suneung");
  });

  it("Few-shot 예시가 포함되어 있다", () => {
    expect(SYSTEM_PROMPT).toContain("Few-shot 예시");
    expect(SYSTEM_PROMPT).toContain("예시 1: 취약 과목 집중");
    expect(SYSTEM_PROMPT).toContain("예시 2: 시험 D-7");
  });

  it("JSON 출력 형식 가이드가 있다", () => {
    expect(SYSTEM_PROMPT).toContain("weeklyMatrices");
    expect(SYSTEM_PROMPT).toContain("totalPlans");
    expect(SYSTEM_PROMPT).toContain("recommendations");
    expect(SYSTEM_PROMPT).toContain("contentId");
  });

  it("주의사항이 포함되어 있다", () => {
    expect(SYSTEM_PROMPT).toContain("주의사항");
    expect(SYSTEM_PROMPT).toContain("24시간 형식");
    expect(SYSTEM_PROMPT).toContain("ISO 형식");
    expect(SYSTEM_PROMPT).toContain("contentId는 반드시 제공된 콘텐츠 목록의 ID만 사용");
  });
});

// ============================================
// buildUserPrompt 테스트
// ============================================

describe("buildUserPrompt", () => {
  describe("기본 요청", () => {
    it("최소 필수 정보로 프롬프트를 생성한다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // 학생 정보 포함
      expect(prompt).toContain("학생 정보");
      expect(prompt).toContain("김철수");
      expect(prompt).toContain("11학년");

      // 콘텐츠 정보 포함
      expect(prompt).toContain("학습 콘텐츠");
      expect(prompt).toContain("수학의 정석");
      expect(prompt).toContain("영어 독해 기본");

      // 설정 정보 포함 (플랜 설정 섹션)
      expect(prompt).toContain("플랜 설정");
      expect(prompt).toContain("2026-01-06");
      expect(prompt).toContain("2026-01-19");
    });

    it("생성 지시가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("위 정보를 바탕으로");
      expect(prompt).toContain("JSON 형식으로");
    });
  });

  describe("학생 정보 포맷팅", () => {
    it("목표 대학/학과가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("서울대학교");
      expect(prompt).toContain("컴퓨터공학과");
    });

    it("선택적 필드가 없으면 생략된다", () => {
      const studentWithoutOptional: StudentInfo = {
        id: "student-2",
        name: "박영희",
        grade: 10,
      };

      const request: LLMPlanGenerationRequest = {
        student: studentWithoutOptional,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("박영희");
      expect(prompt).toContain("10학년");
      expect(prompt).not.toContain("목표 대학");
    });
  });

  describe("성적 정보 포맷팅", () => {
    it("성적 정보가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        scores: mockScores,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("성적 현황");
      expect(prompt).toContain("수학");
      expect(prompt).toContain("등급: 3");
    });

    it("취약 과목 표시가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        scores: mockScores,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("⚠️ 취약");
    });

    it("성적 추세 이모지가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        scores: mockScores,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("📈"); // improving
      expect(prompt).toContain("➡️"); // stable
      expect(prompt).toContain("📉"); // declining
    });
  });

  describe("콘텐츠 정보 포맷팅", () => {
    it("콘텐츠 ID와 제목이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("content-1");
      expect(prompt).toContain("수학의 정석");
      expect(prompt).toContain("content-2");
      expect(prompt).toContain("영어 독해 기본");
    });

    it("난이도가 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("🔴"); // hard
      expect(prompt).toContain("🟡"); // medium
    });

    it("콘텐츠 분량 정보가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("500"); // totalPages
      expect(prompt).toContain("30"); // totalLectures
    });
  });

  describe("학습 이력 포맷팅", () => {
    it("학습 이력이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        learningHistory: mockLearningHistory,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("학습 이력");
      expect(prompt).toContain("150");
      expect(prompt).toContain("75%");
    });

    it("선호 학습 시간대가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        learningHistory: mockLearningHistory,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("아침");
      expect(prompt).toContain("저녁");
    });
  });

  describe("학습 스타일 포맷팅", () => {
    it("학습 스타일이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        learningStyle: mockLearningStyle,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("학습 스타일");
      expect(prompt).toContain("시각형");
      expect(prompt).toContain("독서형");
    });

    it("학습 선호도가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        learningStyle: mockLearningStyle,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // 실제 구현에서 사용하는 텍스트
      expect(prompt).toContain("📹 영상 강의");
      expect(prompt).toContain("✏️ 문제 풀이");
      expect(prompt).toContain("🔁 반복 학습");
    });
  });

  describe("시험 일정 포맷팅", () => {
    it("시험 일정이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("시험 일정");
      expect(prompt).toContain("1학기 중간고사");
      expect(prompt).toContain("2026-01-20");
    });

    it("D-day가 계산되어 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // D-day는 시작일 기준으로 계산됨
      expect(prompt).toMatch(/D-\d+/);
    });

    it("시험 유형이 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // 실제 구현에서 사용하는 텍스트
      expect(prompt).toContain("중간고사");
      expect(prompt).toContain("모의고사");
    });

    it("중요도가 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("🔴"); // high importance
    });

    it("현재 학습 페이즈 가이드가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("현재 학습 페이즈");
    });
  });

  describe("설정 포맷팅", () => {
    it("제외 요일이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("제외 요일");
      expect(prompt).toContain("일");
    });

    it("제외 날짜가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("제외 날짜");
      expect(prompt).toContain("2026-01-10");
    });

    it("취약 과목 우선 설정이 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("취약 과목 우선");
    });

    it("복습 비율이 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("복습");
      expect(prompt).toContain("20%");
    });
  });

  describe("시간 슬롯 포맷팅", () => {
    it("시간 슬롯 정보가 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
        timeSlots: mockTimeSlots,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("시간 슬롯");
      expect(prompt).toContain("오전 1교시");
      expect(prompt).toContain("08:00");
      expect(prompt).toContain("08:50");
    });

    it("슬롯 타입 이모지가 표시된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
        timeSlots: mockTimeSlots,
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("📖"); // study
      expect(prompt).toContain("🍚"); // meal (실제 구현)
    });
  });

  describe("추가 지시사항", () => {
    it("추가 지시사항이 포함된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        settings: mockSettings,
        additionalInstructions: "수학은 매일 2시간 이상 배치해주세요.",
      };

      const prompt = buildUserPrompt(request);

      expect(prompt).toContain("추가 지시사항");
      expect(prompt).toContain("수학은 매일 2시간 이상 배치해주세요");
    });
  });

  describe("컨텍스트 노트", () => {
    it("시험이 있으면 컨텍스트 노트가 추가된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        examSchedules: mockExamSchedules,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // 실제 구현에서는 "시험 일정(D-day)을 고려하여" 텍스트 사용
      expect(prompt).toContain("시험 일정");
    });

    it("학습 스타일이 있으면 컨텍스트 노트가 추가된다", () => {
      const request: LLMPlanGenerationRequest = {
        student: mockStudent,
        contents: mockContents,
        learningStyle: mockLearningStyle,
        settings: mockSettings,
      };

      const prompt = buildUserPrompt(request);

      // 실제 구현에서는 "학생의 학습 스타일을 고려하여" 텍스트 사용
      expect(prompt).toContain("학습 스타일");
    });
  });
});

// ============================================
// estimatePromptTokens 테스트
// ============================================

describe("estimatePromptTokens", () => {
  it("토큰 수를 추정한다", () => {
    const request: LLMPlanGenerationRequest = {
      student: mockStudent,
      contents: mockContents,
      settings: mockSettings,
    };

    const result = estimatePromptTokens(request);

    expect(result).toHaveProperty("systemTokens");
    expect(result).toHaveProperty("userTokens");
    expect(result).toHaveProperty("totalTokens");
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("콘텐츠가 많을수록 토큰 수가 증가한다", () => {
    const smallRequest: LLMPlanGenerationRequest = {
      student: mockStudent,
      contents: [mockContents[0]],
      settings: mockSettings,
    };

    const largeRequest: LLMPlanGenerationRequest = {
      student: mockStudent,
      contents: [...mockContents, ...mockContents, ...mockContents],
      settings: mockSettings,
    };

    const smallResult = estimatePromptTokens(smallRequest);
    const largeResult = estimatePromptTokens(largeRequest);

    expect(largeResult.totalTokens).toBeGreaterThan(smallResult.totalTokens);
  });

  it("모든 옵션이 포함되면 토큰 수가 증가한다", () => {
    const minimalRequest: LLMPlanGenerationRequest = {
      student: mockStudent,
      contents: mockContents,
      settings: mockSettings,
    };

    const fullRequest: LLMPlanGenerationRequest = {
      student: mockStudent,
      scores: mockScores,
      contents: mockContents,
      learningHistory: mockLearningHistory,
      learningStyle: mockLearningStyle,
      examSchedules: mockExamSchedules,
      settings: mockSettings,
      timeSlots: mockTimeSlots,
      additionalInstructions: "추가 지시사항",
    };

    const minimalResult = estimatePromptTokens(minimalRequest);
    const fullResult = estimatePromptTokens(fullRequest);

    expect(fullResult.totalTokens).toBeGreaterThan(minimalResult.totalTokens);
  });

  it("시스템 토큰과 사용자 토큰 합이 전체 토큰과 같다", () => {
    const request: LLMPlanGenerationRequest = {
      student: mockStudent,
      contents: mockContents,
      settings: mockSettings,
    };

    const result = estimatePromptTokens(request);

    expect(result.systemTokens + result.userTokens).toBe(result.totalTokens);
  });
});
