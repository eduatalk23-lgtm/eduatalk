"use server";

// ============================================
// 세특 인라인 하이라이트 분석 Server Action
// Phase 6.1 — 원문 구절 인용 + 역량 태깅
// Phase 1 (Level 4) — 3-Step 분해 + Cascading
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
  buildBatchHighlightUserPrompt,
  parseBatchHighlightResponse,
} from "../prompts/competencyHighlight";
import type {
  HighlightAnalysisInput,
  HighlightAnalysisResult,
  BatchHighlightInput,
  BatchHighlightResult,
  StepATaggingResult,
  CompetencyItemCode,
  AnalyzeRunMetrics,
  AnalyzeRunResult,
} from "../types";
import { PIPELINE_THRESHOLDS } from "@/lib/domains/student-record/constants";

const LOG_CTX = { domain: "record-analysis", action: "analyzeWithHighlight" };

// ============================================
// Phase 1 (Level 4): 3-Step 파이프라인 오케스트레이터
// ============================================

/** Step A 신뢰도 계산: 태그 confidence 평균 + 커버리지 비율 */
function computeOverallConfidence(stepA: StepATaggingResult, recordType: string): number {
  const allTags = stepA.sections.flatMap((s) => s.tags);
  if (allTags.length === 0) return 0;

  const meanConf = allTags.reduce((sum, t) => sum + t.confidence, 0) / allTags.length;

  // career_course_effort/achievement는 데이터 기반이므로 텍스트 태깅에서 제외
  const expectedCount = recordType === "setek" || recordType === "personal_setek" ? 8 : 6;
  const coverageRatio = Math.min(1, stepA.coveredItems.length / expectedCount);

  // needs_review 비율이 50% 초과이면 페널티
  const reviewRatio = allTags.filter((t) => t.evaluation === "needs_review").length / allTags.length;
  const penalty = reviewRatio > 0.5 ? 0.1 : 0;

  return Math.max(0, meanConf * 0.6 + coverageRatio * 0.3 + 0.1 - penalty);
}

/** Step A 태그에서 confidence를 제거하여 HighlightAnalysisResult.sections으로 변환 */
function stripConfidenceFromSections(stepA: StepATaggingResult): HighlightAnalysisResult["sections"] {
  return stepA.sections.map((s) => ({
    sectionType: s.sectionType,
    ...(s.sectionText ? { sectionText: s.sectionText } : {}),
    tags: s.tags.map((t) => ({
      competencyItem: t.competencyItem,
      evaluation: t.evaluation,
      highlight: t.highlight,
      reasoning: t.reasoning,
    })),
    needsReview: s.needsReview,
  }));
}

function sumUsage(
  u: { inputTokens: number; outputTokens: number } | undefined,
  acc: { inputTokens: number; outputTokens: number },
): void {
  if (!u) return;
  acc.inputTokens += u.inputTokens;
  acc.outputTokens += u.outputTokens;
}

/**
 * 3-Step 파이프라인 실행:
 * Step A(태깅) → confidence 검사 → Step B(루브릭) + Step C(품질) 병렬
 *
 * Stage 1 (측정 루프): 외부 eval 스크립트 호출을 위해 export.
 * 내부 `analyzeSetekWithHighlight`도 이 함수를 사용한다.
 */
export async function runPipelineAnalysis(
  input: HighlightAnalysisInput,
): Promise<AnalyzeRunResult> {
  const tStart = Date.now();
  const metrics: AnalyzeRunMetrics = { path: "pipeline", stepUsage: {}, latencyMs: {} };
  const totals = { inputTokens: 0, outputTokens: 0 };

  // --- Step A: 태깅 ---
  const { STEP_A_SYSTEM_PROMPT, buildStepAUserPrompt, parseStepAResponse } = await import("../prompts/stepA-tagging");

  const stepAUserPrompt = buildStepAUserPrompt(input);
  const tStepA = Date.now();
  const stepARaw = await withRetry(
    () => generateTextWithRateLimit({
      system: STEP_A_SYSTEM_PROMPT,
      messages: [{ role: "user", content: stepAUserPrompt }],
      modelTier: "fast",
      temperature: 0.2,
      maxTokens: 8192,
      responseFormat: "json",
    }),
    { label: "pipeline.stepA" },
  );
  metrics.latencyMs!.stepA = Date.now() - tStepA;

  if (!stepARaw.content) {
    throw new Error("Step A: AI 응답이 비어있습니다.");
  }

  const stepA = parseStepAResponse(stepARaw.content);
  if (stepARaw.usage) {
    metrics.stepUsage!.stepA = { inputTokens: stepARaw.usage.inputTokens, outputTokens: stepARaw.usage.outputTokens };
    sumUsage(stepARaw.usage, totals);
  }

  // 빈 결과면 early return
  if (stepA.sections.length === 0) {
    metrics.latencyMs!.total = Date.now() - tStart;
    return {
      data: { sections: [], competencyGrades: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." },
      usage: totals.inputTokens > 0 ? totals : undefined,
      metrics,
    };
  }

  // --- Cascading 판정 ---
  stepA.overallConfidence = computeOverallConfidence(stepA, input.recordType);
  metrics.stepAConfidence = stepA.overallConfidence;
  metrics.stepACoveredItems = stepA.coveredItems.length;
  const allTagsForMetrics = stepA.sections.flatMap((s) => s.tags);
  metrics.stepATagCount = allTagsForMetrics.length;
  metrics.stepANeedsReviewRatio = allTagsForMetrics.length > 0
    ? allTagsForMetrics.filter((t) => t.evaluation === "needs_review").length / allTagsForMetrics.length
    : 0;

  if (stepA.overallConfidence < PIPELINE_THRESHOLDS.STEP_A_CONFIDENCE_MIN) {
    logActionWarn(LOG_CTX, `[Pipeline] Cascading fallback: confidence=${stepA.overallConfidence.toFixed(2)} < ${PIPELINE_THRESHOLDS.STEP_A_CONFIDENCE_MIN}`);
    metrics.path = "monolithic";
    metrics.fallbackReason = "confidence_below_threshold";
    const monolithic = await runMonolithicAnalysis(input);
    sumUsage(monolithic.usage, totals);
    if (monolithic.metrics.stepUsage?.monolithic) {
      metrics.stepUsage!.monolithic = monolithic.metrics.stepUsage.monolithic;
    }
    if (monolithic.metrics.latencyMs?.monolithic) {
      metrics.latencyMs!.monolithic = monolithic.metrics.latencyMs.monolithic;
    }
    metrics.latencyMs!.total = Date.now() - tStart;
    return { data: monolithic.data, usage: totals, metrics };
  }

  logActionDebug(LOG_CTX, `[Pipeline] Step A passed: confidence=${stepA.overallConfidence.toFixed(2)}, tags=${metrics.stepATagCount}, items=${metrics.stepACoveredItems}`);

  // --- Step B + Step C 병렬 ---
  const { buildStepBUserPrompt, parseStepBResponse, STEP_B_SYSTEM_PROMPT } = await import("../prompts/stepB-rubric");
  const { buildStepCUserPrompt, parseStepCResponse, STEP_C_SYSTEM_PROMPT } = await import("../prompts/stepC-quality");

  const tBC = Date.now();
  const [stepBResult, stepCResult] = await Promise.allSettled([
    withRetry(
      () => generateTextWithRateLimit({
        system: STEP_B_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildStepBUserPrompt(input, stepA) }],
        modelTier: "fast",
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: "json",
      }),
      { label: "pipeline.stepB" },
    ),
    withRetry(
      () => generateTextWithRateLimit({
        system: STEP_C_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildStepCUserPrompt(input, stepA) }],
        modelTier: "fast",
        temperature: 0.3,
        maxTokens: 2048,
        responseFormat: "json",
      }),
      { label: "pipeline.stepC" },
    ),
  ]);
  // B/C 병렬이므로 두 경과 중 더 긴 쪽이 실제 벽시계 소요
  const bcElapsed = Date.now() - tBC;
  metrics.latencyMs!.stepB = bcElapsed;
  metrics.latencyMs!.stepC = bcElapsed;

  // --- 결과 합성 ---
  const sections = stripConfidenceFromSections(stepA);
  let competencyGrades: HighlightAnalysisResult["competencyGrades"] = [];
  let summary = "";
  let contentQuality: HighlightAnalysisResult["contentQuality"] = undefined;

  if (stepBResult.status === "fulfilled" && stepBResult.value.content) {
    try {
      const stepB = parseStepBResponse(stepBResult.value.content);
      competencyGrades = stepB.competencyGrades;
      summary = stepB.summary;
      if (stepBResult.value.usage) {
        metrics.stepUsage!.stepB = {
          inputTokens: stepBResult.value.usage.inputTokens,
          outputTokens: stepBResult.value.usage.outputTokens,
        };
        sumUsage(stepBResult.value.usage, totals);
      }
    } catch (e) {
      logActionError({ ...LOG_CTX, action: "pipeline.stepB.parse" }, e);
      metrics.fallbackReason = "stepB_parse_failed";
      const fallback = await runMonolithicAnalysis(input);
      competencyGrades = fallback.data.competencyGrades;
      summary = fallback.data.summary;
      sumUsage(fallback.usage, totals);
      if (fallback.metrics.stepUsage?.monolithic) {
        metrics.stepUsage!.monolithic = fallback.metrics.stepUsage.monolithic;
      }
    }
  } else {
    logActionError({ ...LOG_CTX, action: "pipeline.stepB" }, stepBResult.status === "rejected" ? stepBResult.reason : "empty response");
    metrics.fallbackReason = "stepB_failed";
    const fallback = await runMonolithicAnalysis(input);
    competencyGrades = fallback.data.competencyGrades;
    summary = fallback.data.summary;
    sumUsage(fallback.usage, totals);
    if (fallback.metrics.stepUsage?.monolithic) {
      metrics.stepUsage!.monolithic = fallback.metrics.stepUsage.monolithic;
    }
  }

  if (stepCResult.status === "fulfilled" && stepCResult.value.content) {
    try {
      const stepC = parseStepCResponse(stepCResult.value.content);
      contentQuality = stepC.contentQuality;
      if (stepCResult.value.usage) {
        metrics.stepUsage!.stepC = {
          inputTokens: stepCResult.value.usage.inputTokens,
          outputTokens: stepCResult.value.usage.outputTokens,
        };
        sumUsage(stepCResult.value.usage, totals);
      }
    } catch (e) {
      logActionError({ ...LOG_CTX, action: "pipeline.stepC.parse" }, e);
    }
  } else if (stepCResult.status === "rejected") {
    logActionError({ ...LOG_CTX, action: "pipeline.stepC" }, stepCResult.reason);
  }

  metrics.latencyMs!.total = Date.now() - tStart;

  return {
    data: {
      sections,
      competencyGrades,
      summary,
      ...(contentQuality ? { contentQuality } : {}),
    },
    usage: totals.inputTokens > 0 ? totals : undefined,
    metrics,
  };
}

/**
 * 모놀리식 분석 (기존 단일 호출 경로).
 * Cascading fallback 및 Step B/C 실패 시 사용.
 *
 * Stage 1 (측정 루프): 외부 eval 스크립트 호출을 위해 export.
 */
export async function runMonolithicAnalysis(
  input: HighlightAnalysisInput,
): Promise<AnalyzeRunResult> {
  const tStart = Date.now();
  const userPrompt = buildHighlightUserPrompt(input);
  const result = await withRetry(
    () => generateTextWithRateLimit({
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "advanced",
      temperature: 0.3,
      maxTokens: 16384,
      responseFormat: "json",
    }),
    { label: "analyzeSetekWithHighlight.monolithic" },
  );
  const elapsed = Date.now() - tStart;

  if (!result.content) {
    throw new Error("모놀리식 분석: AI 응답이 비어있습니다.");
  }

  const parsed = parseHighlightResponse(result.content);
  const usage = result.usage
    ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
    : undefined;

  const metrics: AnalyzeRunMetrics = {
    path: "monolithic",
    stepUsage: usage ? { monolithic: usage } : {},
    latencyMs: { total: elapsed, monolithic: elapsed },
  };

  return { data: parsed, usage, metrics };
}

// ============================================
// Public API — 외부 인터페이스 변경 없음
// ============================================

/**
 * careerContext가 없고 studentId가 제공되면 DB에서 자동 조회합니다.
 * 파이프라인/클라이언트 양쪽에서 동일한 진로 컨텍스트를 사용합니다.
 */
export async function analyzeSetekWithHighlight(
  input: HighlightAnalysisInput & { studentId?: string },
): Promise<{ success: true; data: HighlightAnalysisResult; usage?: { inputTokens: number; outputTokens: number } } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) {
      return { success: false, error: "분석할 텍스트가 너무 짧습니다 (20자 이상 필요)." };
    }

    // careerContext 자동 조회: studentId 있고 careerContext 없으면 DB에서 조립
    if (!input.careerContext && input.studentId) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: student } = await supabase
        .from("students")
        .select("target_major")
        .eq("id", input.studentId)
        .maybeSingle();
      const tgtMajor = student?.target_major as string | null;
      if (tgtMajor) {
        const { fetchCareerContext } = await import("@/lib/domains/student-record/repository/score-query");
        const ccResult = await fetchCareerContext(supabase, input.studentId!, tgtMajor);
        if (ccResult) {
          input.careerContext = ccResult.careerContext;
        }
      }
    }

    let data: HighlightAnalysisResult;
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    // Phase 1 (Level 4): 3-Step 파이프라인 vs 모놀리식 분기
    if (PIPELINE_THRESHOLDS.PIPELINE_SPLIT_ENABLED) {
      try {
        const pipelineResult = await runPipelineAnalysis(input);
        data = pipelineResult.data;
        usage = pipelineResult.usage;
        logActionDebug(LOG_CTX, `[Pipeline] path=${pipelineResult.metrics.path}`);
      } catch (pipelineError) {
        // 파이프라인 전체 실패 → 모놀리식 fallback
        logActionError({ ...LOG_CTX, action: "pipeline.fullFallback" }, pipelineError);
        const monolithic = await runMonolithicAnalysis(input);
        data = monolithic.data;
        usage = monolithic.usage;
      }
    } else {
      // 플래그 비활성 → 기존 모놀리식
      const monolithic = await runMonolithicAnalysis(input);
      data = monolithic.data;
      usage = monolithic.usage;
    }

    // Phase 6.2: sectionText 검증 — 커버리지 70% 미만이면 폴백
    if (input.recordType === "setek" || input.recordType === "personal_setek") {
      const totalCovered = data.sections.reduce((sum, s) => sum + (s.sectionText?.length ?? 0), 0);
      if (totalCovered > 0 && totalCovered < input.content.length * 0.7) {
        for (const s of data.sections) {
          delete s.sectionText;
        }
      }
    }

    if (data.sections.length === 0) {
      return {
        success: true,
        data: { sections: [], competencyGrades: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." },
      };
    }

    return { success: true, data, usage };
  } catch (error) {
    return handleLlmActionError(error, "역량 분석", LOG_CTX);
  }
}

// ============================================
// 배치 분석 (파이프라인 전용)
// 3-4개 레코드를 1회 LLM 호출로 묶어 처리
// Phase 1에서는 모놀리식 유지
// ============================================

/**
 * 다중 레코드 배치 분석
 * careerContext는 파이프라인에서 사전 조회하여 전달
 * 실패 레코드는 failedIds로 반환 → 호출자가 개별 재시도
 */
export async function analyzeSetekBatchWithHighlight(
  input: BatchHighlightInput,
): Promise<BatchHighlightResult> {
  await requireAdminOrConsultant();

  const validRecords = input.records.filter((r) => r.content?.trim().length >= PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH);
  const invalidIds = input.records
    .filter((r) => !r.content || r.content.trim().length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH)
    .map((r) => r.id);

  if (validRecords.length === 0) {
    return { succeeded: new Map(), failedIds: invalidIds };
  }

  // 1건이면 단건 함수 위임
  if (validRecords.length === 1) {
    const rec = validRecords[0];
    const result = await analyzeSetekWithHighlight({
      content: rec.content,
      recordType: rec.recordType,
      subjectName: rec.subjectName,
      grade: rec.grade,
      careerContext: input.careerContext,
    });
    const succeeded = new Map<string, HighlightAnalysisResult>();
    if (result.success) succeeded.set(rec.id, result.data);
    return {
      succeeded,
      failedIds: [...invalidIds, ...(result.success ? [] : [rec.id])],
    };
  }

  const userPrompt = buildBatchHighlightUserPrompt(validRecords, input.careerContext);
  const maxTokens = Math.min(validRecords.length * 3500, 16384);

  try {
    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: HIGHLIGHT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.3,
        maxTokens,
        responseFormat: "json",
      }),
      { label: "analyzeSetekBatchWithHighlight" },
    );

    if (!result.content) {
      return {
        succeeded: new Map(),
        failedIds: [...invalidIds, ...validRecords.map((r) => r.id)],
      };
    }

    const expectedIds = validRecords.map((r) => r.id);
    const batchResult = parseBatchHighlightResponse(result.content, expectedIds);

    // Phase 6.2: sectionText 커버리지 검증 (레코드별)
    for (const [id, data] of batchResult.succeeded) {
      const rec = validRecords.find((r) => r.id === id);
      if (rec && (rec.recordType === "setek" || rec.recordType === "personal_setek")) {
        const totalCovered = data.sections.reduce((sum, s) => sum + (s.sectionText?.length ?? 0), 0);
        if (totalCovered > 0 && totalCovered < rec.content.length * 0.7) {
          for (const s of data.sections) delete s.sectionText;
        }
      }
    }

    batchResult.failedIds.push(...invalidIds);
    // Phase 0: 토큰 사용량 반환
    if (result.usage) {
      batchResult.usage = { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens };
    }
    return batchResult;
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "analyzeWithHighlight.batch" }, error);
    return {
      succeeded: new Map(),
      failedIds: [...invalidIds, ...validRecords.map((r) => r.id)],
    };
  }
}
