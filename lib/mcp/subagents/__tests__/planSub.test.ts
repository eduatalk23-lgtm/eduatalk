// ============================================
// Phase G S-3-a: plan-sub 정의 — 계약 테스트
// `buildTools` 는 30+ 서버 전용 모듈에 의존하므로 orchestrator.test.ts 와
// 동일한 mock 세트가 필요. 여기서는 metadata + schema + systemPrompt 만 검증.
// buildTools 의 포함/격리는 plan-sub.ts 소스 레벨 주석으로 강제.
// ============================================

import { describe, it, expect, vi } from "vitest";

// plan-sub 은 agent tool factory 를 import 하므로 server-only 를 무력화.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { planSub } from "../plan-sub";
import type { AgentContext } from "@/lib/agents/types";

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "user-1",
    role: "admin",
    tenantId: "tenant-1",
    studentId: "student-1",
    studentName: "김세린",
    schoolYear: 2026,
    uiState: null,
    studentGrade: 2,
    schoolName: "인제고",
    schoolCategory: "general",
    targetMajor: "국제통상학",
    curriculumRevision: "2015 개정",
    ...overrides,
  };
}

describe("plan-sub 정의", () => {
  it("기본 메타데이터", () => {
    expect(planSub.name).toBe("plan-sub");
    expect(planSub.description.length).toBeGreaterThan(30);
    expect(planSub.maxSteps).toBeGreaterThan(0);
    expect(planSub.timeoutMs).toBeLessThanOrEqual(60_000);
  });

  it("allowedRoles 는 학생·학부모를 제외한다", () => {
    expect(planSub.allowedRoles).toContain("admin");
    expect(planSub.allowedRoles).toContain("consultant");
    expect(planSub.allowedRoles).toContain("superadmin");
    expect(planSub.allowedRoles).not.toContain("student");
    expect(planSub.allowedRoles).not.toContain("parent");
  });

  it("model.provider 는 gemini 또는 openai", () => {
    expect(["gemini", "openai"]).toContain(planSub.model.provider);
    expect(planSub.model.id.length).toBeGreaterThan(0);
  });

  it("buildSystemPrompt 는 학생 정보를 포함한다", () => {
    const prompt = planSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("김세린");
    expect(prompt).toContain("2학년");
    expect(prompt).toContain("국제통상학");
    expect(prompt).toContain("수강 계획");
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("buildSystemPrompt 가 summarySchema 용 출력 규율을 안내한다", () => {
    const prompt = planSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("headline");
    expect(prompt).toContain("keyFindings");
    expect(prompt).toContain("conflicts");
    expect(prompt).toContain("recommendedCourses");
    expect(prompt).toContain("recommendedActions");
  });
});

describe("plan-sub summarySchema", () => {
  it("정상 입력 파싱", () => {
    const parsed = planSub.summarySchema.parse({
      headline: "경영 계열 적합도 72점, 2학년 과부하 충돌 해결 필요",
      adequacyScore: 72,
      keyFindings: ["강점: 수학 이수 완료", "약점: 경제 미이수"],
      conflicts: ["2학년 1학기 진로선택 4과목 초과"],
      recommendedCourses: ["경제", "정치와 법"],
      recommendedActions: ["2학년 2학기로 경제 이동"],
      artifactIds: [],
    });
    expect(parsed.adequacyScore).toBe(72);
    expect(parsed.recommendedCourses).toContain("경제");
  });

  it("adequacyScore / followUpQuestions 는 선택 필드", () => {
    const parsed = planSub.summarySchema.parse({
      headline: "정상 헤드라인입니다",
      keyFindings: [],
      conflicts: [],
      recommendedCourses: [],
      recommendedActions: [],
      artifactIds: ["plan:abc-123"],
      followUpQuestions: ["Q1?"],
    });
    expect(parsed.adequacyScore).toBeUndefined();
    expect(parsed.followUpQuestions).toEqual(["Q1?"]);
  });

  it("adequacyScore 는 0~100 범위", () => {
    expect(() =>
      planSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        adequacyScore: 120,
        keyFindings: [],
        conflicts: [],
        recommendedCourses: [],
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("conflicts 6개 이상이면 실패", () => {
    expect(() =>
      planSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        keyFindings: [],
        conflicts: Array.from({ length: 6 }).map(
          (_, i) => `충돌 ${i} 상세 내용 서술`,
        ),
        recommendedCourses: [],
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("recommendedCourses 11개 이상이면 실패", () => {
    expect(() =>
      planSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        keyFindings: [],
        conflicts: [],
        recommendedCourses: Array.from({ length: 11 }).map(
          (_, i) => `과목${i}`,
        ),
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("recommendedActions 4개 이상이면 실패", () => {
    expect(() =>
      planSub.summarySchema.parse({
        headline: "긴 헤드라인입니다",
        keyFindings: [],
        conflicts: [],
        recommendedCourses: [],
        recommendedActions: [
          "액션1 상세",
          "액션2 상세",
          "액션3 상세",
          "액션4 상세",
        ],
        artifactIds: [],
      }),
    ).toThrow();
  });
});
