/**
 * Difficulty Assessment Prompt Unit Tests
 * Phase 3.1: 교재 난이도 평가
 */

import { describe, it, expect, vi } from "vitest";
import {
  DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT,
  buildDifficultyAssessmentPrompt,
  parseDifficultyAssessmentResponse,
  estimateDifficultyPromptTokens,
  scoreToDifficultyLevel,
  scoreToDifficultyLabel,
  calculateDifficultyFit,
  applySubjectWeight,
  SUBJECT_DIFFICULTY_WEIGHTS,
  type DifficultyAssessmentRequest,
  type DifficultyAssessmentResult,
} from "@/lib/domains/plan/llm/prompts/difficultyAssessment";

// ============================================
// Mock estimateTokens
// ============================================

vi.mock("@/lib/domains/plan/llm/client", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

// ============================================
// Test Data
// ============================================

const sampleBookRequest: DifficultyAssessmentRequest = {
  contentType: "book",
  title: "수학의 정석 기본편",
  subject: "수학",
  subjectCategory: "수학",
  publisher: "성지출판",
  totalUnits: 520,
  curriculum: "2015",
  targetGrades: [1, 2],
};

const sampleLectureRequest: DifficultyAssessmentRequest = {
  contentType: "lecture",
  title: "현우진 뉴런 수학1",
  subject: "수학",
  publisher: "메가스터디",
  totalUnits: 48,
  toc: "1. 지수와 로그\n2. 지수함수와 로그함수\n3. 삼각함수",
};

const validAIResponse = JSON.stringify({
  overallScore: 3.5,
  confidence: 0.85,
  vocabularyComplexity: 3.2,
  conceptDensity: 4.0,
  prerequisiteDepth: 2,
  mathematicalComplexity: 3.8,
  estimatedHoursPerUnit: 0.5,
  recommendedPace: {
    beginner: "3 페이지/세션",
    intermediate: "5 페이지/세션",
    advanced: "8 페이지/세션",
  },
  prerequisiteConcepts: ["이차함수", "인수분해"],
  keyConceptsCovered: ["이차방정식의 근", "판별식", "근과 계수의 관계"],
  reasoning: "제목에 '정석'이 포함되어 있어 기본 개념서로 판단됩니다.",
});

// ============================================
// Tests
// ============================================

describe("DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT", () => {
  it("should contain evaluation criteria", () => {
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("어휘 복잡도");
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("개념 밀도");
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("선수지식 깊이");
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("수리적 복잡도");
  });

  it("should contain scoring guidelines", () => {
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("0-5");
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("1-5");
  });

  it("should request JSON response", () => {
    expect(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT).toContain("JSON");
  });
});

describe("buildDifficultyAssessmentPrompt", () => {
  describe("for books", () => {
    it("should include content type in Korean", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("교재");
    });

    it("should include title and subject", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain(sampleBookRequest.title);
      expect(prompt).toContain(sampleBookRequest.subject);
    });

    it("should include publisher", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("출판사");
      expect(prompt).toContain("성지출판");
    });

    it("should include total pages", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("520");
      expect(prompt).toContain("페이지");
    });

    it("should include curriculum revision", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("2015개정");
    });

    it("should include target grades", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("고1");
      expect(prompt).toContain("고2");
    });

    it("should include output format", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleBookRequest);
      expect(prompt).toContain("overallScore");
      expect(prompt).toContain("vocabularyComplexity");
    });
  });

  describe("for lectures", () => {
    it("should include content type in Korean", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleLectureRequest);
      expect(prompt).toContain("강의");
    });

    it("should use platform instead of publisher", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleLectureRequest);
      expect(prompt).toContain("플랫폼");
      expect(prompt).toContain("메가스터디");
    });

    it("should include total episodes", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleLectureRequest);
      expect(prompt).toContain("48");
      expect(prompt).toContain("강");
    });

    it("should include TOC when provided", () => {
      const prompt = buildDifficultyAssessmentPrompt(sampleLectureRequest);
      expect(prompt).toContain("지수와 로그");
      expect(prompt).toContain("삼각함수");
    });
  });

  describe("optional fields", () => {
    it("should handle missing optional fields", () => {
      const minimalRequest: DifficultyAssessmentRequest = {
        contentType: "book",
        title: "테스트 교재",
        subject: "수학",
      };

      const prompt = buildDifficultyAssessmentPrompt(minimalRequest);
      expect(prompt).toContain("테스트 교재");
      expect(prompt).not.toContain("출판사");
      expect(prompt).not.toContain("교육과정");
    });

    it("should include description when provided", () => {
      const requestWithDesc: DifficultyAssessmentRequest = {
        ...sampleBookRequest,
        description: "수학의 기초를 다루는 교재입니다.",
      };

      const prompt = buildDifficultyAssessmentPrompt(requestWithDesc);
      expect(prompt).toContain("설명");
      expect(prompt).toContain("수학의 기초를 다루는 교재입니다.");
    });
  });
});

describe("parseDifficultyAssessmentResponse", () => {
  it("should parse valid JSON response", () => {
    const result = parseDifficultyAssessmentResponse(validAIResponse);

    expect(result.overallScore).toBe(3.5);
    expect(result.confidence).toBe(0.85);
    expect(result.vocabularyComplexity).toBe(3.2);
    expect(result.conceptDensity).toBe(4.0);
    expect(result.prerequisiteDepth).toBe(2);
    expect(result.mathematicalComplexity).toBe(3.8);
  });

  it("should parse JSON wrapped in code block", () => {
    const wrappedResponse = "```json\n" + validAIResponse + "\n```";
    const result = parseDifficultyAssessmentResponse(wrappedResponse);

    expect(result.overallScore).toBe(3.5);
  });

  it("should parse recommendedPace", () => {
    const result = parseDifficultyAssessmentResponse(validAIResponse);

    expect(result.recommendedPace.beginner).toBe("3 페이지/세션");
    expect(result.recommendedPace.intermediate).toBe("5 페이지/세션");
    expect(result.recommendedPace.advanced).toBe("8 페이지/세션");
  });

  it("should parse concept arrays", () => {
    const result = parseDifficultyAssessmentResponse(validAIResponse);

    expect(result.prerequisiteConcepts).toContain("이차함수");
    expect(result.prerequisiteConcepts).toContain("인수분해");
    expect(result.keyConceptsCovered).toContain("판별식");
  });

  it("should include reasoning", () => {
    const result = parseDifficultyAssessmentResponse(validAIResponse);

    expect(result.reasoning).toContain("정석");
  });

  it("should clamp out-of-range values", () => {
    const invalidResponse = JSON.stringify({
      overallScore: 10, // should be clamped to 5
      confidence: 1.5, // should be clamped to 1
      vocabularyComplexity: -1, // should be clamped to 0
      conceptDensity: 3,
      prerequisiteDepth: 0, // should be clamped to 1
      mathematicalComplexity: 6, // should be clamped to 5
      estimatedHoursPerUnit: -1, // should be 0
    });

    const result = parseDifficultyAssessmentResponse(invalidResponse);

    expect(result.overallScore).toBe(5);
    expect(result.confidence).toBe(1);
    expect(result.vocabularyComplexity).toBe(0);
    expect(result.prerequisiteDepth).toBe(1);
    expect(result.mathematicalComplexity).toBe(5);
    expect(result.estimatedHoursPerUnit).toBe(0);
  });

  it("should provide default recommendedPace if missing", () => {
    const responseWithoutPace = JSON.stringify({
      overallScore: 3,
      confidence: 0.8,
      vocabularyComplexity: 3,
      conceptDensity: 3,
      prerequisiteDepth: 2,
      mathematicalComplexity: 3,
      estimatedHoursPerUnit: 0.5,
    });

    const result = parseDifficultyAssessmentResponse(responseWithoutPace);

    expect(result.recommendedPace.beginner).toBeDefined();
    expect(result.recommendedPace.intermediate).toBeDefined();
    expect(result.recommendedPace.advanced).toBeDefined();
  });

  it("should throw on invalid JSON", () => {
    expect(() => {
      parseDifficultyAssessmentResponse("not valid json");
    }).toThrow();
  });

  it("should throw on missing required fields", () => {
    const incompleteResponse = JSON.stringify({
      overallScore: 3,
      // missing other required fields
    });

    expect(() => {
      parseDifficultyAssessmentResponse(incompleteResponse);
    }).toThrow("does not match expected schema");
  });
});

describe("estimateDifficultyPromptTokens", () => {
  it("should return positive token count", () => {
    const tokens = estimateDifficultyPromptTokens(sampleBookRequest);
    expect(tokens).toBeGreaterThan(0);
  });

  it("should include system prompt tokens", () => {
    const minimalRequest: DifficultyAssessmentRequest = {
      contentType: "book",
      title: "테스트",
      subject: "수학",
    };

    const tokensMinimal = estimateDifficultyPromptTokens(minimalRequest);
    const tokensFull = estimateDifficultyPromptTokens(sampleBookRequest);

    expect(tokensFull).toBeGreaterThan(tokensMinimal);
  });
});

describe("scoreToDifficultyLevel", () => {
  it("should return 'easy' for scores < 2", () => {
    expect(scoreToDifficultyLevel(0)).toBe("easy");
    expect(scoreToDifficultyLevel(1)).toBe("easy");
    expect(scoreToDifficultyLevel(1.9)).toBe("easy");
  });

  it("should return 'medium' for scores 2-3.5", () => {
    expect(scoreToDifficultyLevel(2)).toBe("medium");
    expect(scoreToDifficultyLevel(2.5)).toBe("medium");
    expect(scoreToDifficultyLevel(3.4)).toBe("medium");
  });

  it("should return 'hard' for scores >= 3.5", () => {
    expect(scoreToDifficultyLevel(3.5)).toBe("hard");
    expect(scoreToDifficultyLevel(4)).toBe("hard");
    expect(scoreToDifficultyLevel(5)).toBe("hard");
  });
});

describe("scoreToDifficultyLabel", () => {
  it("should return Korean labels", () => {
    expect(scoreToDifficultyLabel(0.5)).toBe("매우 쉬움");
    expect(scoreToDifficultyLabel(1.5)).toBe("쉬움");
    expect(scoreToDifficultyLabel(2.5)).toBe("보통");
    expect(scoreToDifficultyLabel(3.5)).toBe("어려움");
    expect(scoreToDifficultyLabel(4.5)).toBe("매우 어려움");
  });
});

describe("calculateDifficultyFit", () => {
  it("should return 'too_easy' when content is much easier", () => {
    expect(calculateDifficultyFit(4, 2)).toBe("too_easy");
  });

  it("should return 'appropriate' when levels match", () => {
    expect(calculateDifficultyFit(3, 3)).toBe("appropriate");
    expect(calculateDifficultyFit(3, 3.4)).toBe("appropriate");
  });

  it("should return 'challenging' when content is slightly harder", () => {
    expect(calculateDifficultyFit(3, 4)).toBe("challenging");
  });

  it("should return 'too_hard' when content is much harder", () => {
    expect(calculateDifficultyFit(2, 4)).toBe("too_hard");
  });
});

describe("applySubjectWeight", () => {
  it("should increase score for math subjects", () => {
    const baseScore = 3;
    const weightedScore = applySubjectWeight(baseScore, "수학");

    expect(weightedScore).toBeGreaterThan(baseScore);
    expect(weightedScore).toBe(3 * 1.1);
  });

  it("should decrease score for easier subjects", () => {
    const baseScore = 3;
    const weightedScore = applySubjectWeight(baseScore, "한국사");

    expect(weightedScore).toBeLessThan(baseScore);
    expect(weightedScore).toBe(3 * 0.95);
  });

  it("should use weight 1.0 for unknown subjects", () => {
    const baseScore = 3;
    const weightedScore = applySubjectWeight(baseScore, "알 수 없는 과목");

    expect(weightedScore).toBe(baseScore);
  });

  it("should clamp result to 0-5 range", () => {
    const highScore = 5;
    const weightedScore = applySubjectWeight(highScore, "미적분");

    expect(weightedScore).toBe(5); // clamped at 5
  });
});

describe("SUBJECT_DIFFICULTY_WEIGHTS", () => {
  it("should have weights for major subjects", () => {
    expect(SUBJECT_DIFFICULTY_WEIGHTS["수학"]).toBeDefined();
    expect(SUBJECT_DIFFICULTY_WEIGHTS["물리학"]).toBeDefined();
    expect(SUBJECT_DIFFICULTY_WEIGHTS["국어"]).toBeDefined();
    expect(SUBJECT_DIFFICULTY_WEIGHTS["영어"]).toBeDefined();
  });

  it("should have math subjects weighted higher", () => {
    expect(SUBJECT_DIFFICULTY_WEIGHTS["미적분"]).toBeGreaterThan(1);
    expect(SUBJECT_DIFFICULTY_WEIGHTS["기하"]).toBeGreaterThan(1);
  });

  it("should have social subjects weighted lower or equal", () => {
    expect(SUBJECT_DIFFICULTY_WEIGHTS["한국사"]).toBeLessThan(1);
    expect(SUBJECT_DIFFICULTY_WEIGHTS["사회문화"]).toBeLessThan(1);
  });
});
