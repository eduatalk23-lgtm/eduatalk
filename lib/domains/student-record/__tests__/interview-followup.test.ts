// ============================================
// α5 interview-followup rule_v1 단위 테스트 (Sprint 2, 2026-04-20)
//
// 시나리오:
//   1. parent=null → null 반환
//   2. depth=5 parent → terminal=true
//   3. depth=1 parent → depth=2 follow-up 생성
//   4. 같은 slug 회전 — existingChains 에 hook 이 있으면 다른 템플릿 선택
//   5. 답변 공백 → authenticity=0 + unsupported_claim
//   6. 답변과 증거 키워드 겹침 → consistency 높음
//   7. 증거 없음 → missing_evidence + 중립 50
//   8. "다양한/매우/상당히" 다수 → vagueHedging 높음
//   9. 수치 주장이 증거에 없음 → unsupported_claim
//   10. aggregateSessionScore: 답변 0 → null / 일부 답변 → avg 계산
// ============================================

import { describe, it, expect } from "vitest";
import {
  aggregateSessionScore,
  analyzeAnswerRuleV1,
  buildFollowupChainRuleV1,
} from "../state/interview-followup";
import type {
  InterviewChainDepth,
  InterviewChainNode,
} from "../types/interview";

function makeChain(overrides: Partial<InterviewChainNode>): InterviewChainNode {
  return {
    id: "c1",
    sessionId: "s1",
    rootQuestionId: "rq1",
    parentChainId: null,
    depth: 1 as InterviewChainDepth,
    questionText: "Q1",
    expectedHook: null,
    generatedBy: "seed",
    createdAt: "2026-04-20T00:00:00Z",
    ...overrides,
  };
}

// ============================================
// buildFollowupChainRuleV1
// ============================================

describe("buildFollowupChainRuleV1 — 경계", () => {
  it("parentChain=null → null", () => {
    const r = buildFollowupChainRuleV1({
      existingChains: [],
      parentChain: null,
    });
    expect(r).toBeNull();
  });

  it("parent.depth=5 → terminal=true", () => {
    const parent = makeChain({ id: "c5", depth: 5 as InterviewChainDepth });
    const r = buildFollowupChainRuleV1({
      existingChains: [parent],
      parentChain: parent,
    });
    expect(r).not.toBeNull();
    expect(r?.terminal).toBe(true);
  });
});

describe("buildFollowupChainRuleV1 — 정상", () => {
  it("parent.depth=1 → depth=2 질문 + expectedHook with slug tag", () => {
    const parent = makeChain({ id: "c1", depth: 1 as InterviewChainDepth });
    const r = buildFollowupChainRuleV1({
      existingChains: [parent],
      parentChain: parent,
    });
    expect(r?.terminal).toBe(false);
    expect(r?.depth).toBe(2);
    expect(r?.questionText.length).toBeGreaterThan(0);
    expect(r?.expectedHook).toMatch(/\[rule_v1:/);
    expect(r?.slug).toBe("toughest");
  });

  it("existing chain 에 toughest 사용되었으면 다른 slug 선택", () => {
    const parent = makeChain({ id: "c1", depth: 1 as InterviewChainDepth });
    const used = makeChain({
      id: "c2",
      depth: 2 as InterviewChainDepth,
      expectedHook: "[rule_v1:toughest] 구체 경험",
    });
    const r = buildFollowupChainRuleV1({
      existingChains: [parent, used],
      parentChain: used,
    });
    expect(r?.slug).toBe("causal_reasoning");
    expect(r?.depth).toBe(3);
  });

  it("4 템플릿 소진 시 마지막 남은 것 반환", () => {
    const parent = makeChain({ id: "c1", depth: 1 as InterviewChainDepth });
    const existing = [
      parent,
      makeChain({ id: "c2", depth: 2, expectedHook: "[rule_v1:toughest] x" }),
      makeChain({ id: "c3", depth: 3, expectedHook: "[rule_v1:causal_reasoning] x" }),
      makeChain({ id: "c4", depth: 4, expectedHook: "[rule_v1:counterfactual] x" }),
    ];
    const lastUsed = existing[3];
    const r = buildFollowupChainRuleV1({
      existingChains: existing,
      parentChain: lastUsed,
    });
    expect(r?.depth).toBe(5);
    // 남은 것 중 아무거나 (career_link 또는 next_step)
    expect(["career_link", "next_step"]).toContain(r?.slug);
  });
});

// ============================================
// analyzeAnswerRuleV1
// ============================================

describe("analyzeAnswerRuleV1 — 빈 답변", () => {
  it("공백 → score 0 + unsupported_claim", () => {
    const r = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText: "   ",
      evidenceRefs: [],
    });
    expect(r.consistencyScore).toBe(0);
    expect(r.authenticityScore).toBe(0);
    expect(r.gapFindings.some((g) => g.kind === "unsupported_claim")).toBe(true);
    expect(r.analyzedBy).toBe("rule_v1");
    expect(r.costUsd).toBe(0);
  });
});

describe("analyzeAnswerRuleV1 — 증거 keyword 매칭", () => {
  it("답변이 증거 키워드 다수 포함 → consistency 높음", () => {
    const r = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText:
        "물리학 실험 설계 과정에서 오차 분석이 중요했습니다. 데이터를 여러 번 측정하고 평균을 구했습니다.",
      evidenceRefs: [
        {
          recordId: "r1",
          summary:
            "물리학 실험 설계 · 오차 분석 · 데이터 측정 · 평균 계산 · 변인 통제",
        },
      ],
    });
    expect(r.consistencyScore).toBeGreaterThan(40);
  });

  it("증거 없음 → missing_evidence + score 50", () => {
    const r = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText: "네, 그 활동은 의미 있었습니다.",
      evidenceRefs: [],
    });
    expect(r.consistencyScore).toBe(50);
    expect(r.gapFindings.some((g) => g.kind === "missing_evidence")).toBe(true);
  });
});

describe("analyzeAnswerRuleV1 — AI 신호", () => {
  it("헤징 키워드 다수 → vagueHedging 높음", () => {
    const r = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText:
        "다양한 분야의 매우 상당히 여러 가지 폭넓은 활동을 통해 깊이 있는 탐구를 진행했습니다.",
      evidenceRefs: [
        { recordId: "r1", summary: "탐구 활동 요약" },
      ],
    });
    expect(r.aiSignals.vagueHedging).toBeGreaterThanOrEqual(3);
  });

  it("구체적 본인 답변 → authenticity 상대적으로 높음", () => {
    const specific = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText:
        "저는 이 실험을 시작할 때 변인 통제가 가장 어려웠습니다. 특히 온도 변화가 예상보다 컸고, 재측정 3번 중 2번 값이 달랐습니다. 담임 선생님 조언을 받아 온도계를 교체했습니다.",
      evidenceRefs: [
        { recordId: "r1", summary: "변인 통제 · 온도 재측정 · 온도계 교체" },
      ],
    });
    const vague = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText:
        "다양한 변인을 여러 번 매우 폭넓게 측정하여 상당히 의미 있는 결과를 얻었습니다. 다양한 지식을 얻었습니다.",
      evidenceRefs: [{ recordId: "r1", summary: "변인 통제 · 온도 재측정 · 온도계 교체" }],
    });
    expect(specific.authenticityScore).toBeGreaterThan(vague.authenticityScore);
  });
});

describe("analyzeAnswerRuleV1 — 수치 주장 검증", () => {
  it("답변에 증거에 없는 수치 있음 → unsupported_claim", () => {
    const r = analyzeAnswerRuleV1({
      questionText: "Q",
      expectedHook: null,
      answerText: "실험을 100회 반복하여 95%의 신뢰도를 확보했습니다.",
      evidenceRefs: [
        { recordId: "r1", summary: "실험 3회 반복, 평균 오차 분석" },
      ],
    });
    expect(
      r.gapFindings.some(
        (g) =>
          g.kind === "unsupported_claim" &&
          g.summary.includes("100회"),
      ),
    ).toBe(true);
  });
});

// ============================================
// aggregateSessionScore
// ============================================

describe("aggregateSessionScore", () => {
  it("답변 없음 → null avg + low 의심", () => {
    const r = aggregateSessionScore({ answers: [] });
    expect(r.avgConsistency).toBeNull();
    expect(r.avgAuthenticity).toBeNull();
    expect(r.gapCount).toBe(0);
    expect(r.aiSuspicionLevel).toBe("low");
  });

  it("답변 2건 → avg 계산 + gap 합산", () => {
    const r = aggregateSessionScore({
      answers: [
        {
          consistencyScore: 80,
          authenticityScore: 70,
          aiSignals: { jargonDensity: 2, sentenceUniformity: 2, vagueHedging: 2 },
          gapFindings: [],
        },
        {
          consistencyScore: 40,
          authenticityScore: 30,
          aiSignals: { jargonDensity: 4, sentenceUniformity: 4, vagueHedging: 5 },
          gapFindings: [
            {
              kind: "unsupported_claim",
              summary: "x",
              sourceRecordIds: [],
            },
          ],
        },
      ],
    });
    expect(r.avgConsistency).toBe(60);
    expect(r.avgAuthenticity).toBe(50);
    expect(r.gapCount).toBe(1);
    // aiAvg = (2+2+2+4+4+5)/6 = 3.17 → medium
    expect(r.aiSuspicionLevel).toBe("medium");
  });

  it("AI 신호 전부 높음 → high", () => {
    const r = aggregateSessionScore({
      answers: [
        {
          consistencyScore: 10,
          authenticityScore: 10,
          aiSignals: { jargonDensity: 5, sentenceUniformity: 5, vagueHedging: 5 },
          gapFindings: [],
        },
      ],
    });
    expect(r.aiSuspicionLevel).toBe("high");
  });
});
