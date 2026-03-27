import { describe, it, expect } from "vitest";
import {
  PIPELINE_TASK_KEYS,
  PIPELINE_TASK_DEPENDENTS,
  computeCascadeResetKeys,
  type PipelineTaskKey,
} from "../pipeline-types";

describe("PIPELINE_TASK_KEYS", () => {
  it("12개 태스크가 정의되어 있어야 한다", () => {
    expect(PIPELINE_TASK_KEYS).toHaveLength(12);
  });

  it("Phase 1 순서: competency → storyline → edge", () => {
    const idx = (k: PipelineTaskKey) => PIPELINE_TASK_KEYS.indexOf(k);
    expect(idx("competency_analysis")).toBeLessThan(idx("storyline_generation"));
    expect(idx("storyline_generation")).toBeLessThan(idx("edge_computation"));
  });

  it("Phase 1이 Phase 2보다 먼저 정의", () => {
    const idx = (k: PipelineTaskKey) => PIPELINE_TASK_KEYS.indexOf(k);
    expect(idx("edge_computation")).toBeLessThan(idx("ai_diagnosis"));
    expect(idx("edge_computation")).toBeLessThan(idx("course_recommendation"));
  });
});

describe("PIPELINE_TASK_DEPENDENTS", () => {
  it("competency_analysis 재실행 시 하류 9개 태스크 리셋", () => {
    const deps = PIPELINE_TASK_DEPENDENTS.competency_analysis!;
    expect(deps).toHaveLength(9);
    expect(deps).toContain("storyline_generation");
    expect(deps).toContain("guide_matching");
    expect(deps).toContain("roadmap_generation");
  });

  it("ai_diagnosis 재실행 시 setek_guide, ai_strategy, interview, roadmap 리셋", () => {
    const deps = PIPELINE_TASK_DEPENDENTS.ai_diagnosis!;
    expect(deps).toContain("setek_guide");
    expect(deps).toContain("ai_strategy");
    expect(deps).toContain("interview_generation");
    expect(deps).toContain("roadmap_generation");
  });

  it("edge_computation 재실행 시 ai_diagnosis, setek_guide, activity_summary 리셋", () => {
    const deps = PIPELINE_TASK_DEPENDENTS.edge_computation!;
    expect(deps).toContain("ai_diagnosis");
    expect(deps).toContain("setek_guide");
    expect(deps).toContain("activity_summary");
  });

  it("독립 태스크(course_recommendation 등)에는 하류 의존이 없다", () => {
    expect(PIPELINE_TASK_DEPENDENTS.course_recommendation).toBeUndefined();
    expect(PIPELINE_TASK_DEPENDENTS.bypass_analysis).toBeUndefined();
  });

  it("guide_matching 재실행 시 setek_guide, activity_summary, roadmap 리셋", () => {
    const deps = PIPELINE_TASK_DEPENDENTS.guide_matching!;
    expect(deps).toContain("setek_guide");
    expect(deps).toContain("activity_summary");
    expect(deps).toContain("roadmap_generation");
  });

  it("모든 의존 키가 유효한 PIPELINE_TASK_KEYS여야 한다", () => {
    for (const [, deps] of Object.entries(PIPELINE_TASK_DEPENDENTS)) {
      for (const dep of deps!) {
        expect(PIPELINE_TASK_KEYS).toContain(dep);
      }
    }
  });
});

describe("computeCascadeResetKeys", () => {
  it("단일 독립 태스크 → 본인만 리셋", () => {
    const result = computeCascadeResetKeys(["course_recommendation"]);
    expect(result).toEqual(new Set(["course_recommendation"]));
  });

  it("competency_analysis → 전체 9+1=10개 리셋", () => {
    const result = computeCascadeResetKeys(["competency_analysis"]);
    expect(result.size).toBe(10);
    expect(result.has("competency_analysis")).toBe(true);
    expect(result.has("guide_matching")).toBe(true);
    expect(result.has("roadmap_generation")).toBe(true);
    // course_recommendation, bypass_analysis은 독립
    expect(result.has("course_recommendation")).toBe(false);
    expect(result.has("bypass_analysis")).toBe(false);
  });

  it("ai_diagnosis → 본인 + 하류 4개 = 5개", () => {
    const result = computeCascadeResetKeys(["ai_diagnosis"]);
    expect(result.size).toBe(5);
    expect(result.has("ai_diagnosis")).toBe(true);
    expect(result.has("setek_guide")).toBe(true);
    expect(result.has("roadmap_generation")).toBe(true);
  });

  it("다중 태스크 입력 → 합집합 (중복 제거)", () => {
    const result = computeCascadeResetKeys(["edge_computation", "ai_diagnosis"]);
    // edge_computation: ai_diagnosis, setek_guide, activity_summary
    // ai_diagnosis: setek_guide, ai_strategy, interview_generation, roadmap_generation
    // 합: edge_computation, ai_diagnosis, setek_guide, activity_summary, ai_strategy, interview_generation, roadmap_generation
    expect(result.size).toBe(7);
    expect(result.has("edge_computation")).toBe(true);
    expect(result.has("activity_summary")).toBe(true);
    expect(result.has("ai_strategy")).toBe(true);
  });

  it("빈 입력 → 빈 셋", () => {
    const result = computeCascadeResetKeys([]);
    expect(result.size).toBe(0);
  });

  it("roadmap_generation 재실행 → 본인만 (리프 노드)", () => {
    const result = computeCascadeResetKeys(["roadmap_generation"]);
    expect(result).toEqual(new Set(["roadmap_generation"]));
  });
});
