import { describe, it, expect } from "vitest";
import { parseHighlightResponse, parseBatchHighlightResponse, validateHighlightResult } from "../llm/prompts/competencyHighlight";

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

  it("malformed JSON → SyntaxError throw", () => {
    const content = '```json\n{ invalid json }\n```';
    expect(() => parseHighlightResponse(content)).toThrow(SyntaxError);
  });

  it("빈 문자열 → SyntaxError throw", () => {
    expect(() => parseHighlightResponse("")).toThrow(SyntaxError);
  });

  it("JSON 아닌 텍스트 → SyntaxError throw", () => {
    expect(() => parseHighlightResponse("이것은 JSON이 아닙니다.")).toThrow(SyntaxError);
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

// ============================================
// validateHighlightResult 단위 테스트
// ============================================

describe("validateHighlightResult", () => {
  it("parseHighlightResponse와 동일한 검증 결과", () => {
    const obj = {
      sections: [{
        sectionType: "학업태도",
        tags: [{ competencyItem: "academic_attitude", evaluation: "positive", highlight: "열심히 참여", reasoning: "태도 우수" }],
        needsReview: false,
      }],
      competencyGrades: [{ item: "academic_attitude", grade: "B+", reasoning: "보통" }],
      summary: "요약",
    };
    const result = validateHighlightResult(obj);
    expect(result.sections).toHaveLength(1);
    expect(result.competencyGrades).toHaveLength(1);
    expect(result.summary).toBe("요약");
  });

  it("null 입력 → 빈 결과", () => {
    const result = validateHighlightResult(null as unknown as Record<string, unknown>);
    expect(result.sections).toHaveLength(0);
    expect(result.competencyGrades).toHaveLength(0);
  });
});

// ============================================
// parseBatchHighlightResponse 테스트
// ============================================

describe("parseBatchHighlightResponse", () => {
  const makeSingleResult = (summary: string) => ({
    sections: [{
      sectionType: "전체",
      tags: [{ competencyItem: "academic_attitude", evaluation: "positive", highlight: "적극적으로 참여", reasoning: "참여도 높음" }],
      needsReview: false,
    }],
    competencyGrades: [{ item: "academic_attitude", grade: "A-", reasoning: "우수" }],
    summary,
  });

  it("정상 배치 응답 파싱 (results 래퍼)", () => {
    const content = JSON.stringify({
      results: {
        "rec-1": makeSingleResult("첫째"),
        "rec-2": makeSingleResult("둘째"),
      },
    });
    const result = parseBatchHighlightResponse(content, ["rec-1", "rec-2"]);
    expect(result.succeeded.size).toBe(2);
    expect(result.failedIds).toHaveLength(0);
    expect(result.succeeded.get("rec-1")!.summary).toBe("첫째");
    expect(result.succeeded.get("rec-2")!.summary).toBe("둘째");
  });

  it("results 래퍼 없이 flat 구조도 파싱", () => {
    const content = JSON.stringify({
      "rec-1": makeSingleResult("flat"),
    });
    const result = parseBatchHighlightResponse(content, ["rec-1"]);
    expect(result.succeeded.size).toBe(1);
    expect(result.succeeded.get("rec-1")!.summary).toBe("flat");
  });

  it("일부 레코드 누락 → failedIds에 포함", () => {
    const content = JSON.stringify({
      results: {
        "rec-1": makeSingleResult("있음"),
      },
    });
    const result = parseBatchHighlightResponse(content, ["rec-1", "rec-2"]);
    expect(result.succeeded.size).toBe(1);
    expect(result.failedIds).toEqual(["rec-2"]);
  });

  it("전체 파싱 실패 → 모든 ID가 failedIds", () => {
    const result = parseBatchHighlightResponse("not json at all", ["a", "b", "c"]);
    expect(result.succeeded.size).toBe(0);
    expect(result.failedIds).toEqual(["a", "b", "c"]);
  });

  it("개별 레코드 검증 실패 → 해당 ID만 failedIds", () => {
    const content = JSON.stringify({
      results: {
        "rec-1": makeSingleResult("정상"),
        "rec-2": "not an object",
      },
    });
    const result = parseBatchHighlightResponse(content, ["rec-1", "rec-2"]);
    expect(result.succeeded.size).toBe(1);
    expect(result.failedIds).toEqual(["rec-2"]);
  });

  it("태그 0개 레코드 → 성공 (빈 결과)", () => {
    const content = JSON.stringify({
      results: {
        "rec-1": { sections: [], competencyGrades: [], summary: "" },
      },
    });
    const result = parseBatchHighlightResponse(content, ["rec-1"]);
    expect(result.succeeded.size).toBe(1);
    expect(result.succeeded.get("rec-1")!.summary).toContain("근거를 찾지 못했습니다");
  });

  it("마크다운 fence 래핑된 배치 응답 파싱", () => {
    const json = JSON.stringify({
      results: { "rec-1": makeSingleResult("fence") },
    });
    const content = "```json\n" + json + "\n```";
    const result = parseBatchHighlightResponse(content, ["rec-1"]);
    expect(result.succeeded.size).toBe(1);
  });
});

// ============================================
// contentQuality 점수 추출 테스트
// ============================================

describe("contentQuality 가중치 재계산", () => {
  function makeResponse(quality: Record<string, unknown>): string {
    return JSON.stringify({ sections: [], competencyGrades: [], summary: "", contentQuality: quality });
  }

  it("5축 가중치 — scientificValidity 포함, overallScore 미제공 → 재계산", () => {
    // (4×25 + 3×15 + 4×25 + 5×10 + 3×25) / 5 = 370/5 = 74
    const result = parseHighlightResponse(makeResponse({
      specificity: 4, coherence: 3, depth: 4, grammar: 5, scientificValidity: 3,
      issues: [], feedback: "",
    }));
    expect(result.contentQuality?.overallScore).toBe(74);
    expect(result.contentQuality?.scientificValidity).toBe(3);
  });

  it("4축 가중치 — scientificValidity 없음, overallScore 미제공 → 재계산", () => {
    // (4×30 + 3×20 + 4×30 + 5×20) / 5 = 400/5 = 80
    const result = parseHighlightResponse(makeResponse({
      specificity: 4, coherence: 3, depth: 4, grammar: 5,
      issues: [], feedback: "",
    }));
    expect(result.contentQuality?.overallScore).toBe(80);
    expect(result.contentQuality?.scientificValidity).toBe(0); // null → 0 기본값
  });

  it("LLM 제공 overallScore 우선 사용", () => {
    const result = parseHighlightResponse(makeResponse({
      specificity: 3, coherence: 3, depth: 3, grammar: 3, scientificValidity: 3,
      overallScore: 55, issues: [], feedback: "",
    }));
    // 계산값: (3×25+3×15+3×25+3×10+3×25)/5 = 60, LLM=55 → 차이 5 → 경고 없음
    expect(result.contentQuality?.overallScore).toBe(55);
  });

  it("전체 만점 (5축, 5/5/5/5/5) → overallScore 100", () => {
    // (5×25 + 5×15 + 5×25 + 5×10 + 5×25) / 5 = 500/5 = 100
    const result = parseHighlightResponse(makeResponse({
      specificity: 5, coherence: 5, depth: 5, grammar: 5, scientificValidity: 5,
      issues: [], feedback: "",
    }));
    expect(result.contentQuality?.overallScore).toBe(100);
  });

  it("축 점수 범위 초과 → clamp 후 재계산", () => {
    // sp=clamp(10,0,5)=5, co=clamp(-1,0,5)=0, dp=3, gm=3, sv=3
    // (5×25 + 0×15 + 3×25 + 3×10 + 3×25) / 5 = 305/5 = 61
    const result = parseHighlightResponse(makeResponse({
      specificity: 10, coherence: -1, depth: 3, grammar: 3, scientificValidity: 3,
      issues: [], feedback: "",
    }));
    expect(result.contentQuality?.specificity).toBe(5);
    expect(result.contentQuality?.coherence).toBe(0);
    expect(result.contentQuality?.overallScore).toBe(61);
  });

  it("contentQuality 없으면 undefined", () => {
    const result = parseHighlightResponse(JSON.stringify({ sections: [], competencyGrades: [], summary: "" }));
    expect(result.contentQuality).toBeUndefined();
  });

  it("issues/feedback 파싱", () => {
    const result = parseHighlightResponse(makeResponse({
      specificity: 3, coherence: 3, depth: 3, grammar: 3,
      issues: ["P1_나열식", "F10_성장부재"],
      feedback: "탐구 결론이 명확하지 않습니다.",
    }));
    expect(result.contentQuality?.issues).toEqual(["P1_나열식", "F10_성장부재"]);
    expect(result.contentQuality?.feedback).toBe("탐구 결론이 명확하지 않습니다.");
  });

  it("issues 중 문자열 아닌 값 → 필터링", () => {
    const result = parseHighlightResponse(makeResponse({
      specificity: 3, coherence: 3, depth: 3, grammar: 3,
      issues: ["P1_나열식", 42, null, "F10_성장부재"],
      feedback: "",
    }));
    expect(result.contentQuality?.issues).toEqual(["P1_나열식", "F10_성장부재"]);
  });
});
