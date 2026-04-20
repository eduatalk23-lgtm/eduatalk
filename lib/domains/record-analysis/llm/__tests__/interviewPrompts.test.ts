// ============================================
// α5 Interview 프롬프트 파서 단위 테스트 (Sprint 3, 2026-04-20)
//
// LLM 호출 없음. 순수 함수 빌더/파서만 검증.
// ============================================

import { describe, it, expect } from "vitest";
import {
  buildInterviewFollowupUserPrompt,
  parseFollowupResponse,
  type FollowupPromptInput,
} from "../prompts/interviewFollowupPrompt";
import {
  buildAnswerAnalysisUserPrompt,
  parseAnswerAnalysisResponse,
  type AnswerAnalysisPromptInput,
} from "../prompts/interviewAnswerAnalysisPrompt";

describe("interviewFollowupPrompt", () => {
  const baseInput: FollowupPromptInput = {
    rootQuestion: "Astra Shield 프로젝트에서 회귀 모델을 선택한 이유는?",
    chain: [
      {
        depth: 1,
        question: "Astra Shield 프로젝트에서 회귀 모델을 선택한 이유는?",
        answer: "충돌 위험은 연속값이라 분류보다 회귀가 적합했습니다.",
      },
    ],
    nextDepth: 2,
    scenario: {
      targetMajor: "물리천문학",
      targetUniversityLevel: "상위권",
      focus: "reasoning",
    },
    evidenceRefs: [
      {
        recordId: "setek:abc",
        summary: "소행성 궤도 요소 전처리 · 회귀 모델 구현 · 이상값 분포 분석",
      },
    ],
  };

  it("buildInterviewFollowupUserPrompt 가 필수 섹션을 포함", () => {
    const out = buildInterviewFollowupUserPrompt(baseInput);
    expect(out).toContain("## 면접 시나리오");
    expect(out).toContain("물리천문학");
    expect(out).toContain("## Seed 질문");
    expect(out).toContain("Astra Shield");
    expect(out).toContain("## 지금까지의 depth 체인");
    expect(out).toContain("Q1:");
    expect(out).toContain("A1:");
    expect(out).toContain("## 관련 생기부 근거");
    expect(out).toContain("setek:abc");
    expect(out).toContain("depth=2");
  });

  it("evidence 가 비어있으면 '생기부 근거 미제공' 표기", () => {
    const out = buildInterviewFollowupUserPrompt({
      ...baseInput,
      evidenceRefs: [],
    });
    expect(out).toContain("생기부 근거 미제공");
  });

  it("chain 이 비어있으면 '이전 답변 없음' 표기", () => {
    const out = buildInterviewFollowupUserPrompt({
      ...baseInput,
      chain: [],
    });
    expect(out).toContain("이전 답변 없음");
  });

  it("parseFollowupResponse 정상 JSON", () => {
    const raw = `{
      "question": "회귀 모델의 하이퍼파라미터를 어떻게 결정했나요?",
      "expectedHook": "튜닝 근거 + 본인 판단"
    }`;
    const parsed = parseFollowupResponse(raw);
    expect(parsed.question).toContain("하이퍼파라미터");
    expect(parsed.expectedHook).toContain("튜닝 근거");
  });

  it("parseFollowupResponse 마크다운 펜스 포함 JSON", () => {
    const raw = "```json\n{\"question\":\"한계는?\",\"expectedHook\":\"반성\"}\n```";
    const parsed = parseFollowupResponse(raw);
    expect(parsed.question).toBe("한계는?");
  });

  it("question 누락 시 에러", () => {
    const raw = `{"expectedHook":"..."}`;
    expect(() => parseFollowupResponse(raw)).toThrow(/question/);
  });

  it("question 300자 초과 시 에러", () => {
    const longQ = "가".repeat(310);
    const raw = JSON.stringify({ question: longQ, expectedHook: "ok" });
    expect(() => parseFollowupResponse(raw)).toThrow(/길이 초과/);
  });

  it("expectedHook 누락 시 기본값 제공", () => {
    const raw = `{"question":"왜 그렇게 판단했나요?"}`;
    const parsed = parseFollowupResponse(raw);
    expect(parsed.expectedHook).toContain("hook 미제공");
  });
});

describe("interviewAnswerAnalysisPrompt", () => {
  const baseInput: AnswerAnalysisPromptInput = {
    questionText: "이 탐구에서 가장 어려웠던 지점은?",
    expectedHook: "구체 사례 + 본인 대응",
    answerText:
      "저는 데이터 전처리 단계에서 이상값 분포가 예상보다 편중된 점이 어려웠습니다. 정규화 방식을 세 번 바꾸며 시행착오를 거쳤습니다.",
    evidenceRefs: [
      {
        recordId: "setek:1",
        summary: "이상값 분포 분석 · 데이터 정규화 시행착오",
      },
    ],
    asOfLabel: "2026 2-1",
  };

  it("buildAnswerAnalysisUserPrompt 가 필수 섹션을 포함", () => {
    const out = buildAnswerAnalysisUserPrompt(baseInput);
    expect(out).toContain("## 질문");
    expect(out).toContain("어려웠던 지점");
    expect(out).toContain("[expectedHook]");
    expect(out).toContain("## 학생 답변");
    expect(out).toContain("데이터 전처리");
    expect(out).toContain("## 관련 생기부 근거");
    expect(out).toContain("setek:1");
    expect(out).toContain("## asOf 시점");
    expect(out).toContain("ess_violation");
  });

  it("evidence 비어있으면 '미제공' + asOfLabel 없으면 asOf 섹션 생략", () => {
    const out = buildAnswerAnalysisUserPrompt({
      ...baseInput,
      evidenceRefs: [],
      asOfLabel: null,
    });
    expect(out).toContain("생기부 근거 미제공");
    expect(out).not.toContain("## asOf 시점");
  });

  it("parseAnswerAnalysisResponse 정상 JSON 전 필드 매핑", () => {
    const raw = JSON.stringify({
      consistencyScore: 72,
      authenticityScore: 85,
      aiSignals: { jargonDensity: 2, sentenceUniformity: 3, vagueHedging: 2 },
      gapFindings: [
        {
          kind: "unsupported_claim",
          summary: "본인이 언급한 라이브러리명이 생기부에 없음",
          sourceRecordIds: ["setek:1"],
        },
      ],
      coachComment: "구체 사례 좋음. 근거 인용 추가 권장.",
    });
    const parsed = parseAnswerAnalysisResponse(raw);
    expect(parsed.consistencyScore).toBe(72);
    expect(parsed.authenticityScore).toBe(85);
    expect(parsed.aiSignals.jargonDensity).toBe(2);
    expect(parsed.gapFindings).toHaveLength(1);
    expect(parsed.gapFindings[0].kind).toBe("unsupported_claim");
    expect(parsed.analyzedBy).toBe("llm_v1");
  });

  it("점수 범위 초과 시 clamp", () => {
    const raw = JSON.stringify({
      consistencyScore: 150,
      authenticityScore: -20,
      aiSignals: { jargonDensity: 9, sentenceUniformity: 0, vagueHedging: 3 },
      gapFindings: [],
      coachComment: "ok",
    });
    const parsed = parseAnswerAnalysisResponse(raw);
    expect(parsed.consistencyScore).toBe(100);
    expect(parsed.authenticityScore).toBe(0);
    expect(parsed.aiSignals.jargonDensity).toBe(5);
    expect(parsed.aiSignals.sentenceUniformity).toBe(1);
  });

  it("잘못된 gapFindings kind 는 필터링", () => {
    const raw = JSON.stringify({
      consistencyScore: 50,
      authenticityScore: 50,
      aiSignals: { jargonDensity: 3, sentenceUniformity: 3, vagueHedging: 3 },
      gapFindings: [
        { kind: "invalid_kind", summary: "x", sourceRecordIds: [] },
        { kind: "ess_violation", summary: "미래 정보", sourceRecordIds: [] },
      ],
      coachComment: "ok",
    });
    const parsed = parseAnswerAnalysisResponse(raw);
    expect(parsed.gapFindings).toHaveLength(1);
    expect(parsed.gapFindings[0].kind).toBe("ess_violation");
  });

  it("coachComment 누락 시 기본값", () => {
    const raw = JSON.stringify({
      consistencyScore: 30,
      authenticityScore: 40,
      aiSignals: { jargonDensity: 2, sentenceUniformity: 2, vagueHedging: 2 },
      gapFindings: [],
    });
    const parsed = parseAnswerAnalysisResponse(raw);
    expect(parsed.coachComment).toContain("생성되지 않았");
  });

  it("summary 비어있는 findings 는 드롭", () => {
    const raw = JSON.stringify({
      consistencyScore: 50,
      authenticityScore: 50,
      aiSignals: { jargonDensity: 3, sentenceUniformity: 3, vagueHedging: 3 },
      gapFindings: [
        { kind: "missing_evidence", summary: "   ", sourceRecordIds: [] },
        { kind: "contradiction", summary: "유효한 지적", sourceRecordIds: [] },
      ],
      coachComment: "ok",
    });
    const parsed = parseAnswerAnalysisResponse(raw);
    expect(parsed.gapFindings).toHaveLength(1);
    expect(parsed.gapFindings[0].summary).toBe("유효한 지적");
  });
});
