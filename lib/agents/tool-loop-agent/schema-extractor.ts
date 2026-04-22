/**
 * Phase D-1 Sprint 1: 2단계 schema 추출.
 *
 * subagent 의 최종 텍스트를 고정 schema JSON 으로 구조화하는 보조 단계.
 * subagentRunner 의 기존 `generateObject` 블록을 재사용 가능하도록 분리.
 */

import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";

import { extractTokens } from "./agent";
import type { TokenUsage } from "./types";

export type SchemaExtractionOk<TSchema extends z.ZodTypeAny> = {
  ok: true;
  object: z.infer<TSchema>;
  usage: TokenUsage;
};

export type SchemaExtractionFail = {
  ok: false;
  reason: string;
  usage: TokenUsage;
};

export type SchemaExtractionResult<TSchema extends z.ZodTypeAny> =
  | SchemaExtractionOk<TSchema>
  | SchemaExtractionFail;

export async function extractSchemaSummary<TSchema extends z.ZodTypeAny>(args: {
  model: LanguageModel;
  schema: TSchema;
  system?: string;
  prompt: string;
  timeoutMs: number;
  maxRetries?: number;
}): Promise<SchemaExtractionResult<TSchema>> {
  try {
    const result = await generateObject({
      model: args.model,
      schema: args.schema,
      system: args.system,
      prompt: args.prompt,
      maxRetries: args.maxRetries ?? 1,
      abortSignal: AbortSignal.timeout(args.timeoutMs),
    });
    return {
      ok: true,
      object: result.object as z.infer<TSchema>,
      usage: extractTokens(result.usage),
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, reason, usage: { input: 0, output: 0 } };
  }
}
