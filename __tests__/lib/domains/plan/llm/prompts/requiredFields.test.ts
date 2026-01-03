/**
 * Prompt Required Fields Tests
 * Phase 2: Verify required output fields are present in prompts
 *
 * Tests that SYSTEM_PROMPT and formatters include all necessary
 * fields for proper AI response structure
 */

import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/domains/plan/llm/prompts/planGeneration";

// ============================================
// SYSTEM_PROMPT Required Fields Tests
// ============================================

describe("SYSTEM_PROMPT required output fields", () => {
  describe("Required fields section", () => {
    it("should contain 'REQUIRED' section marker", () => {
      expect(SYSTEM_PROMPT).toContain("필수 출력 필드 (REQUIRED)");
    });

    it("should require contentType field", () => {
      expect(SYSTEM_PROMPT).toContain("contentType");
      expect(SYSTEM_PROMPT).toMatch(/contentType.*book.*lecture.*custom/s);
    });

    it("should require blockIndex field", () => {
      expect(SYSTEM_PROMPT).toContain("blockIndex");
      expect(SYSTEM_PROMPT).toMatch(/blockIndex.*0, 1, 2/s);
    });

    it("should require subjectType field", () => {
      expect(SYSTEM_PROMPT).toContain("subjectType");
      expect(SYSTEM_PROMPT).toMatch(/subjectType.*strategy.*weakness.*null/s);
    });
  });

  describe("JSON output format", () => {
    it("should include weeklyMatrices structure", () => {
      expect(SYSTEM_PROMPT).toContain('"weeklyMatrices"');
    });

    it("should include plans array in output format", () => {
      expect(SYSTEM_PROMPT).toContain('"plans"');
    });

    it("should include date field specification", () => {
      expect(SYSTEM_PROMPT).toContain('"date"');
      expect(SYSTEM_PROMPT).toContain("YYYY-MM-DD");
    });

    it("should include time format specification", () => {
      expect(SYSTEM_PROMPT).toContain('"startTime"');
      expect(SYSTEM_PROMPT).toContain('"endTime"');
      expect(SYSTEM_PROMPT).toContain("HH:mm");
    });

    it("should include dayOfWeek specification", () => {
      expect(SYSTEM_PROMPT).toContain('"dayOfWeek"');
      expect(SYSTEM_PROMPT).toContain("0=일요일, 6=토요일");
    });
  });

  describe("Core plan fields in output format", () => {
    it("should include contentId", () => {
      expect(SYSTEM_PROMPT).toContain('"contentId"');
    });

    it("should include contentTitle", () => {
      expect(SYSTEM_PROMPT).toContain('"contentTitle"');
    });

    it("should include subject", () => {
      expect(SYSTEM_PROMPT).toContain('"subject"');
    });

    it("should include rangeStart and rangeEnd", () => {
      expect(SYSTEM_PROMPT).toContain('"rangeStart"');
      expect(SYSTEM_PROMPT).toContain('"rangeEnd"');
    });

    it("should include estimatedMinutes", () => {
      expect(SYSTEM_PROMPT).toContain('"estimatedMinutes"');
    });

    it("should include isReview", () => {
      expect(SYSTEM_PROMPT).toContain('"isReview"');
    });

    it("should include priority", () => {
      expect(SYSTEM_PROMPT).toContain('"priority"');
      expect(SYSTEM_PROMPT).toMatch(/priority.*high.*medium.*low/s);
    });
  });

  describe("Academy schedule rules", () => {
    it("should contain CRITICAL marker for academy rules", () => {
      expect(SYSTEM_PROMPT).toContain("학원 일정 규칙 (CRITICAL)");
    });

    it("should mention travel time handling", () => {
      expect(SYSTEM_PROMPT).toContain("travelTime");
      expect(SYSTEM_PROMPT).toContain("이동 시간");
    });

    it("should specify academy time exclusion", () => {
      expect(SYSTEM_PROMPT).toMatch(/학원 시간.*절대.*학습 플랜 배치 금지/s);
    });
  });

  describe("Block rules", () => {
    it("should mention block information usage", () => {
      expect(SYSTEM_PROMPT).toContain("시간 블록 규칙");
      expect(SYSTEM_PROMPT).toContain("blockIndex");
    });

    it("should specify block-plan relationship", () => {
      expect(SYSTEM_PROMPT).toMatch(/블록 시간 범위 내에 배치/s);
    });
  });

  describe("Subject allocation rules", () => {
    it("should explain strategy subject placement", () => {
      expect(SYSTEM_PROMPT).toContain("strategy (전략 과목)");
      expect(SYSTEM_PROMPT).toMatch(/strategy.*오후|저녁/s);
    });

    it("should explain weakness subject placement", () => {
      expect(SYSTEM_PROMPT).toContain("weakness (취약 과목)");
      expect(SYSTEM_PROMPT).toMatch(/weakness.*오전/s);
    });
  });

  describe("Exclusion rules", () => {
    it("should mention excludeDays", () => {
      expect(SYSTEM_PROMPT).toContain("excludeDays");
    });

    it("should mention excludeDates", () => {
      expect(SYSTEM_PROMPT).toContain("excludeDates");
    });
  });
});

// ============================================
// Few-shot Examples Tests
// ============================================

describe("Few-shot examples required fields", () => {
  // Helper to extract example JSON block (handles escaped backticks)
  function getExampleBlock(exampleNumber: number): string | null {
    // The SYSTEM_PROMPT uses escaped backticks in template literal: \`\`\`json
    // At runtime, this becomes: ```json
    const pattern = new RegExp(`예시 ${exampleNumber}[\\s\\S]*?\`\`\`json([\\s\\S]*?)\`\`\``);
    const match = SYSTEM_PROMPT.match(pattern);
    return match ? match[1] : null;
  }

  describe("Example 1: Weakness subject focus", () => {
    it("should include contentType in example 1", () => {
      const example = getExampleBlock(1);
      expect(example).not.toBeNull();
      expect(example).toContain('"contentType"');
    });

    it("should include blockIndex in example 1", () => {
      const example = getExampleBlock(1);
      expect(example).not.toBeNull();
      expect(example).toContain('"blockIndex"');
    });

    it("should include subjectType in example 1", () => {
      const example = getExampleBlock(1);
      expect(example).not.toBeNull();
      expect(example).toContain('"subjectType"');
    });
  });

  describe("Example 2: Exam D-7", () => {
    it("should include contentType in example 2", () => {
      const example = getExampleBlock(2);
      expect(example).not.toBeNull();
      expect(example).toContain('"contentType"');
    });

    it("should include blockIndex in example 2", () => {
      const example = getExampleBlock(2);
      expect(example).not.toBeNull();
      expect(example).toContain('"blockIndex"');
    });

    it("should include subjectType in example 2", () => {
      const example = getExampleBlock(2);
      expect(example).not.toBeNull();
      expect(example).toContain('"subjectType"');
    });
  });

  describe("Example 3: Visual learner", () => {
    it("should include contentType in example 3", () => {
      const example = getExampleBlock(3);
      expect(example).not.toBeNull();
      expect(example).toContain('"contentType"');
    });

    it("should include blockIndex in example 3", () => {
      const example = getExampleBlock(3);
      expect(example).not.toBeNull();
      expect(example).toContain('"blockIndex"');
    });

    it("should include subjectType in example 3", () => {
      const example = getExampleBlock(3);
      expect(example).not.toBeNull();
      expect(example).toContain('"subjectType"');
    });
  });
});

// ============================================
// Output Format Schema Tests
// ============================================

describe("Output format schema", () => {
  it("should include JSON code block markers", () => {
    expect(SYSTEM_PROMPT).toContain("```json");
    expect(SYSTEM_PROMPT).toContain("```");
  });

  it("should specify pure JSON output requirement", () => {
    expect(SYSTEM_PROMPT).toMatch(/순수 JSON만 출력/s);
  });

  it("should include recommendations structure", () => {
    expect(SYSTEM_PROMPT).toContain('"recommendations"');
    expect(SYSTEM_PROMPT).toContain('"studyTips"');
    expect(SYSTEM_PROMPT).toContain('"warnings"');
    expect(SYSTEM_PROMPT).toContain('"focusAreas"');
  });

  it("should include weekly and daily summary fields", () => {
    expect(SYSTEM_PROMPT).toContain('"dailySummary"');
    expect(SYSTEM_PROMPT).toContain('"weeklySummary"');
  });

  it("should include totalPlans field", () => {
    expect(SYSTEM_PROMPT).toContain('"totalPlans"');
  });
});
