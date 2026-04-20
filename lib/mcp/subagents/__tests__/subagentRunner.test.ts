// ============================================
// Phase G S-1: subagentRunner — 경계 테스트
// 실제 LLM 호출 없이 role / tenantId / init 가드만 검증.
// ============================================

import { describe, it, expect } from "vitest";
import { z } from "zod";

import { runSubagent } from "../_shared/subagentRunner";
import type { SubagentDefinition } from "../_shared/subagentTypes";
import type { AgentContext } from "@/lib/agents/types";

const NOOP_SCHEMA = z.object({
  headline: z.string(),
  keyFindings: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  artifactIds: z.array(z.string()),
  followUpQuestions: z.array(z.string()).optional(),
});

function makeDef(
  overrides: Partial<SubagentDefinition<typeof NOOP_SCHEMA>> = {},
): SubagentDefinition<typeof NOOP_SCHEMA> {
  return {
    name: "record-sub",
    description: "test",
    buildSystemPrompt: () => "system",
    buildTools: () => ({}),
    model: { provider: "openai", id: "gpt-4o-mini" },
    maxSteps: 1,
    timeoutMs: 100,
    allowedRoles: ["admin", "consultant", "superadmin"],
    summarySchema: NOOP_SCHEMA,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "user-1",
    role: "admin",
    tenantId: "tenant-1",
    studentId: "student-1",
    studentName: "테스트학생",
    schoolYear: 2026,
    uiState: null,
    ...overrides,
  };
}

describe("runSubagent role 가드", () => {
  it("allowedRoles 에 없는 role 은 ok:false 를 반환한다", async () => {
    const def = makeDef();
    const ctx = makeCtx({ role: "student" as AgentContext["role"] });
    const result = await runSubagent({ def, ctx, input: "테스트" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.runId).toBeNull();
      expect(result.reason).toContain("접근 권한");
    }
  });

  it("parent role 도 거부한다", async () => {
    const def = makeDef({ allowedRoles: ["admin", "superadmin"] });
    const ctx = makeCtx({ role: "consultant" });
    const result = await runSubagent({ def, ctx, input: "테스트" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/consultant/);
  });

  it("admin role 은 1차 가드를 통과한다 (이후 init/LLM 은 별도 경로)", async () => {
    const def = makeDef({
      // init 가 즉시 에러를 던지게 해 LLM 호출까지 가지 않게 한다
      buildTools: () => {
        throw new Error("__test_init_fail__");
      },
    });
    const ctx = makeCtx({ role: "admin" });
    const result = await runSubagent({ def, ctx, input: "테스트" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // runId 는 발급되어야 함 (INSERT 는 실패해도 UUID 는 생성)
      expect(result.runId).toBeTypeOf("string");
      expect(result.reason).toContain("초기화 실패");
    }
  });
});

describe("runSubagent tenantId 가드", () => {
  it("tenantId=null 이면 즉시 ok:false", async () => {
    const def = makeDef();
    const ctx = makeCtx({ tenantId: null });
    const result = await runSubagent({ def, ctx, input: "테스트" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.runId).toBeNull();
      expect(result.reason).toContain("테넌트");
    }
  });
});

describe("SubagentDefinition 계약", () => {
  it("summarySchema 는 headline/keyFindings/recommendedActions/artifactIds 를 포함해야 한다", () => {
    const parsed = NOOP_SCHEMA.parse({
      headline: "h",
      keyFindings: ["a"],
      recommendedActions: ["r"],
      artifactIds: [],
    });
    expect(parsed.headline).toBe("h");
    expect(parsed.followUpQuestions).toBeUndefined();
  });

  it("summarySchema followUpQuestions 는 선택 필드", () => {
    const parsed = NOOP_SCHEMA.parse({
      headline: "h",
      keyFindings: [],
      recommendedActions: [],
      artifactIds: [],
      followUpQuestions: ["q1"],
    });
    expect(parsed.followUpQuestions).toEqual(["q1"]);
  });
});
