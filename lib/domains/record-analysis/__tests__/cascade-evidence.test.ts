// ============================================
// cascade-evidence 단위 테스트 (옵션 A-2, M1-c W3, 2026-04-27)
//
// 검증:
//  1. NEIS 0건 학년 → evidenceFromNeis 강제 비움 (가짜 차단)
//  2. NEIS 있는 학년 + LLM 정상 evidence → 그대로 유지
//  3. NEIS 있는 학년 + LLM 가짜 evidence → 매칭 실패 항목 제거
//  4. NEIS 있는 학년 + LLM 빈 evidence → 코드 매칭 폴백으로 자동 채움
//  5. 변경 사유(changes) 텔레메트리 정확도
// ============================================

import { describe, it, expect } from "vitest";
import { reconcileCascadeEvidence } from "../capability/cascade-evidence";
import type { CascadePlan } from "../capability/cascade-plan";
import type { MainTheme } from "../capability/main-theme";

const FAKE_THEME: MainTheme = {
  label: "정밀의료의 임상-약물 인터페이스",
  rationale: "의예과 진로",
  sourceCitations: ["career:의학·약학"],
  keywords: ["정밀의료", "약물", "임상", "유전체"],
};

function makePlan(overrides: Partial<CascadePlan["byGrade"][string]>[]): CascadePlan {
  return {
    themeLabel: FAKE_THEME.label,
    byGrade: {
      "1": {
        tier: "foundational",
        subjects: ["통합과학"],
        contentSummary: "정밀의료 기초",
        rationale: "기초 단계",
        ...overrides[0],
      },
      "2": {
        tier: "development",
        subjects: ["생명과학"],
        contentSummary: "약물 작용 기전 탐구",
        rationale: "발전 단계",
        ...overrides[1],
      },
      "3": {
        tier: "advanced",
        subjects: ["생명과학"],
        contentSummary: "임상 사례 분석",
        rationale: "심화 단계",
        ...overrides[2],
      },
    },
  };
}

describe("reconcileCascadeEvidence", () => {
  it("NEIS 0건 학년의 LLM evidence 는 강제 제거", () => {
    const plan = makePlan([
      { evidenceFromNeis: ["기초 실험 수행", "화학 개념 학습"] },
      {},
      {},
    ]);
    const verdict = reconcileCascadeEvidence({ plan, neisExtractsByGrade: undefined });
    expect(verdict.plan.byGrade["1"].evidenceFromNeis).toBeUndefined();
    expect(verdict.changes.find((c) => c.grade === 1)?.action).toBe("cleared");
    expect(verdict.changes.find((c) => c.grade === 1)?.removed).toEqual([
      "기초 실험 수행",
      "화학 개념 학습",
    ]);
  });

  it("일부 학년만 NEIS 있을 때 — 없는 학년은 비우고 있는 학년은 검증", () => {
    const plan = makePlan([
      { evidenceFromNeis: ["가짜 활동"] }, // 1학년 NEIS 0건
      { evidenceFromNeis: ["약물 작용 메커니즘 발표 진행"] }, // 2학년 NEIS 있음, 매칭됨
      { evidenceFromNeis: ["완전 무관한 텍스트"] }, // 3학년 NEIS 있음, 매칭 안됨
    ]);
    const verdict = reconcileCascadeEvidence({
      plan,
      neisExtractsByGrade: {
        2: [{ category: "setek", summary: "생명과학 시간에 약물 작용 메커니즘 발표 수행" }],
        3: [{ category: "setek", summary: "임상 사례 보고서 작성" }],
      },
      mainTheme: FAKE_THEME,
    });

    expect(verdict.plan.byGrade["1"].evidenceFromNeis).toBeUndefined();
    expect(verdict.plan.byGrade["2"].evidenceFromNeis).toEqual([
      "약물 작용 메커니즘 발표 진행",
    ]);
    // 3학년: LLM evidence 가짜 → 코드 폴백으로 mainTheme.keywords/contentSummary 토큰 매칭 시도.
    //       "임상 사례 분석" 의 "임상" 이 NEIS "임상 사례 보고서 작성" 에 매칭됨 → auto-filled.
    expect(verdict.plan.byGrade["3"].evidenceFromNeis).toBeDefined();
    expect(verdict.plan.byGrade["3"].evidenceFromNeis![0]).toContain("임상 사례 보고서");
  });

  it("LLM 빈 evidence + NEIS 있음 → 코드 폴백 자동 채움", () => {
    const plan = makePlan([
      {},
      { evidenceFromNeis: [] },
      {},
    ]);
    const verdict = reconcileCascadeEvidence({
      plan,
      neisExtractsByGrade: {
        2: [
          { category: "setek", summary: "생명과학 시간에 약물 대사 경로 발표" },
          { category: "changche", summary: "동아리에서 임상 사례 토론 진행" },
        ],
      },
      mainTheme: FAKE_THEME,
    });
    expect(verdict.plan.byGrade["2"].evidenceFromNeis).toBeDefined();
    expect(verdict.plan.byGrade["2"].evidenceFromNeis!.length).toBeGreaterThan(0);
    expect(verdict.changes.find((c) => c.grade === 2)?.action).toBe("auto-filled");
  });

  it("NEIS 있고 LLM evidence 모두 정상 → kept", () => {
    const plan = makePlan([
      {},
      { evidenceFromNeis: ["약물 대사 경로 발표"] },
      {},
    ]);
    const verdict = reconcileCascadeEvidence({
      plan,
      neisExtractsByGrade: {
        2: [{ category: "setek", summary: "생명과학 시간에 약물 대사 경로 발표 수행" }],
      },
      mainTheme: FAKE_THEME,
    });
    expect(verdict.plan.byGrade["2"].evidenceFromNeis).toEqual([
      "약물 대사 경로 발표",
    ]);
    expect(verdict.changes.find((c) => c.grade === 2)?.action).toBe("kept");
  });

  it("textInsensitivity — 한글 부분문자열 양방향 매칭", () => {
    const plan = makePlan([
      {},
      {},
      { evidenceFromNeis: ["임상"] }, // 짧은 라벨도 매칭되도록
    ]);
    const verdict = reconcileCascadeEvidence({
      plan,
      neisExtractsByGrade: {
        3: [{ category: "setek", summary: "임상 약리학 보고서" }],
      },
      mainTheme: FAKE_THEME,
    });
    expect(verdict.plan.byGrade["3"].evidenceFromNeis).toContain("임상");
  });
});
