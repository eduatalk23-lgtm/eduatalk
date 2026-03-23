import { describe, it, expect } from "vitest";
import { parseHighlightResponse } from "../llm/prompts/competencyHighlight";

// ============================================
// LLM 응답 파서 테스트
// ============================================

describe("parseHighlightResponse", () => {
  // ─── 정상 케이스 ────────────────────────────

  it("정상 JSON 응답 파싱", () => {
    const content = '```json\n' + JSON.stringify({
      sections: [{
        sectionType: "학업태도",
        tags: [{
          competencyItem: "academic_attitude",
          evaluation: "positive",
          highlight: "적극적으로 참여하였다",
          reasoning: "수업 참여도 높음",
        }],
        needsReview: false,
      }],
      competencyGrades: [{
        item: "academic_attitude",
        grade: "A+",
        reasoning: "우수",
      }],
      summary: "전반적으로 우수",
    }) + '\n```';

    const result = parseHighlightResponse(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].tags).toHaveLength(1);
    expect(result.sections[0].tags[0].competencyItem).toBe("academic_attitude");
    expect(result.competencyGrades).toHaveLength(1);
    expect(result.competencyGrades[0].grade).toBe("A+");
    expect(result.summary).toBe("전반적으로 우수");
  });

  // ─── JSON 파싱 안전성 ──────────────────────

  it("malformed JSON → 빈 결과 (crash 안 함)", () => {
    const content = '```json\n{ invalid json }\n```';
    const result = parseHighlightResponse(content);
    expect(result.sections).toHaveLength(0);
    expect(result.competencyGrades).toHaveLength(0);
    expect(result.summary).toBe("");
  });

  it("빈 문자열 → 빈 결과", () => {
    const result = parseHighlightResponse("");
    expect(result.sections).toHaveLength(0);
  });

  it("JSON 아닌 텍스트 → 빈 결과", () => {
    const result = parseHighlightResponse("이것은 JSON이 아닙니다.");
    expect(result.sections).toHaveLength(0);
  });

  // ─── 필드 타입 가드 ────────────────────────

  it("sections가 배열이 아닌 경우 → 빈 결과", () => {
    const content = JSON.stringify({ sections: "not an array", competencyGrades: [], summary: "" });
    const result = parseHighlightResponse(content);
    expect(result.sections).toHaveLength(0);
  });

  it("competencyGrades가 배열이 아닌 경우 → 빈 배열", () => {
    const content = JSON.stringify({ sections: [], competencyGrades: "bad", summary: "" });
    const result = parseHighlightResponse(content);
    expect(result.competencyGrades).toHaveLength(0);
  });

  it("section 항목이 null인 경우 → 건너뜀", () => {
    const content = JSON.stringify({
      sections: [null, { sectionType: "학업태도", tags: [{ competencyItem: "academic_attitude", evaluation: "positive", highlight: "참여", reasoning: "" }], needsReview: false }],
      competencyGrades: [],
      summary: "",
    });
    const result = parseHighlightResponse(content);
    expect(result.sections).toHaveLength(1);
  });

  // ─── 유효하지 않은 enum 필터링 ─────────────

  it("잘못된 competencyItem → 해당 태그 제외", () => {
    const content = JSON.stringify({
      sections: [{
        sectionType: "학업태도",
        tags: [
          { competencyItem: "invalid_item", evaluation: "positive", highlight: "text", reasoning: "" },
          { competencyItem: "academic_attitude", evaluation: "positive", highlight: "text2", reasoning: "" },
        ],
        needsReview: false,
      }],
      competencyGrades: [],
      summary: "",
    });
    const result = parseHighlightResponse(content);
    expect(result.sections[0].tags).toHaveLength(1);
    expect(result.sections[0].tags[0].competencyItem).toBe("academic_attitude");
  });

  it("잘못된 evaluation → 해당 태그 제외", () => {
    const content = JSON.stringify({
      sections: [{
        sectionType: "학업태도",
        tags: [
          { competencyItem: "academic_attitude", evaluation: "excellent", highlight: "text", reasoning: "" },
        ],
        needsReview: false,
      }],
      competencyGrades: [],
      summary: "",
    });
    const result = parseHighlightResponse(content);
    expect(result.sections).toHaveLength(0); // 태그 0개 → 섹션도 제거
  });

  it("잘못된 grade → 해당 등급 제외", () => {
    const content = JSON.stringify({
      sections: [],
      competencyGrades: [
        { item: "academic_attitude", grade: "S", reasoning: "" },
        { item: "academic_inquiry", grade: "A+", reasoning: "good" },
      ],
      summary: "",
    });
    const result = parseHighlightResponse(content);
    expect(result.competencyGrades).toHaveLength(1);
    expect(result.competencyGrades[0].item).toBe("academic_inquiry");
  });

  // ─── Markdown fence 변형 ──────────────────

  it("닫는 fence 없는 truncated 응답 → 파싱 가능", () => {
    const content = '```json\n' + JSON.stringify({
      sections: [], competencyGrades: [], summary: "truncated",
    });
    // 닫는 ``` 없음
    const result = parseHighlightResponse(content);
    expect(result.summary).toBe("truncated");
  });

  it("fence 없는 raw JSON → 파싱 가능", () => {
    const content = JSON.stringify({
      sections: [], competencyGrades: [], summary: "raw",
    });
    const result = parseHighlightResponse(content);
    expect(result.summary).toBe("raw");
  });
});
