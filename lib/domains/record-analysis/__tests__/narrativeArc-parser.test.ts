import { describe, it, expect } from "vitest";
import {
  parseNarrativeArcResponse,
  buildNarrativeArcUserPrompt,
} from "../llm/prompts/narrativeArc";
import type { NarrativeArcExtractionInput } from "../llm/types";

// ============================================
// Phase 2 Layer 3 Narrative Arc 파서 테스트
// ============================================

describe("parseNarrativeArcResponse", () => {
  it("8단계 전부 존재 응답 — stagesPresentCount=8", () => {
    const stage = (conf: number, ev: string) => ({
      present: true,
      confidence: conf,
      evidence: ev,
    });
    const content =
      "```json\n" +
      JSON.stringify({
        curiosity: stage(0.9, "~에 의문을 가짐"),
        topicSelection: stage(0.85, "~을 주제로 선정"),
        inquiryContent: stage(0.8, "~자료를 비교 분석"),
        references: stage(0.9, "통계청 자료"),
        conclusion: stage(0.75, "~임을 확인"),
        teacherObservation: stage(0.85, "뛰어난 분석력"),
        growthNarrative: stage(0.7, "시야가 확장됨"),
        reinquiry: stage(0.8, "후속 탐구 계획"),
      }) +
      "\n```";

    const r = parseNarrativeArcResponse(content);
    expect(r.stagesPresentCount).toBe(8);
    expect(r.curiosity.present).toBe(true);
    expect(r.curiosity.evidence).toBe("~에 의문을 가짐");
    expect(r.references.confidence).toBeCloseTo(0.9);
  });

  it("일부 단계 누락 — present=false + evidence 빈 문자열 강제", () => {
    const content = JSON.stringify({
      curiosity: { present: true, confidence: 0.9, evidence: "원문" },
      topicSelection: { present: false, confidence: 0.3, evidence: "잘못된 evidence" },
      inquiryContent: { present: false, confidence: 0.4, evidence: "" },
      references: { present: false, confidence: 0.95, evidence: "" },
      conclusion: { present: true, confidence: 0.6, evidence: "결론 인용" },
      teacherObservation: { present: false, confidence: 0.5, evidence: "" },
      growthNarrative: { present: false, confidence: 0.4, evidence: "" },
      reinquiry: { present: false, confidence: 0.5, evidence: "" },
    });

    const r = parseNarrativeArcResponse(content);
    expect(r.stagesPresentCount).toBe(2);
    // present=false면 LLM이 evidence를 반환해도 빈 문자열로 강제
    expect(r.topicSelection.evidence).toBe("");
    expect(r.topicSelection.present).toBe(false);
  });

  it("confidence 범위 밖 값 — 0~1 클램프", () => {
    const content = JSON.stringify({
      curiosity: { present: true, confidence: 1.5, evidence: "A" },
      topicSelection: { present: false, confidence: -0.3, evidence: "" },
      inquiryContent: { present: false, confidence: 0.5, evidence: "" },
      references: { present: false, confidence: 0.5, evidence: "" },
      conclusion: { present: false, confidence: 0.5, evidence: "" },
      teacherObservation: { present: false, confidence: 0.5, evidence: "" },
      growthNarrative: { present: false, confidence: 0.5, evidence: "" },
      reinquiry: { present: false, confidence: 0.5, evidence: "" },
    });

    const r = parseNarrativeArcResponse(content);
    expect(r.curiosity.confidence).toBe(1);
    expect(r.topicSelection.confidence).toBe(0);
  });

  it("evidence 150자 초과 — 잘림", () => {
    const longEvidence = "가".repeat(200);
    const content = JSON.stringify({
      curiosity: { present: true, confidence: 0.9, evidence: longEvidence },
      topicSelection: { present: false, confidence: 0.5, evidence: "" },
      inquiryContent: { present: false, confidence: 0.5, evidence: "" },
      references: { present: false, confidence: 0.5, evidence: "" },
      conclusion: { present: false, confidence: 0.5, evidence: "" },
      teacherObservation: { present: false, confidence: 0.5, evidence: "" },
      growthNarrative: { present: false, confidence: 0.5, evidence: "" },
      reinquiry: { present: false, confidence: 0.5, evidence: "" },
    });

    const r = parseNarrativeArcResponse(content);
    expect(r.curiosity.evidence.length).toBe(150);
  });

  it("빈 JSON — 모든 단계 false, count=0", () => {
    const r = parseNarrativeArcResponse("{}");
    expect(r.stagesPresentCount).toBe(0);
    expect(r.curiosity.present).toBe(false);
    expect(r.reinquiry.present).toBe(false);
  });

  it("JSON 파싱 불가 — SyntaxError throw", () => {
    expect(() => parseNarrativeArcResponse("not json at all")).toThrow(SyntaxError);
  });

  it("필드 타입 이상 — 보수적 false 처리", () => {
    const content = JSON.stringify({
      curiosity: "not an object",
      topicSelection: null,
      inquiryContent: { present: "true", confidence: "0.9", evidence: 123 },
      references: { present: false, confidence: 0.5, evidence: "" },
      conclusion: { present: false, confidence: 0.5, evidence: "" },
      teacherObservation: { present: false, confidence: 0.5, evidence: "" },
      growthNarrative: { present: false, confidence: 0.5, evidence: "" },
      reinquiry: { present: false, confidence: 0.5, evidence: "" },
    });

    const r = parseNarrativeArcResponse(content);
    expect(r.curiosity.present).toBe(false);
    expect(r.topicSelection.present).toBe(false);
    // "true" 문자열은 boolean 아니므로 false
    expect(r.inquiryContent.present).toBe(false);
  });
});

describe("buildNarrativeArcUserPrompt", () => {
  const baseInput: NarrativeArcExtractionInput = {
    recordType: "setek",
    recordId: "test-r1",
    schoolYear: 2025,
    grade: 2,
    subjectName: "수학",
    content: "미적분을 이용해 최적화 문제를 탐구함. 자료를 비교 분석하여 결론을 도출함.",
  };

  it("교과 세특 — 과목명 포함", () => {
    const prompt = buildNarrativeArcUserPrompt(baseInput);
    expect(prompt).toContain("교과 세특 / 수학");
    expect(prompt).toContain("2학년 / 2025년");
    expect(prompt).toContain(baseInput.content);
  });

  it("행특 — subjectName 없음", () => {
    const prompt = buildNarrativeArcUserPrompt({
      ...baseInput,
      recordType: "haengteuk",
      subjectName: undefined,
    });
    expect(prompt).toContain("행동특성 및 종합의견");
    expect(prompt).not.toContain(" / 수학");
  });

  it("targetMajor 있을 때 반영", () => {
    const prompt = buildNarrativeArcUserPrompt({
      ...baseInput,
      targetMajor: "경영학",
    });
    expect(prompt).toContain("경영학");
  });
});
