// ============================================
// Phase D-1 Sprint 1 — extractSchemaSummary 단위 테스트.
// `generateObject` mock 으로 성공/실패/토큰 추출 검증.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateObject: vi.fn(),
  };
});

import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { extractSchemaSummary } from "../schema-extractor";

const model = {} as unknown as LanguageModel;
const schema = z.object({
  headline: z.string(),
  count: z.number(),
});

describe("extractSchemaSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateObject 성공 → ok + object + usage", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { headline: "요약", count: 3 },
      usage: { inputTokens: 100, outputTokens: 20 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const result = await extractSchemaSummary({
      model,
      schema,
      prompt: "요약 대상 텍스트",
      timeoutMs: 5000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.object).toEqual({ headline: "요약", count: 3 });
      expect(result.usage).toEqual({ input: 100, output: 20 });
    }
  });

  it("generateObject 실패 → ok:false + reason", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("schema validation fail"));

    const result = await extractSchemaSummary({
      model,
      schema,
      prompt: "x",
      timeoutMs: 5000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("schema validation fail");
      expect(result.usage).toEqual({ input: 0, output: 0 });
    }
  });

  it("maxRetries 기본 1 / system 선택 인자 전달", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { headline: "x", count: 0 },
      usage: { inputTokens: 0, outputTokens: 0 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    await extractSchemaSummary({
      model,
      schema,
      system: "구조화 시스템",
      prompt: "본문",
      timeoutMs: 3000,
    });

    const arg = vi.mocked(generateObject).mock.calls[0][0];
    expect(arg.schema).toBe(schema);
    expect(arg.system).toBe("구조화 시스템");
    expect(arg.prompt).toBe("본문");
    expect(arg.maxRetries).toBe(1);
    expect(arg.abortSignal).toBeTruthy();
  });

  it("maxRetries 명시 → 전달 값 사용", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { headline: "x", count: 0 },
      usage: { inputTokens: 0, outputTokens: 0 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    await extractSchemaSummary({
      model,
      schema,
      prompt: "x",
      timeoutMs: 1000,
      maxRetries: 5,
    });

    expect(vi.mocked(generateObject).mock.calls[0][0].maxRetries).toBe(5);
  });
});
