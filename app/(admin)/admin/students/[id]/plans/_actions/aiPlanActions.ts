"use server";

import { runColdStartPipeline } from "@/lib/domains/plan/llm/actions/coldStart";
import type {
  ColdStartRawInput,
  ColdStartPipelineOptions,
  ColdStartPipelineResult,
} from "@/lib/domains/plan/llm/actions/coldStart";
import { runUnifiedPlanGenerationPipeline } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
import type {
  UnifiedPlanGenerationInput,
  UnifiedPlanGenerationOutput,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";

/**
 * Server Action wrapper for runColdStartPipeline
 *
 * Client components should use this instead of importing runColdStartPipeline directly
 * to avoid `cookies() was called outside a request scope` errors.
 */
export async function runColdStartPipelineAction(
  input: ColdStartRawInput,
  options?: ColdStartPipelineOptions
): Promise<ColdStartPipelineResult> {
  return runColdStartPipeline(input, options);
}

/**
 * Server Action wrapper for runUnifiedPlanGenerationPipeline
 *
 * Client components should use this instead of importing runUnifiedPlanGenerationPipeline directly
 * to avoid `cookies() was called outside a request scope` errors.
 */
export async function runUnifiedPlanGenerationPipelineAction(
  input: UnifiedPlanGenerationInput
): Promise<UnifiedPlanGenerationOutput> {
  return runUnifiedPlanGenerationPipeline(input);
}
