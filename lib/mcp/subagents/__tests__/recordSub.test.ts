// ============================================
// Phase G S-1: record-sub 정의 — 계약 테스트
// `buildTools` 는 30+ 서버 전용 모듈에 의존하므로 orchestrator.test.ts 와
// 동일한 mock 세트가 필요. 여기서는 metadata + schema + systemPrompt 만 검증.
// buildTools 의 포함/격리는 record-sub.ts 소스 레벨 주석으로 강제.
// ============================================

import { describe, it, expect, vi } from "vitest";

// record-sub 은 agent tool factory 를 모두 import 하므로 server-only 를 무력화.
// buildTools 를 직접 호출하지 않으므로 하위 의존 모듈은 최소 mock 만 둔다.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { recordSub } from "../record-sub";
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

describe("record-sub 정의", () => {
  it("기본 메타데이터", () => {
    expect(recordSub.name).toBe("record-sub");
    expect(recordSub.description.length).toBeGreaterThan(30);
    expect(recordSub.maxSteps).toBeGreaterThan(0);
    expect(recordSub.timeoutMs).toBeLessThanOrEqual(60_000);
  });

  it("allowedRoles 는 학생·학부모를 제외한다", () => {
    expect(recordSub.allowedRoles).toContain("admin");
    expect(recordSub.allowedRoles).toContain("consultant");
    expect(recordSub.allowedRoles).toContain("superadmin");
    expect(recordSub.allowedRoles).not.toContain("student");
    expect(recordSub.allowedRoles).not.toContain("parent");
  });

  it("model.provider 는 gemini 또는 openai", () => {
    expect(["gemini", "openai"]).toContain(recordSub.model.provider);
    expect(recordSub.model.id.length).toBeGreaterThan(0);
  });

  it("buildSystemPrompt 는 학생 정보를 포함한다", () => {
    const prompt = recordSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("김세린");
    expect(prompt).toContain("2학년");
    expect(prompt).toContain("국제통상학");
    // 역할 규율이 들어있어야 한다
    expect(prompt).toContain("tool");
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("buildSystemPrompt 가 summarySchema 용 출력 규율을 안내한다", () => {
    const prompt = recordSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("headline");
    expect(prompt).toContain("keyFindings");
    expect(prompt).toContain("recommendedActions");
    expect(prompt).toContain("artifactIds");
  });
});

describe("record-sub summarySchema", () => {
  it("정상 입력 파싱", () => {
    const parsed = recordSub.summarySchema.parse({
      headline: "2학년 국어 세특의 과정 서술 강화가 1순위",
      keyFindings: ["강점: 수학 역량", "약점: 독서 기록 부족"],
      recommendedActions: ["독서 기록 2건 추가"],
      artifactIds: [],
    });
    expect(parsed.headline).toContain("세특");
  });

  it("followUpQuestions 는 선택 필드", () => {
    const parsed = recordSub.summarySchema.parse({
      headline: "정상 헤드라인입니다",
      keyFindings: [],
      recommendedActions: [],
      artifactIds: ["report:abc-123"],
      followUpQuestions: ["Q1?"],
    });
    expect(parsed.followUpQuestions).toEqual(["Q1?"]);
  });

  it("headline 너무 짧으면 실패", () => {
    expect(() =>
      recordSub.summarySchema.parse({
        headline: "짧",
        keyFindings: [],
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("keyFindings 6개 이상이면 실패", () => {
    expect(() =>
      recordSub.summarySchema.parse({
        headline: "긴 헤드라인입니다",
        keyFindings: Array.from({ length: 6 }).map(
          (_, i) => `finding-${i}-상세내용 서술`,
        ),
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("recommendedActions 4개 이상이면 실패", () => {
    expect(() =>
      recordSub.summarySchema.parse({
        headline: "긴 헤드라인입니다",
        keyFindings: [],
        recommendedActions: ["액션1 상세", "액션2 상세", "액션3 상세", "액션4 상세"],
        artifactIds: [],
      }),
    ).toThrow();
  });
});
