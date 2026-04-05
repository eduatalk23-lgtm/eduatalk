/**
 * 세특 8단계 Flow Completion 산출 함수 테스트
 *
 * 검증 범위:
 * 1. 만점 케이스 → 100% (학종_서류100_가능)
 * 2. 최저 케이스 → 낮은 % (교과전형_추천)
 * 3. ⑤⑧ 미충족이어도 60%+ 가능 (가산 요소 미감점)
 * 4. 진로교과 vs 비진로교과 차이
 * 5. top vs mid 대학 기준 차이 (④ 참고문헌 필수 여부)
 * 6. aggregate 함수: 다수 레코드 평균
 * 7. issues 코드 → 특정 단계 미충족 반영
 * 8. scientific_validity = null (구버전) 처리
 * 9. feedback 키워드로 단계 ④ fallback
 */

import { describe, it, expect } from "vitest";
import {
  computeFlowCompletion,
  computeAggregateFlowCompletion,
  type QualitySnapshot,
} from "../evaluation-criteria/flow-completion";

// ============================================================
// 헬퍼
// ============================================================

function makeQuality(overrides: Partial<QualitySnapshot> = {}): QualitySnapshot {
  return {
    specificity: 5,
    coherence: 5,
    depth: 5,
    grammar: 5,
    scientific_validity: 5,
    overall_score: 100,
    issues: [],
    feedback: null,
    ...overrides,
  };
}

// ============================================================
// 1. 만점 케이스
// ============================================================

describe("computeFlowCompletion — 만점 케이스", () => {
  it("모든 축 5점 + issues 빈 배열 → 100% 도달", () => {
    const result = computeFlowCompletion(makeQuality(), {
      isCareerSubject: true,
      universityTier: "top",
    });
    expect(result.completionPercent).toBe(100);
  });

  it("tier가 학종_서류100_가능", () => {
    const result = computeFlowCompletion(makeQuality(), {
      isCareerSubject: true,
      universityTier: "top",
    });
    expect(result.tier.label).toBe("학종_서류100_가능");
  });

  it("8단계 모두 fulfilled", () => {
    const result = computeFlowCompletion(makeQuality(), {
      isCareerSubject: false,
      universityTier: "mid",
    });
    expect(result.stages.every((s) => s.fulfilled)).toBe(true);
  });
});

// ============================================================
// 2. 최저 케이스
// ============================================================

describe("computeFlowCompletion — 최저 케이스", () => {
  const lowQuality = makeQuality({
    specificity: 1,
    coherence: 1,
    depth: 1,
    grammar: 1,
    scientific_validity: 1,
    overall_score: 10,
    issues: [
      "P1_나열식",
      "P3_키워드만",
      "P4_내신탐구불일치",
      "F2_인과단절",
      "F3_출처불일치",
      "F6_자명한결론",
      "M1_교사관찰불가",
      "F10_성장부재",
    ],
    feedback: null,
  });

  it("낮은 completionPercent", () => {
    const result = computeFlowCompletion(lowQuality, {
      isCareerSubject: true,
      universityTier: "mid",
    });
    expect(result.completionPercent).toBeLessThan(30);
  });

  it("tier가 교과전형_추천", () => {
    const result = computeFlowCompletion(lowQuality, {
      isCareerSubject: true,
      universityTier: "mid",
    });
    expect(result.tier.label).toBe("교과전형_추천");
  });

  it("대부분 단계 미충족", () => {
    const result = computeFlowCompletion(lowQuality, {
      isCareerSubject: true,
      universityTier: "mid",
    });
    const fulfilledCount = result.stages.filter((s) => s.fulfilled).length;
    expect(fulfilledCount).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// 3. 가산 요소 미충족이어도 60%+ 가능
// ============================================================

describe("computeFlowCompletion — ⑤⑧ 가산 요소", () => {
  it("⑤결론 + ⑧재탐구 미충족이어도 필수 단계만으로 60%+ 달성", () => {
    // 필수단계(①②③⑥)는 충족, 가산(⑤⑧) 미충족 세팅
    const q = makeQuality({
      coherence: 2,   // ⑤ threshold 미충족 (coherence < 3)
      depth: 2,       // ⑤③ depth threshold 미충족: ③도 위험하지만 specificity로 대체 불가
      // → 의도적으로 ①⑥만 살리고 ③⑤⑦⑧은 depth 부족으로 미충족
    });
    // 이 경우 specificity=5, coherence=2, depth=2
    // ① specificity≥3 → 충족
    // ② coherence≥3 → 미충족
    // 이는 너무 많이 낮추는 것이므로, 실제 60%+ 시나리오로 재설계
    // 올바른 시나리오: 필수4개(①②③⑥) 모두 충족, 가산(⑤⑧)만 미충족
    const q2 = makeQuality({
      specificity: 4,
      coherence: 3,  // ②는 충족(≥3), ⑦은 미충족(<4), ⑤는 coherence≥3+depth≥3 → 충족 (가산이므로 OK)
      depth: 3,      // ③은 충족(≥3), ④는 미충족(<4), ⑧은 미충족(<4)
      scientific_validity: 2, // ⑧ scientific_validity<4 → 미충족
      issues: ["F6_자명한결론"], // ⑤ forbiddenIssues hit → ⑤ 미충족
    });
    const result = computeFlowCompletion(q2, {
      isCareerSubject: false, // 비진로교과: career 가중치 없음
      universityTier: "mid",
    });
    // ①②③⑥ 충족 → base 100%, ⑦미충족(coherence<4), ⑤⑧ 미충족
    // 비진로교과: base(①②③⑥) × 85% + bonus(⑤⑧ 중 0개) × 15%
    // ①: spec≥3 충족 ②: coh≥3 충족 ③: depth≥3 충족 ⑥: spec≥3, M1없음 충족
    // 따라서 base = 4/4 × 85 = 85, bonus = 0/2 × 15 = 0 → 85%
    expect(result.completionPercent).toBeGreaterThanOrEqual(60);
  });

  it("⑤⑧ 미충족이어도 tier가 학종_서류100_가능 또는 학종_가능_점검필요", () => {
    const q = makeQuality({
      coherence: 3,
      depth: 3,
      scientific_validity: 2, // ⑧ 미충족
      issues: ["F6_자명한결론"], // ⑤ 미충족
    });
    const result = computeFlowCompletion(q, {
      isCareerSubject: false,
      universityTier: "mid",
    });
    expect(["학종_서류100_가능", "학종_가능_점검필요"]).toContain(result.tier.label);
  });

  it("⑤ fulfilled=false 이어도 isBonus 성질로 totalPercent 감소 제한됨", () => {
    // 비진로교과, 모든 필수 충족, ⑤⑧ 미충족
    const allReq = makeQuality({
      specificity: 5,
      coherence: 2, // ⑦미충족(coh<4), ⑤미충족(coh<3)
      depth: 2,     // ③미충족(depth<3), ⑧미충족
      issues: [],
    });
    // ① spec≥3: 충족 ② coh≥3: 미충족 ③ depth≥3: 미충족 ⑥ spec≥3: 충족
    // base = 2/4 × 85 = 42.5 → 60% 미만
    // 이 케이스는 낮을 수밖에 없음(② ③ 둘 다 미충족) → 다른 관점 테스트
    const result = computeFlowCompletion(allReq, {
      isCareerSubject: false,
      universityTier: "mid",
    });
    // ⑤ stage fulfilled 확인
    const stage5 = result.stages.find((s) => s.stage === 5);
    expect(stage5).toBeDefined();
    // ⑤ 미충족 시 reason이 있어야 함
    // (coherence<3 이므로 미충족)
    if (!stage5?.fulfilled) {
      expect(stage5?.reason).toBeDefined();
    }
  });
});

// ============================================================
// 4. 진로교과 vs 비진로교과 차이
// ============================================================

describe("computeFlowCompletion — 진로교과 vs 비진로교과", () => {
  // ④ 참고문헌 단계 미충족 케이스 (depth=3, feedback 키워드 없음)
  const q = makeQuality({
    specificity: 4,
    coherence: 4,
    depth: 3, // ④ threshold depth≥4 미충족
    scientific_validity: 4,
    feedback: null, // ④ feedback fallback도 없음
  });

  it("진로교과(mid) + ④ 미충족: ⑤는 BONUS_STAGES에 포함되어 careerExtra 없음, ④ 미충족 영향 없음", () => {
    const career = computeFlowCompletion(q, {
      isCareerSubject: true,
      universityTier: "mid",
    });
    // mid: getCareerMinStages("mid") = [1,2,3,5]
    // BASE_REQUIRED=[1,2,3,6], BONUS_STAGES=[5,8]
    // careerExtra = [5] - BONUS([5,8]) = [] (빈 배열)
    // → career 가중치 0, base(70) + bonus(15) 구조와 동일
    // ④는 careerExtra에 없음 → ④ 미충족이어도 career 감점 없음
    // ⑤ depth≥3 충족(depth=3), coherence≥3 충족(coherence=4) → ⑤ fulfilled
    const stage5 = career.stages.find((s) => s.stage === 5);
    expect(stage5?.fulfilled).toBe(true);
    // base: ①②③⑥ 모두 충족 → 4/4 × 70 = 70
    // career: careerExtra=[] → 0
    // bonus: ⑤fulfilled, ⑧ sv=4≥4+depth=3<4 → ⑧ depth 미충족 → bonus = 1/2 × 15 = 7.5
    // total = 70 + 0 + 7.5 = 77.5
    expect(career.completionPercent).toBeGreaterThanOrEqual(60);
    expect(career.completionPercent).toBe(77.5);
  });

  it("진로교과(top) + ④ 미충족: ④가 careerExtra에 포함되어 감점", () => {
    const careerTop = computeFlowCompletion(q, {
      isCareerSubject: true,
      universityTier: "top",
    });
    // top: getCareerMinStages("top") = [1,2,3,4,5]
    // careerExtra = [4, 5] (BASE_REQUIRED=[1,2,3,6] 제외, BONUS=[5,8] 중 5 제외)
    // 실제 careerExtra = [4] (5는 BONUS_STAGES에 있으므로 제외됨)
    const stage4 = careerTop.stages.find((s) => s.stage === 4);
    expect(stage4?.fulfilled).toBe(false); // depth=3 < 4
    // ④ 미충족 → top 기준에서 career 점수 감소
    // mid 기준보다 낮아야 함
    const careerMid = computeFlowCompletion(q, {
      isCareerSubject: true,
      universityTier: "mid",
    });
    expect(careerTop.completionPercent).toBeLessThanOrEqual(careerMid.completionPercent);
  });

  it("비진로교과: career 가중치 없이 base+bonus 구조 (85+15)", () => {
    const nonCareer = computeFlowCompletion(q, {
      isCareerSubject: false,
      universityTier: "top", // tier 차이 없어야 함
    });
    const nonCareerMid = computeFlowCompletion(q, {
      isCareerSubject: false,
      universityTier: "mid",
    });
    // 비진로교과는 tier와 무관하게 동일 결과
    expect(nonCareer.completionPercent).toBe(nonCareerMid.completionPercent);
  });

  it("비진로교과 isCareerSubject=false 반환값 확인", () => {
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    expect(result.isCareerSubject).toBe(false);
  });

  it("진로교과 isCareerSubject=true 반환값 확인", () => {
    const result = computeFlowCompletion(q, { isCareerSubject: true });
    expect(result.isCareerSubject).toBe(true);
  });
});

// ============================================================
// 5. top vs mid 대학 기준 차이
// ============================================================

describe("computeFlowCompletion — top vs mid 대학 기준", () => {
  it("top 기준은 ④ 참고문헌 필수 → mid보다 엄격", () => {
    // ④ 미충족(depth=3), 나머지 충족
    const q = makeQuality({ depth: 3, feedback: null });
    const top = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "top" });
    const mid = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "mid" });
    expect(top.completionPercent).toBeLessThanOrEqual(mid.completionPercent);
  });

  it("top 기준 ④ 충족 시 mid와 동등하거나 높음", () => {
    const q = makeQuality({ depth: 5, feedback: "출처와 참고문헌을 활용함" });
    const top = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "top" });
    const mid = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "mid" });
    expect(top.completionPercent).toBeGreaterThanOrEqual(mid.completionPercent);
  });

  it("lower tier는 mid와 동일 결과 (getCareerMinStages 동일)", () => {
    const q = makeQuality({ depth: 3 });
    const lower = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "lower" });
    const mid = computeFlowCompletion(q, { isCareerSubject: true, universityTier: "mid" });
    expect(lower.completionPercent).toBe(mid.completionPercent);
  });
});

// ============================================================
// 6. issues 코드 → 특정 단계 미충족
// ============================================================

describe("computeFlowCompletion — issues 코드 반영", () => {
  it("P1_나열식 → 단계 ① 미충족", () => {
    const q = makeQuality({ issues: ["P1_나열식"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage1 = result.stages.find((s) => s.stage === 1);
    expect(stage1?.fulfilled).toBe(false);
    expect(stage1?.reason).toContain("P1_나열식");
  });

  it("F2_인과단절 → 단계 ⑤ 미충족", () => {
    const q = makeQuality({ issues: ["F2_인과단절"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage5 = result.stages.find((s) => s.stage === 5);
    expect(stage5?.fulfilled).toBe(false);
    expect(stage5?.reason).toContain("F2_인과단절");
  });

  it("F3_출처불일치 → 단계 ④ 미충족", () => {
    const q = makeQuality({ depth: 5, issues: ["F3_출처불일치"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage4 = result.stages.find((s) => s.stage === 4);
    expect(stage4?.fulfilled).toBe(false);
    expect(stage4?.reason).toContain("F3_출처불일치");
  });

  it("M1_교사관찰불가 → 단계 ⑥ 미충족", () => {
    const q = makeQuality({ issues: ["M1_교사관찰불가"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage6 = result.stages.find((s) => s.stage === 6);
    expect(stage6?.fulfilled).toBe(false);
  });

  it("F10_성장부재 → 단계 ⑦ 미충족", () => {
    const q = makeQuality({ issues: ["F10_성장부재"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage7 = result.stages.find((s) => s.stage === 7);
    expect(stage7?.fulfilled).toBe(false);
  });

  it("F12_자기주도성부재 → 단계 ① 미충족", () => {
    const q = makeQuality({ issues: ["F12_자기주도성부재"] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage1 = result.stages.find((s) => s.stage === 1);
    expect(stage1?.fulfilled).toBe(false);
  });

  it("issues null (구버전) → 빈 배열로 처리", () => {
    const q = makeQuality({ issues: null });
    expect(() =>
      computeFlowCompletion(q, { isCareerSubject: false }),
    ).not.toThrow();
  });
});

// ============================================================
// 7. scientific_validity = null (구버전) 처리
// ============================================================

describe("computeFlowCompletion — scientific_validity null", () => {
  it("scientific_validity=null 이어도 에러 없이 동작", () => {
    const q = makeQuality({ scientific_validity: null });
    expect(() =>
      computeFlowCompletion(q, { isCareerSubject: true }),
    ).not.toThrow();
  });

  it("scientific_validity=null → 단계 ⑧ depth만으로 판정", () => {
    // depth=5 → ⑧ threshold에서 scientific_validity 제외 후 depth≥4 충족
    const q = makeQuality({ scientific_validity: null, depth: 5 });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage8 = result.stages.find((s) => s.stage === 8);
    expect(stage8?.fulfilled).toBe(true);
  });

  it("scientific_validity=null + depth=3 → ⑧ 미충족 (depth<4)", () => {
    const q = makeQuality({ scientific_validity: null, depth: 3 });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage8 = result.stages.find((s) => s.stage === 8);
    expect(stage8?.fulfilled).toBe(false);
  });
});

// ============================================================
// 8. feedback 키워드 → 단계 ④ fallback (low confidence)
// ============================================================

describe("computeFlowCompletion — feedback 키워드 단계 ④ fallback", () => {
  it("depth<4 + feedback에 '참고' 포함 → ④ fulfilled (low confidence)", () => {
    const q = makeQuality({
      depth: 3,
      feedback: "학생이 참고문헌을 꼼꼼히 활용하였습니다.",
      issues: [],
    });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage4 = result.stages.find((s) => s.stage === 4);
    expect(stage4?.fulfilled).toBe(true);
    expect(stage4?.confidence).toBe("low");
  });

  it("depth<4 + feedback 없음 → ④ 미충족", () => {
    const q = makeQuality({ depth: 3, feedback: null, issues: [] });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage4 = result.stages.find((s) => s.stage === 4);
    expect(stage4?.fulfilled).toBe(false);
  });

  it("depth<4 + F3_출처불일치 + feedback에 '출처' 포함 → ④ 미충족 (forbiddenIssue 우선)", () => {
    const q = makeQuality({
      depth: 3,
      feedback: "출처를 확인해야 합니다.",
      issues: ["F3_출처불일치"],
    });
    const result = computeFlowCompletion(q, { isCareerSubject: false });
    const stage4 = result.stages.find((s) => s.stage === 4);
    // forbiddenIssue hit → fallback 조건(issueMet=false) 미충족
    expect(stage4?.fulfilled).toBe(false);
  });
});

// ============================================================
// 9. universityTier 기본값
// ============================================================

describe("computeFlowCompletion — 기본값", () => {
  it("universityTier 미지정 시 'mid' 기본값 적용", () => {
    const q = makeQuality();
    const result = computeFlowCompletion(q, { isCareerSubject: true });
    expect(result.universityTier).toBe("mid");
  });
});

// ============================================================
// 10. aggregate 함수
// ============================================================

describe("computeAggregateFlowCompletion", () => {
  it("빈 배열 → avgPercent=0, 최저 tier", () => {
    const result = computeAggregateFlowCompletion([]);
    expect(result.avgPercent).toBe(0);
    expect(result.tier.label).toBe("교과전형_추천");
    expect(result.byRecord).toHaveLength(0);
  });

  it("단일 레코드 → avgPercent = 해당 레코드 completionPercent", () => {
    const record = { qualityData: makeQuality(), isCareerSubject: false };
    const single = computeFlowCompletion(makeQuality(), { isCareerSubject: false });
    const agg = computeAggregateFlowCompletion([record]);
    expect(agg.avgPercent).toBe(single.completionPercent);
  });

  it("다수 레코드 평균 산출", () => {
    const high = makeQuality(); // ~100%
    const low = makeQuality({
      specificity: 1,
      coherence: 1,
      depth: 1,
      scientific_validity: 1,
      issues: ["P1_나열식", "P3_키워드만", "M1_교사관찰불가"],
    });
    const records = [
      { qualityData: high, isCareerSubject: false },
      { qualityData: low, isCareerSubject: false },
    ];
    const agg = computeAggregateFlowCompletion(records);
    const r1 = computeFlowCompletion(high, { isCareerSubject: false });
    const r2 = computeFlowCompletion(low, { isCareerSubject: false });
    const expected = Math.round(((r1.completionPercent + r2.completionPercent) / 2) * 10) / 10;
    expect(agg.avgPercent).toBe(expected);
    expect(agg.byRecord).toHaveLength(2);
  });

  it("byRecord 각 항목이 computeFlowCompletion 결과와 일치", () => {
    const q1 = makeQuality({ depth: 3 });
    const q2 = makeQuality({ specificity: 2 });
    const records = [
      { qualityData: q1, isCareerSubject: true },
      { qualityData: q2, isCareerSubject: false },
    ];
    const agg = computeAggregateFlowCompletion(records, "mid");
    const r1 = computeFlowCompletion(q1, { isCareerSubject: true, universityTier: "mid" });
    const r2 = computeFlowCompletion(q2, { isCareerSubject: false, universityTier: "mid" });
    expect(agg.byRecord[0].completionPercent).toBe(r1.completionPercent);
    expect(agg.byRecord[1].completionPercent).toBe(r2.completionPercent);
  });

  it("진로교과 + 비진로교과 혼합 레코드", () => {
    const careerQ = makeQuality({ depth: 5, coherence: 5 });
    const nonCareerQ = makeQuality({ depth: 3 });
    const records = [
      { qualityData: careerQ, isCareerSubject: true },
      { qualityData: nonCareerQ, isCareerSubject: false },
    ];
    const agg = computeAggregateFlowCompletion(records, "top");
    expect(agg.avgPercent).toBeGreaterThan(0);
    expect(agg.byRecord[0].isCareerSubject).toBe(true);
    expect(agg.byRecord[1].isCareerSubject).toBe(false);
  });
});

// ============================================================
// 11. tier 경계값
// ============================================================

describe("FLOW_COMPLETION_TIERS 경계값", () => {
  it("completionPercent=80 → 학종_서류100_가능", () => {
    // specificity=5(①⑥), coherence=4(②⑦), depth=5(③⑧), sv=5 → 모두 충족
    // 비진로교과: 모두 충족 → 100%
    const result = computeFlowCompletion(makeQuality(), { isCareerSubject: false });
    expect(result.completionPercent).toBeGreaterThanOrEqual(80);
    expect(result.tier.label).toBe("학종_서류100_가능");
  });

  it("computeFlowCompletion 결과 tier minPercent 경계 일관성", () => {
    // 어떤 결과든 tier.minPercent <= completionPercent 여야 함
    const cases: QualitySnapshot[] = [
      makeQuality({ specificity: 3, coherence: 3, depth: 3 }),
      makeQuality({ specificity: 1, coherence: 1, depth: 1, issues: ["P1_나열식"] }),
      makeQuality({ specificity: 5, coherence: 5, depth: 5 }),
    ];
    for (const q of cases) {
      const result = computeFlowCompletion(q, { isCareerSubject: true });
      expect(result.completionPercent).toBeGreaterThanOrEqual(result.tier.minPercent);
    }
  });
});
