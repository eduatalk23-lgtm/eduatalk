// ============================================
// Phase G S-3-b: admission-sub 정의 — 계약 테스트
// `buildTools` 는 서버 전용 모듈에 의존하므로 orchestrator.test.ts 와 동일한
// mock 세트가 필요. 여기서는 metadata + schema + systemPrompt 만 검증.
// buildTools 의 포함/격리는 admission-sub.ts 소스 레벨 주석으로 강제.
// ============================================

import { describe, it, expect, vi } from "vitest";

// admission-sub 은 agent tool factory 를 import 하므로 server-only 를 무력화.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { admissionSub } from "../admission-sub";
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
    studentGrade: 3,
    schoolName: "인제고",
    schoolCategory: "general",
    targetMajor: "경영학",
    curriculumRevision: "2015 개정",
    ...overrides,
  };
}

describe("admission-sub 정의", () => {
  it("기본 메타데이터", () => {
    expect(admissionSub.name).toBe("admission-sub");
    expect(admissionSub.description.length).toBeGreaterThan(30);
    expect(admissionSub.maxSteps).toBeGreaterThanOrEqual(16);
    expect(admissionSub.timeoutMs).toBeLessThanOrEqual(60_000);
  });

  it("allowedRoles 는 학생·학부모를 제외한다", () => {
    expect(admissionSub.allowedRoles).toContain("admin");
    expect(admissionSub.allowedRoles).toContain("consultant");
    expect(admissionSub.allowedRoles).toContain("superadmin");
    expect(admissionSub.allowedRoles).not.toContain("student");
    expect(admissionSub.allowedRoles).not.toContain("parent");
  });

  it("model.provider 는 gemini 또는 openai", () => {
    expect(["gemini", "openai"]).toContain(admissionSub.model.provider);
    expect(admissionSub.model.id.length).toBeGreaterThan(0);
  });

  it("buildSystemPrompt 는 학생 정보를 포함한다", () => {
    const prompt = admissionSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("김세린");
    expect(prompt).toContain("3학년");
    expect(prompt).toContain("경영학");
    expect(prompt).toContain("배치");
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("buildSystemPrompt 가 summarySchema 용 출력 규율을 안내한다", () => {
    const prompt = admissionSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("headline");
    expect(prompt).toContain("recommendedUniversities");
    expect(prompt).toContain("strategyNotes");
    expect(prompt).toContain("warnings");
    expect(prompt).toContain("recommendedActions");
  });

  it("buildSystemPrompt 가 6장 배분·면접·교차지원 조합 패턴을 안내한다", () => {
    const prompt = admissionSub.buildSystemPrompt(makeCtx());
    expect(prompt).toContain("runPlacementAnalysis");
    expect(prompt).toContain("generateInterviewQuestions");
    expect(prompt).toContain("runBypassAnalysis");
    expect(prompt).toContain("simulateMinScoreRequirement");
  });
});

describe("admission-sub summarySchema", () => {
  it("정상 입력 파싱", () => {
    const parsed = admissionSub.summarySchema.parse({
      headline: "상향 2·적정 3·안전 1 구성, 고려대 경영 우선권",
      recommendedUniversities: ["고려대 경영", "연세대 경영", "성균관대 글로벌경영"],
      keyFindings: ["상향 2장 고려대/연세대", "수능최저 5합 9 충족"],
      strategyNotes: ["면접 대비: 고려대 학업우수형 집중"],
      warnings: ["2023 예측 정확도 78% — 보수적 판단 권장"],
      recommendedActions: ["6장 배분 최종 확정 전 교차지원 1건 추가 검토"],
      artifactIds: ["placement:abc-123"],
    });
    expect(parsed.recommendedUniversities).toContain("고려대 경영");
    expect(parsed.warnings).toHaveLength(1);
  });

  it("followUpQuestions 는 선택 필드", () => {
    const parsed = admissionSub.summarySchema.parse({
      headline: "정상 헤드라인입니다",
      recommendedUniversities: [],
      keyFindings: [],
      strategyNotes: [],
      warnings: [],
      recommendedActions: [],
      artifactIds: [],
      followUpQuestions: ["연세대 면접 형식 확인?"],
    });
    expect(parsed.followUpQuestions).toEqual(["연세대 면접 형식 확인?"]);
  });

  it("recommendedUniversities 11개 이상이면 실패", () => {
    expect(() =>
      admissionSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        recommendedUniversities: Array.from({ length: 11 }).map(
          (_, i) => `대학${i}`,
        ),
        keyFindings: [],
        strategyNotes: [],
        warnings: [],
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("warnings 6개 이상이면 실패", () => {
    expect(() =>
      admissionSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        recommendedUniversities: [],
        keyFindings: [],
        strategyNotes: [],
        warnings: Array.from({ length: 6 }).map(
          (_, i) => `주의 ${i} 상세 내용 서술`,
        ),
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });

  it("recommendedActions 4개 이상이면 실패", () => {
    expect(() =>
      admissionSub.summarySchema.parse({
        headline: "정상 헤드라인입니다",
        recommendedUniversities: [],
        keyFindings: [],
        strategyNotes: [],
        warnings: [],
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

  it("headline 너무 짧으면 실패", () => {
    expect(() =>
      admissionSub.summarySchema.parse({
        headline: "짧",
        recommendedUniversities: [],
        keyFindings: [],
        strategyNotes: [],
        warnings: [],
        recommendedActions: [],
        artifactIds: [],
      }),
    ).toThrow();
  });
});
