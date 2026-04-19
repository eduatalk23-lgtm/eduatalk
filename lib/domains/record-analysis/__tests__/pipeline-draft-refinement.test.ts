// ============================================
// Phase 5 Sprint 1: P9 draft_refinement 유닛 테스트
//
// 커버리지:
//   - 프롬프트 빌더 3종 (세특/창체/행특) — 5축 점수 + issues + feedback 섹션
//   - axisScores.scientificValidity null → 라인 생략
//   - 빈 issues → "없음" 플레이스홀더
//   - runner feature flag 체크 (disabled 시 DB/LLM 호출 없이 즉시 반환)
//
// 풀 runner 통합(rollback, DB update)은 Sprint 2 E2E 검증에서 진행.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  buildSetekRefinementUserPrompt,
  buildChangcheRefinementUserPrompt,
  buildHaengteukRefinementUserPrompt,
  type RefinementUserPromptInput,
} from "../llm/prompts/draft-refinement-prompts";

const BASE_INPUT: RefinementUserPromptInput = {
  originalUserPrompt: "## 과목: 수학 (2학년)\n재생성 요청: 이전 가안의 품질을 개선해주세요.",
  previousDraft: "통계 탐구를 하였다. 확률에 대해 공부하였다.",
  issues: ["P1_나열식", "F10_성장부재"],
  feedback: "구체적인 사례가 부족하여 나열식으로 보입니다.",
  axisScores: {
    specificity: 2,
    coherence: 3,
    depth: 2,
    grammar: 5,
    scientificValidity: 3,
  },
};

describe("draft-refinement-prompts 빌더", () => {
  it("세특 빌더: 원본 user prompt + 이전 가안 + 약점 + 개선 지시 섹션 모두 포함", () => {
    const prompt = buildSetekRefinementUserPrompt(BASE_INPUT);
    expect(prompt).toContain("## 과목: 수학 (2학년)");
    expect(prompt).toContain("이전 가안 (재생성 필요)");
    expect(prompt).toContain("통계 탐구를 하였다");
    expect(prompt).toContain("지적된 약점");
    expect(prompt).toContain("5축 점수");
    expect(prompt).toContain("P1_나열식, F10_성장부재");
    expect(prompt).toContain("구체적인 사례가 부족");
    expect(prompt).toContain("개선 지시");
    expect(prompt).toContain("원본 대비 품질이 반드시 향상");
  });

  it("창체·행특 빌더도 동일 공통 섹션 적용", () => {
    const changche = buildChangcheRefinementUserPrompt(BASE_INPUT);
    const haengteuk = buildHaengteukRefinementUserPrompt(BASE_INPUT);
    for (const p of [changche, haengteuk]) {
      expect(p).toContain("이전 가안 (재생성 필요)");
      expect(p).toContain("지적된 약점");
      expect(p).toContain("개선 지시");
    }
  });

  it("5축 점수 표시: 전체 4축 + scientificValidity 포함", () => {
    const prompt = buildSetekRefinementUserPrompt(BASE_INPUT);
    expect(prompt).toContain("구체성(specificity): 2/5");
    expect(prompt).toContain("일관성(coherence): 3/5");
    expect(prompt).toContain("심화도(depth): 2/5");
    expect(prompt).toContain("문법(grammar): 5/5");
    expect(prompt).toContain("학술정합(scientificValidity): 3/5");
  });

  it("scientificValidity 가 null 이면 학술정합 라인 생략", () => {
    const withoutSci: RefinementUserPromptInput = {
      ...BASE_INPUT,
      axisScores: { ...BASE_INPUT.axisScores, scientificValidity: null },
    };
    const prompt = buildSetekRefinementUserPrompt(withoutSci);
    expect(prompt).not.toContain("scientificValidity");
    expect(prompt).toContain("문법(grammar): 5/5");
  });

  it("빈 issues 배열 → 문제 코드 '없음' 플레이스홀더", () => {
    const emptyIssues: RefinementUserPromptInput = { ...BASE_INPUT, issues: [] };
    const prompt = buildSetekRefinementUserPrompt(emptyIssues);
    expect(prompt).toContain("문제 코드: 없음");
  });

  it("빈 feedback → '없음' 플레이스홀더", () => {
    const emptyFeedback: RefinementUserPromptInput = { ...BASE_INPUT, feedback: "" };
    const prompt = buildSetekRefinementUserPrompt(emptyFeedback);
    expect(prompt).toContain("피드백: 없음");
  });
});

// ============================================
// runner feature flag 체크 (DB/LLM 호출 없이 즉시 반환)
// ============================================

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("../pipeline/pipeline-executor", () => ({
  touchPipelineHeartbeat: vi.fn(),
}));

describe("runDraftRefinementChunkForGrade — feature flag off 동작", () => {
  const originalFlag = process.env.ENABLE_DRAFT_REFINEMENT;

  beforeEach(() => {
    delete process.env.ENABLE_DRAFT_REFINEMENT;
  });

  afterEach(() => {
    if (originalFlag == null) delete process.env.ENABLE_DRAFT_REFINEMENT;
    else process.env.ENABLE_DRAFT_REFINEMENT = originalFlag;
  });

  it("flag 미설정 시 preview='disabled' + result.enabled=false 반환", async () => {
    const { runDraftRefinementChunkForGrade } = await import(
      "../pipeline/pipeline-task-runners-draft-refinement"
    );

    const ctx = {
      pipelineType: "grade" as const,
      pipelineId: "test-pipeline",
      studentId: "stu-1",
      tenantId: "tnt-1",
      studentGrade: 2,
      targetGrade: 2,
      resolvedRecords: { 2: { hasAnyNeis: false } },
      tasks: {},
      previews: {},
      results: {},
      errors: {},
      supabase: {} as never,
    } as never;

    const out = await runDraftRefinementChunkForGrade(ctx, 4);
    expect(out.preview).toBe("disabled");
    expect(out.result.enabled).toBe(false);
    expect(out.result.processed).toBe(0);
    expect(out.hasMore).toBe(false);
    expect(out.totalUncached).toBe(0);
  });

  it("flag='false' 문자열도 off 로 처리 (=== 'true' 엄격 비교)", async () => {
    process.env.ENABLE_DRAFT_REFINEMENT = "false";

    const { runDraftRefinementChunkForGrade } = await import(
      "../pipeline/pipeline-task-runners-draft-refinement"
    );

    const ctx = {
      pipelineType: "grade" as const,
      pipelineId: "test-pipeline",
      studentId: "stu-1",
      tenantId: "tnt-1",
      studentGrade: 2,
      targetGrade: 2,
      resolvedRecords: { 2: { hasAnyNeis: false } },
      tasks: {},
      previews: {},
      results: {},
      errors: {},
      supabase: {} as never,
    } as never;

    const out = await runDraftRefinementChunkForGrade(ctx, 4);
    expect(out.result.enabled).toBe(false);
  });
});
