// ============================================
// buildMidPlanSynthesisSection 회귀 테스트
// β 격차 1: MidPlan → S3 진단 / S5 전략 프롬프트 섹션 빌더
// ============================================

import { describe, it, expect } from "vitest";
import { buildMidPlanSynthesisSection } from "../llm/mid-plan-guide-section";
import type { MidPlan } from "../pipeline/orient/mid-pipeline-planner";

const BASE_PLAN: MidPlan = {
  source: "llm",
  focusHypothesis: "의생명공학 방향 — 세포생물학 + 화학 탐구 연계가 핵심 축",
  concernFlags: ["수학 탐구 근거 부족", "물리 세특 나열식 구성"],
  recordPriorityOverride: { "abc123": 80, "def456": 55 },
  rationale: ["생명과학 세특 A+ 일관", "화학 탐구 3건 반복"],
};

describe("buildMidPlanSynthesisSection", () => {
  it("focusHypothesis 있을 때 헤더와 가설 텍스트가 포함된다", () => {
    const section = buildMidPlanSynthesisSection(BASE_PLAN);
    expect(section).toBeDefined();
    expect(section).toContain("## 컨설턴트 메타 판정");
    expect(section).toContain("의생명공학 방향");
    expect(section).toContain("핵심 탐구 축");
  });

  it("concernFlags가 있으면 우려 플래그 섹션이 포함된다", () => {
    const section = buildMidPlanSynthesisSection(BASE_PLAN);
    expect(section).toContain("우려 플래그");
    expect(section).toContain("수학 탐구 근거 부족");
    expect(section).toContain("물리 세특 나열식 구성");
  });

  it("recordPriorityOverride는 synthesis 섹션에 포함되지 않는다 (가이드 전용)", () => {
    const section = buildMidPlanSynthesisSection(BASE_PLAN);
    expect(section).not.toContain("abc123");
    expect(section).not.toContain("우선 보강 레코드");
  });

  it("rationale이 있으면 판정 근거 섹션이 포함된다", () => {
    const section = buildMidPlanSynthesisSection(BASE_PLAN);
    expect(section).toContain("판정 근거");
    expect(section).toContain("생명과학 세특 A+ 일관");
  });

  it("midPlan이 undefined이면 undefined 반환 (no-op)", () => {
    expect(buildMidPlanSynthesisSection(undefined)).toBeUndefined();
  });

  it("midPlan이 null이면 undefined 반환", () => {
    expect(buildMidPlanSynthesisSection(null)).toBeUndefined();
  });

  it("focusHypothesis가 빈 문자열이면 undefined 반환", () => {
    const plan: MidPlan = { ...BASE_PLAN, focusHypothesis: "" };
    expect(buildMidPlanSynthesisSection(plan)).toBeUndefined();
  });

  it("focusHypothesis가 undefined이면 undefined 반환 (concernFlags만 있어도 생략)", () => {
    const plan: MidPlan = {
      source: "llm",
      focusHypothesis: undefined,
      concernFlags: ["플래그 있음"],
      rationale: ["근거"],
    };
    expect(buildMidPlanSynthesisSection(plan)).toBeUndefined();
  });

  it("concernFlags가 빈 배열이면 우려 플래그 섹션이 생략된다", () => {
    const plan: MidPlan = { ...BASE_PLAN, concernFlags: [] };
    const section = buildMidPlanSynthesisSection(plan);
    expect(section).toBeDefined();
    expect(section).not.toContain("우려 플래그");
  });

  it("마지막 지침 문장에 진단/전략 방향 안내가 포함된다", () => {
    const section = buildMidPlanSynthesisSection(BASE_PLAN)!;
    expect(section).toContain("진단/전략 방향");
    expect(section).toContain("우려 사항");
  });
});
