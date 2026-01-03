/**
 * Enhanced Plan Validator Tests
 * Phase 6: Quality Improvement and Integration
 *
 * Tests the enhanced validation features added in Phase 6
 */

import { describe, it, expect } from "vitest";
import {
  validatePlansEnhanced,
  validateContentRanges,
  validateRangeContinuity,
  validateSubjectBalance,
  validateConsecutiveSubjects,
  validateLearningGaps,
  validateContentDuplicates,
  validateDailyLoad,
  getQualityGrade,
  getGradeDescription,
  type ContentMetadata,
} from "@/lib/domains/plan/llm/validators/enhancedPlanValidator";
import { createMockPlan } from "../__mocks__/planValidation";

// ============================================
// Test Helpers
// ============================================

function createMockContent(
  options: Partial<ContentMetadata> = {}
): ContentMetadata {
  return {
    id: "content-1",
    contentType: "book",
    totalPages: 200,
    difficulty: "medium",
    ...options,
  };
}

// ============================================
// validateContentRanges Tests
// ============================================

describe("validateContentRanges", () => {
  it("should pass when range is within content limits", () => {
    const plans = [
      createMockPlan({
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 50,
      }),
    ];
    const contents = [createMockContent({ id: "content-1", totalPages: 200 })];

    const issues = validateContentRanges(plans, contents);

    expect(issues).toHaveLength(0);
  });

  it("should detect when rangeEnd exceeds totalPages", () => {
    const plans = [
      createMockPlan({
        contentId: "content-1",
        rangeStart: 180,
        rangeEnd: 250,
        contentTitle: "수학의 정석",
      }),
    ];
    const contents = [createMockContent({ id: "content-1", totalPages: 200 })];

    const issues = validateContentRanges(plans, contents);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("range_overflow");
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("250");
    expect(issues[0].message).toContain("200");
  });

  it("should detect when rangeStart > rangeEnd", () => {
    const plans = [
      createMockPlan({
        contentId: "content-1",
        rangeStart: 50,
        rangeEnd: 30,
        contentTitle: "영어 문법",
      }),
    ];
    const contents = [createMockContent({ id: "content-1" })];

    const issues = validateContentRanges(plans, contents);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("range_overflow");
    expect(issues[0].message).toContain("시작 범위");
  });

  it("should work with lecture content type", () => {
    const plans = [
      createMockPlan({
        contentId: "lecture-1",
        rangeStart: 1,
        rangeEnd: 60,
        contentTitle: "물리 강의",
      }),
    ];
    const contents = [
      createMockContent({
        id: "lecture-1",
        contentType: "lecture",
        totalPages: undefined,
        totalLectures: 48,
      }),
    ];

    const issues = validateContentRanges(plans, contents);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("range_overflow");
  });

  it("should skip validation for content not in metadata", () => {
    const plans = [
      createMockPlan({
        contentId: "unknown-content",
        rangeStart: 1,
        rangeEnd: 1000,
      }),
    ];
    const contents: ContentMetadata[] = [];

    const issues = validateContentRanges(plans, contents);

    expect(issues).toHaveLength(0);
  });
});

// ============================================
// validateRangeContinuity Tests
// ============================================

describe("validateRangeContinuity", () => {
  it("should pass for continuous ranges", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 20,
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        rangeStart: 21,
        rangeEnd: 40,
      }),
      createMockPlan({
        date: "2026-01-07",
        contentId: "content-1",
        rangeStart: 41,
        rangeEnd: 60,
      }),
    ];

    const issues = validateRangeContinuity(plans);

    expect(issues).toHaveLength(0);
  });

  it("should detect overlapping ranges", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 30,
        contentTitle: "수학 교재",
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        rangeStart: 25,
        rangeEnd: 50,
        contentTitle: "수학 교재",
      }),
    ];

    const issues = validateRangeContinuity(plans);

    expect(issues.some((i) => i.type === "range_overlap")).toBe(true);
  });

  it("should detect large gaps in ranges", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 20,
        contentTitle: "영어 교재",
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        rangeStart: 50,
        rangeEnd: 70,
        contentTitle: "영어 교재",
      }),
    ];

    const issues = validateRangeContinuity(plans);

    expect(issues.some((i) => i.type === "range_gap")).toBe(true);
  });

  it("should handle multiple contents separately", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 20,
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-2",
        rangeStart: 1,
        rangeEnd: 20,
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        rangeStart: 21,
        rangeEnd: 40,
      }),
    ];

    const issues = validateRangeContinuity(plans);

    expect(issues).toHaveLength(0);
  });
});

// ============================================
// validateSubjectBalance Tests
// ============================================

describe("validateSubjectBalance", () => {
  it("should calculate correct distribution", () => {
    const plans = [
      createMockPlan({
        subject: "수학",
        estimatedMinutes: 60,
      }),
      createMockPlan({
        subject: "영어",
        estimatedMinutes: 60,
        contentId: "content-2",
      }),
      createMockPlan({
        subject: "국어",
        estimatedMinutes: 60,
        contentId: "content-3",
      }),
    ];

    const { issues, distribution } = validateSubjectBalance(plans);

    expect(distribution).toHaveLength(3);
    expect(distribution.every((d) => Math.abs(d.percentage - 33.33) < 1)).toBe(
      true
    );
    expect(issues).toHaveLength(0);
  });

  it("should warn when one subject dominates", () => {
    const plans = [
      createMockPlan({
        subject: "수학",
        estimatedMinutes: 200,
      }),
      createMockPlan({
        subject: "영어",
        estimatedMinutes: 50,
        contentId: "content-2",
      }),
    ];

    const { issues } = validateSubjectBalance(plans);

    expect(issues.some((i) => i.type === "subject_imbalance")).toBe(true);
    expect(issues[0].message).toContain("수학");
  });

  it("should provide info for single-subject plans", () => {
    const plans = Array.from({ length: 6 }, (_, i) =>
      createMockPlan({
        subject: "수학",
        contentId: `content-${i}`,
      })
    );

    const { issues, distribution } = validateSubjectBalance(plans);

    expect(distribution).toHaveLength(1);
    expect(issues.some((i) => i.severity === "info")).toBe(true);
  });
});

// ============================================
// validateConsecutiveSubjects Tests
// ============================================

describe("validateConsecutiveSubjects", () => {
  it("should pass when subjects are distributed", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05", subject: "수학" }),
      createMockPlan({ date: "2026-01-06", subject: "영어" }),
      createMockPlan({ date: "2026-01-07", subject: "수학" }),
      createMockPlan({ date: "2026-01-08", subject: "국어" }),
    ];

    const issues = validateConsecutiveSubjects(plans);

    expect(issues).toHaveLength(0);
  });

  it("should warn when subject appears more than maxConsecutive days", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05", subject: "수학" }),
      createMockPlan({ date: "2026-01-06", subject: "수학" }),
      createMockPlan({ date: "2026-01-07", subject: "수학" }),
      createMockPlan({ date: "2026-01-08", subject: "수학" }),
      createMockPlan({ date: "2026-01-09", subject: "수학" }),
    ];

    const issues = validateConsecutiveSubjects(plans, 3);

    expect(issues.some((i) => i.type === "load_warning")).toBe(true);
    expect(issues[0].message).toContain("연속");
  });

  it("should respect custom maxConsecutive setting", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05", subject: "수학" }),
      createMockPlan({ date: "2026-01-06", subject: "수학" }),
      createMockPlan({ date: "2026-01-07", subject: "수학" }),
    ];

    const issuesStrict = validateConsecutiveSubjects(plans, 2);
    const issuesRelaxed = validateConsecutiveSubjects(plans, 5);

    expect(issuesStrict.length).toBeGreaterThan(0);
    expect(issuesRelaxed).toHaveLength(0);
  });
});

// ============================================
// validateLearningGaps Tests
// ============================================

describe("validateLearningGaps", () => {
  it("should pass for consecutive days", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05" }),
      createMockPlan({ date: "2026-01-06" }),
      createMockPlan({ date: "2026-01-07" }),
    ];

    const issues = validateLearningGaps(plans);

    expect(issues).toHaveLength(0);
  });

  it("should warn for gaps exceeding maxGapDays", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05" }),
      createMockPlan({ date: "2026-01-20" }), // 15 day gap
    ];

    const issues = validateLearningGaps(plans, 7);

    expect(issues.some((i) => i.type === "gap_too_long")).toBe(true);
    expect(issues[0].message).toContain("15일");
  });

  it("should not warn for acceptable gaps", () => {
    const plans = [
      createMockPlan({ date: "2026-01-05" }),
      createMockPlan({ date: "2026-01-10" }), // 5 day gap
    ];

    const issues = validateLearningGaps(plans, 7);

    expect(issues).toHaveLength(0);
  });
});

// ============================================
// validateContentDuplicates Tests
// ============================================

describe("validateContentDuplicates", () => {
  it("should pass for unique content per day", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-2",
      }),
    ];

    const issues = validateContentDuplicates(plans);

    expect(issues).toHaveLength(0);
  });

  it("should warn for duplicate content on same day", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        contentTitle: "수학의 정석",
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        contentTitle: "수학의 정석",
      }),
    ];

    const issues = validateContentDuplicates(plans);

    expect(issues.some((i) => i.type === "content_duplicate")).toBe(true);
    expect(issues[0].message).toContain("2번");
  });

  it("should allow review duplicates", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        isReview: false,
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        isReview: true, // 복습은 중복 허용
      }),
    ];

    const issues = validateContentDuplicates(plans);

    expect(issues).toHaveLength(0);
  });
});

// ============================================
// validateDailyLoad Tests
// ============================================

describe("validateDailyLoad", () => {
  it("should pass for normal load", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        estimatedMinutes: 60,
      }),
      createMockPlan({
        date: "2026-01-05",
        estimatedMinutes: 60,
        contentId: "content-2",
      }),
    ];

    const issues = validateDailyLoad(plans, 180);

    expect(issues).toHaveLength(0);
  });

  it("should warn for excessive daily load", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        estimatedMinutes: 150,
      }),
      createMockPlan({
        date: "2026-01-05",
        estimatedMinutes: 150,
        contentId: "content-2",
      }),
    ];

    const issues = validateDailyLoad(plans, 180); // 300 > 180 * 1.5 = 270

    expect(issues.some((i) => i.type === "load_warning")).toBe(true);
  });

  it("should provide info for very light days", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        estimatedMinutes: 30,
      }),
    ];

    const issues = validateDailyLoad(plans, 180); // 30 < 180 * 0.3 = 54

    expect(issues.some((i) => i.severity === "info")).toBe(true);
  });
});

// ============================================
// validatePlansEnhanced (Integration) Tests
// ============================================

describe("validatePlansEnhanced", () => {
  it("should return valid result for good plans", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        subject: "수학",
        estimatedMinutes: 60,
        rangeStart: 1,
        rangeEnd: 20,
      }),
      createMockPlan({
        date: "2026-01-06",
        subject: "영어",
        estimatedMinutes: 60,
        contentId: "content-2",
      }),
      createMockPlan({
        date: "2026-01-07",
        subject: "국어",
        estimatedMinutes: 60,
        contentId: "content-3",
      }),
    ];

    const result = validatePlansEnhanced({
      plans,
      dailyStudyMinutes: 120,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errorCount).toBe(0);
    expect(result.metrics.overallScore).toBeGreaterThan(50);
  });

  it("should detect multiple issues", () => {
    const plans = [
      // 범위 초과
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        rangeStart: 1,
        rangeEnd: 300,
        contentTitle: "수학 교재",
      }),
      // 같은 날 중복
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        contentTitle: "수학 교재",
      }),
      // 큰 공백
      createMockPlan({
        date: "2026-01-20",
        subject: "영어",
        contentId: "content-2",
      }),
    ];

    const contents = [
      createMockContent({ id: "content-1", totalPages: 200 }),
    ];

    const result = validatePlansEnhanced({
      plans,
      contents,
      dailyStudyMinutes: 120,
    });

    expect(result.valid).toBe(false);
    expect(result.summary.errorCount).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(2);
  });

  it("should calculate quality metrics", () => {
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        subject: "수학",
        estimatedMinutes: 60,
      }),
      createMockPlan({
        date: "2026-01-06",
        subject: "영어",
        estimatedMinutes: 60,
        contentId: "content-2",
      }),
    ];

    const result = validatePlansEnhanced({
      plans,
      dailyStudyMinutes: 120,
    });

    expect(result.metrics.overallScore).toBeDefined();
    expect(result.metrics.rangeScore).toBeDefined();
    expect(result.metrics.balanceScore).toBeDefined();
    expect(result.metrics.loadScore).toBeDefined();
    expect(result.metrics.continuityScore).toBeDefined();
  });

  it("should include subject distribution", () => {
    const plans = [
      createMockPlan({
        subject: "수학",
        subjectCategory: "수학",
        estimatedMinutes: 120,
      }),
      createMockPlan({
        subject: "영어",
        subjectCategory: "영어",
        estimatedMinutes: 60,
        contentId: "content-2",
      }),
    ];

    const result = validatePlansEnhanced({ plans });

    expect(result.distribution).toHaveLength(2);
    expect(result.distribution.find((d) => d.subject === "수학")?.percentage).toBeCloseTo(
      66.67,
      0
    );
  });
});

// ============================================
// Quality Grade Tests
// ============================================

describe("getQualityGrade", () => {
  it("should return A for score >= 90", () => {
    expect(getQualityGrade(95)).toBe("A");
    expect(getQualityGrade(90)).toBe("A");
  });

  it("should return B for score 80-89", () => {
    expect(getQualityGrade(85)).toBe("B");
    expect(getQualityGrade(80)).toBe("B");
  });

  it("should return C for score 70-79", () => {
    expect(getQualityGrade(75)).toBe("C");
    expect(getQualityGrade(70)).toBe("C");
  });

  it("should return D for score 60-69", () => {
    expect(getQualityGrade(65)).toBe("D");
    expect(getQualityGrade(60)).toBe("D");
  });

  it("should return F for score < 60", () => {
    expect(getQualityGrade(50)).toBe("F");
    expect(getQualityGrade(0)).toBe("F");
  });
});

describe("getGradeDescription", () => {
  it("should return descriptions for each grade", () => {
    expect(getGradeDescription("A")).toContain("우수");
    expect(getGradeDescription("B")).toContain("양호");
    expect(getGradeDescription("C")).toContain("보통");
    expect(getGradeDescription("D")).toContain("개선");
    expect(getGradeDescription("F")).toContain("심각");
  });
});
