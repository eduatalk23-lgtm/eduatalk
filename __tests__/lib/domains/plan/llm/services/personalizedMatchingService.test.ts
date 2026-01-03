/**
 * Personalized Matching Service Unit Tests
 * Phase 3.3: 맞춤형 콘텐츠 매칭 시스템
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PersonalizedMatchingService,
  findMatchingContent,
  analyzeContentFit,
  findWeaknessFillers,
  findGapFillers,
  getStudentProfile,
  MATCH_FACTOR_WEIGHTS,
  type StudentProfile,
  type ContentCandidate,
} from "@/lib/domains/plan/llm/services/personalizedMatchingService";

// ============================================
// Mocks
// ============================================

// Create a chainable mock
const createChainableMock = (data: unknown = null, error: unknown = null) => {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data, error }).then(resolve),
  };

  const returnChain = () => chain;

  chain.select = vi.fn(returnChain);
  chain.eq = vi.fn(returnChain);
  chain.in = vi.fn(returnChain);
  chain.not = vi.fn(returnChain);
  chain.order = vi.fn(returnChain);
  chain.limit = vi.fn(() => Promise.resolve({ data, error }));
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.gte = vi.fn(returnChain);
  chain.lte = vi.fn(returnChain);

  return chain;
};

let mockFromReturn = createChainableMock();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => mockFromReturn),
    })
  ),
}));

// Mock PrerequisiteService
vi.mock("@/lib/domains/plan/llm/services/prerequisiteService", () => ({
  PrerequisiteService: class MockPrerequisiteService {
    constructor() {}
    async identifyGaps() {
      return [];
    }
    async recommendGapFillers() {
      return [];
    }
  },
}));

// Mock ContentDifficultyService
vi.mock("@/lib/domains/plan/llm/services/contentDifficultyService", () => ({
  ContentDifficultyService: class MockContentDifficultyService {
    constructor() {}
    async getAnalysis() {
      return null;
    }
  },
}));

// ============================================
// Test Data
// ============================================

const mockStudent: StudentProfile = {
  id: "student-1",
  currentLevel: 3,
  weakSubjects: ["수학"],
  strongSubjects: ["영어"],
  averageStudyPace: 10,
  recentInterests: ["수학", "국어"],
  completedContentIds: ["book-old"],
  learningVelocity: 1.0,
};

const mockContentCandidate: ContentCandidate = {
  id: "book-1",
  type: "book",
  title: "수학의 정석",
  subject: "수학",
  subjectCategory: "수학",
  difficultyLevel: 3,
  totalUnits: 500,
  estimatedHours: 50,
  publishedAt: new Date().toISOString(),
  completionRate: 0.8,
};

// ============================================
// Tests
// ============================================

describe("PersonalizedMatchingService", () => {
  let service: PersonalizedMatchingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PersonalizedMatchingService("tenant-1");
    mockFromReturn = createChainableMock();
  });

  describe("Service Structure", () => {
    it("should have findMatchingContent method", () => {
      expect(typeof service.findMatchingContent).toBe("function");
    });

    it("should have analyzeContentFit method", () => {
      expect(typeof service.analyzeContentFit).toBe("function");
    });

    it("should have findWeaknessFillers method", () => {
      expect(typeof service.findWeaknessFillers).toBe("function");
    });

    it("should have findGapFillers method", () => {
      expect(typeof service.findGapFillers).toBe("function");
    });

    it("should have buildStudentProfile method", () => {
      expect(typeof service.buildStudentProfile).toBe("function");
    });
  });

  describe("Static Utilities", () => {
    describe("scoreToGrade", () => {
      it("should return A for scores >= 85", () => {
        expect(PersonalizedMatchingService.scoreToGrade(85)).toBe("A");
        expect(PersonalizedMatchingService.scoreToGrade(100)).toBe("A");
        expect(PersonalizedMatchingService.scoreToGrade(90)).toBe("A");
      });

      it("should return B for scores 70-84", () => {
        expect(PersonalizedMatchingService.scoreToGrade(70)).toBe("B");
        expect(PersonalizedMatchingService.scoreToGrade(84)).toBe("B");
        expect(PersonalizedMatchingService.scoreToGrade(77)).toBe("B");
      });

      it("should return C for scores 55-69", () => {
        expect(PersonalizedMatchingService.scoreToGrade(55)).toBe("C");
        expect(PersonalizedMatchingService.scoreToGrade(69)).toBe("C");
        expect(PersonalizedMatchingService.scoreToGrade(60)).toBe("C");
      });

      it("should return D for scores 40-54", () => {
        expect(PersonalizedMatchingService.scoreToGrade(40)).toBe("D");
        expect(PersonalizedMatchingService.scoreToGrade(54)).toBe("D");
        expect(PersonalizedMatchingService.scoreToGrade(45)).toBe("D");
      });

      it("should return F for scores < 40", () => {
        expect(PersonalizedMatchingService.scoreToGrade(39)).toBe("F");
        expect(PersonalizedMatchingService.scoreToGrade(0)).toBe("F");
        expect(PersonalizedMatchingService.scoreToGrade(20)).toBe("F");
      });
    });

    describe("gradeDescription", () => {
      it("should return descriptions for each grade", () => {
        expect(PersonalizedMatchingService.gradeDescription("A")).toContain("매우 적합");
        expect(PersonalizedMatchingService.gradeDescription("B")).toContain("적합");
        expect(PersonalizedMatchingService.gradeDescription("C")).toContain("보통");
        expect(PersonalizedMatchingService.gradeDescription("D")).toContain("맞지 않을");
        expect(PersonalizedMatchingService.gradeDescription("F")).toContain("적합하지 않은");
      });
    });

    describe("difficultyFitLabel", () => {
      it("should return Korean labels for difficulty fits", () => {
        expect(PersonalizedMatchingService.difficultyFitLabel("too_easy")).toBe("너무 쉬움");
        expect(PersonalizedMatchingService.difficultyFitLabel("appropriate")).toBe("적정");
        expect(PersonalizedMatchingService.difficultyFitLabel("challenging")).toBe("도전적");
        expect(PersonalizedMatchingService.difficultyFitLabel("too_hard")).toBe("너무 어려움");
      });
    });
  });
});

describe("MATCH_FACTOR_WEIGHTS", () => {
  it("should have all required factors", () => {
    expect(MATCH_FACTOR_WEIGHTS.difficultyAlignment).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.weakSubjectTarget).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.paceAlignment).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.prerequisiteMet).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.recentInterest).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.peerSuccess).toBeDefined();
    expect(MATCH_FACTOR_WEIGHTS.freshness).toBeDefined();
  });

  it("should sum to 100", () => {
    const total = Object.values(MATCH_FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
  });

  it("should have difficulty alignment as highest weight", () => {
    const maxWeight = Math.max(...Object.values(MATCH_FACTOR_WEIGHTS));
    expect(MATCH_FACTOR_WEIGHTS.difficultyAlignment).toBe(maxWeight);
  });

  it("should have weak subject target as second highest weight", () => {
    const weights = Object.values(MATCH_FACTOR_WEIGHTS).sort((a, b) => b - a);
    expect(MATCH_FACTOR_WEIGHTS.weakSubjectTarget).toBe(weights[1]);
  });

  it("should have freshness as lowest weight", () => {
    const minWeight = Math.min(...Object.values(MATCH_FACTOR_WEIGHTS));
    expect(MATCH_FACTOR_WEIGHTS.freshness).toBe(minWeight);
  });

  it("should have weights between 5 and 25", () => {
    for (const weight of Object.values(MATCH_FACTOR_WEIGHTS)) {
      expect(weight).toBeGreaterThanOrEqual(5);
      expect(weight).toBeLessThanOrEqual(25);
    }
  });
});

describe("Convenience Functions", () => {
  it("findMatchingContent should be a function", () => {
    expect(typeof findMatchingContent).toBe("function");
  });

  it("analyzeContentFit should be a function", () => {
    expect(typeof analyzeContentFit).toBe("function");
  });

  it("findWeaknessFillers should be a function", () => {
    expect(typeof findWeaknessFillers).toBe("function");
  });

  it("findGapFillers should be a function", () => {
    expect(typeof findGapFillers).toBe("function");
  });

  it("getStudentProfile should be a function", () => {
    expect(typeof getStudentProfile).toBe("function");
  });
});

describe("Type Exports", () => {
  it("should export StudentProfile type correctly", () => {
    const profile: StudentProfile = {
      id: "test",
      currentLevel: 3,
      weakSubjects: [],
      strongSubjects: [],
      averageStudyPace: 10,
      recentInterests: [],
      completedContentIds: [],
      learningVelocity: 1.0,
    };
    expect(profile.id).toBe("test");
  });

  it("should export ContentCandidate type correctly", () => {
    const candidate: ContentCandidate = {
      id: "test",
      type: "book",
      title: "Test",
      subject: "수학",
      subjectCategory: "수학",
      difficultyLevel: 3,
      totalUnits: 100,
      estimatedHours: 10,
    };
    expect(candidate.type).toBe("book");
  });
});
