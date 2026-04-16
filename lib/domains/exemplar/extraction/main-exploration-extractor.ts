/**
 * Phase δ-1 — exemplar 메인 탐구 패턴 추출기.
 *
 * 흐름:
 *   1) loadExemplarContext: exemplar 자식 테이블 전체 raw text 수집
 *   2) extractMainExplorationPattern: LLM(Gemini Pro 1차, Flash fallback) 호출 + JSON 파싱
 *   3) runMainExplorationExtraction: 1+2+DB upsert 전 흐름
 *   4) runMainExplorationExtractionBatch: pending 목록 배치 처리 (rate limit 유의)
 *
 * LLM client 는 plan 도메인 ai-sdk 를 사용 (rate limit + cache 내장).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractJson } from "@/lib/domains/record-analysis/llm/extractJson";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { withRetry } from "@/lib/domains/record-analysis/llm/retry";
import type { Database } from "@/lib/supabase/database.types";
import type { ExemplarMainExplorationPattern } from "../types";
import {
  getExemplarMainExplorationPattern,
  listExemplarsForExtractionPending,
  upsertExemplarMainExplorationPattern,
} from "../repository/exemplar-main-exploration-repository";
import {
  MAIN_EXPLORATION_SYSTEM_PROMPT,
  type MainExplorationPromptContext,
  buildMainExplorationUserPrompt,
  parseMainExplorationResponse,
} from "./main-exploration-prompt";

type Client = SupabaseClient<Database>;

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

export interface ExtractionRunResult {
  exemplarId: string;
  success: boolean;
  pattern?: ExemplarMainExplorationPattern;
  modelName?: string;
  elapsedMs: number;
  error?: string;
  skipped?: "already_extracted" | "insufficient_content";
}

export interface BatchRunOptions {
  client: Client;
  extractorVersion: string;
  limit: number;
  /** 연속 호출 간 sleep ms (rate limit 대응, 기본 2000) */
  delayMs?: number;
  /** 이미 패턴이 있어도 덮어쓸지 (기본 false) */
  force?: boolean;
  /** dry-run: LLM/DB 쓰기 생략, 컨텍스트만 로드 */
  dryRun?: boolean;
  /** 개별 단계 로그 훅 */
  onProgress?: (evt: {
    exemplarId: string;
    phase: "start" | "loaded" | "extracted" | "saved" | "error";
    message?: string;
  }) => void;
}

export interface BatchRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ExtractionRunResult[];
}

// ─── 1. Exemplar 컨텍스트 로드 ──────────────────────────────────────────────

/**
 * 단일 exemplar 의 자식 테이블(세특/창체/행특/독서/진로) 을 전부 로드하여
 * 프롬프트 컨텍스트로 변환.
 *
 * 공개 RLS 가 있으므로 서버 환경에서 admin client 권장.
 */
export async function loadExemplarContext(
  exemplarId: string,
  client: Client,
): Promise<MainExplorationPromptContext | null> {
  const { data: record, error: recErr } = await client
    .from("exemplar_records")
    .select("id, anonymous_id, school_name")
    .eq("id", exemplarId)
    .maybeSingle();
  if (recErr) throw recErr;
  if (!record) return null;

  const [
    { data: seteks, error: setekErr },
    { data: creatives, error: creErr },
    { data: haengteuk, error: hangErr },
    { data: reading, error: readErr },
    { data: careers, error: carErr },
  ] = await Promise.all([
    client
      .from("exemplar_seteks")
      .select("grade, semester, subject_name, content")
      .eq("exemplar_id", exemplarId)
      .order("grade")
      .order("semester"),
    client
      .from("exemplar_creative_activities")
      .select("grade, activity_type, activity_name, content")
      .eq("exemplar_id", exemplarId)
      .order("grade"),
    client
      .from("exemplar_haengteuk")
      .select("grade, content")
      .eq("exemplar_id", exemplarId)
      .order("grade"),
    client
      .from("exemplar_reading")
      .select("grade, subject_area, book_description")
      .eq("exemplar_id", exemplarId)
      .order("grade"),
    client
      .from("exemplar_career_aspirations")
      .select("grade, student_aspiration, reason")
      .eq("exemplar_id", exemplarId)
      .order("grade"),
  ]);

  const firstError = setekErr ?? creErr ?? hangErr ?? readErr ?? carErr;
  if (firstError) throw firstError;

  return {
    exemplarId: record.id,
    schoolName: record.school_name,
    anonymousId: record.anonymous_id,
    careerAspirations: (careers ?? []).map((c) => ({
      grade: c.grade,
      studentAspiration: c.student_aspiration,
      reason: c.reason,
    })),
    seteks: (seteks ?? []).map((s) => ({
      grade: s.grade,
      semester: s.semester,
      subjectName: s.subject_name,
      content: s.content,
    })),
    creativeActivities: (creatives ?? []).map((c) => ({
      grade: c.grade,
      activityType: c.activity_type,
      activityName: c.activity_name,
      content: c.content,
    })),
    haengteuk: (haengteuk ?? []).map((h) => ({
      grade: h.grade,
      content: h.content,
    })),
    reading: (reading ?? []).map((r) => ({
      grade: r.grade,
      subjectArea: r.subject_area,
      bookDescription: r.book_description,
    })),
  };
}

// ─── 2. LLM 호출 + 파싱 ─────────────────────────────────────────────────────

const MIN_TOTAL_CHARS = 400;

/**
 * 단일 exemplar 컨텍스트 → LLM 호출 → 패턴 JSON 파싱.
 *
 * Pro(standard) 1차 호출. 파싱 실패 시 Flash(fast) fallback.
 * 실 서비스 파이프라인의 extractNarrativeArc 와 동일한 tier 전략이지만
 * 메인 탐구 패턴은 전체 생기부 추상화라 Pro 가 기본.
 */
export async function extractMainExplorationPattern(
  context: MainExplorationPromptContext,
): Promise<
  | { success: true; pattern: ExemplarMainExplorationPattern; modelName?: string; elapsedMs: number }
  | { success: false; error: string; elapsedMs: number }
> {
  const startMs = Date.now();
  const totalChars =
    context.seteks.reduce((n, s) => n + s.content.length, 0) +
    context.creativeActivities.reduce((n, c) => n + c.content.length, 0) +
    context.haengteuk.reduce((n, h) => n + h.content.length, 0);

  if (totalChars < MIN_TOTAL_CHARS) {
    return {
      success: false,
      error: `원문이 너무 짧습니다 (총 ${totalChars}자, 최소 ${MIN_TOTAL_CHARS}자 필요).`,
      elapsedMs: Date.now() - startMs,
    };
  }

  const userPrompt = buildMainExplorationUserPrompt(context);

  const tryTier = async (tier: "standard" | "fast") => {
    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: MAIN_EXPLORATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: tier,
          temperature: 0.3,
          maxTokens: 1800,
          responseFormat: "json",
        }),
      { label: `extractMainExplorationPattern:${tier}` },
    );
    if (!result.content) throw new Error("AI 응답이 비어있습니다.");
    const raw = extractJson<unknown>(result.content);
    const pattern = parseMainExplorationResponse(raw);
    return {
      pattern,
      modelName: result.modelId ?? undefined,
    };
  };

  try {
    const out = await tryTier("standard");
    return {
      success: true,
      pattern: out.pattern,
      modelName: out.modelName,
      elapsedMs: Date.now() - startMs,
    };
  } catch (proErr) {
    try {
      const out = await tryTier("fast");
      return {
        success: true,
        pattern: out.pattern,
        modelName: out.modelName,
        elapsedMs: Date.now() - startMs,
      };
    } catch (flashErr) {
      return {
        success: false,
        error: `Pro: ${describe(proErr)} | Flash: ${describe(flashErr)}`,
        elapsedMs: Date.now() - startMs,
      };
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── 3. 단일 exemplar 추출 → DB 쓰기 ────────────────────────────────────────

export async function runMainExplorationExtraction(
  exemplarId: string,
  options: {
    client: Client;
    extractorVersion: string;
    force?: boolean;
    dryRun?: boolean;
  },
): Promise<ExtractionRunResult> {
  const startMs = Date.now();

  if (!options.force) {
    const existing = await getExemplarMainExplorationPattern(exemplarId, options.client);
    if (existing) {
      return {
        exemplarId,
        success: true,
        pattern: existing,
        elapsedMs: Date.now() - startMs,
        skipped: "already_extracted",
      };
    }
  }

  const ctx = await loadExemplarContext(exemplarId, options.client);
  if (!ctx) {
    return {
      exemplarId,
      success: false,
      error: `exemplar_records 행을 찾을 수 없습니다.`,
      elapsedMs: Date.now() - startMs,
    };
  }

  const extracted = await extractMainExplorationPattern(ctx);
  if (!extracted.success) {
    return {
      exemplarId,
      success: false,
      error: extracted.error,
      elapsedMs: Date.now() - startMs,
      ...(extracted.error.includes("최소") ? { skipped: "insufficient_content" as const } : {}),
    };
  }

  if (!options.dryRun) {
    await upsertExemplarMainExplorationPattern(
      exemplarId,
      extracted.pattern,
      { extractorVersion: options.extractorVersion },
      options.client,
    );
  }

  return {
    exemplarId,
    success: true,
    pattern: extracted.pattern,
    modelName: extracted.modelName,
    elapsedMs: Date.now() - startMs,
  };
}

// ─── 4. 배치 러너 ───────────────────────────────────────────────────────────

export async function runMainExplorationExtractionBatch(
  options: BatchRunOptions,
): Promise<BatchRunResult> {
  const delayMs = options.delayMs ?? 2000;
  const candidates = await listExemplarsForExtractionPending(
    options.limit,
    options.client,
  );

  const results: ExtractionRunResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { id: exemplarId } = candidates[i];
    options.onProgress?.({ exemplarId, phase: "start" });

    try {
      const result = await runMainExplorationExtraction(exemplarId, {
        client: options.client,
        extractorVersion: options.extractorVersion,
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
      });
      results.push(result);

      if (result.skipped) {
        skipped++;
        options.onProgress?.({
          exemplarId,
          phase: "saved",
          message: `skipped(${result.skipped})`,
        });
      } else if (result.success) {
        succeeded++;
        options.onProgress?.({
          exemplarId,
          phase: "saved",
          message: `ok (${result.elapsedMs}ms, ${result.modelName ?? "?"})`,
        });
      } else {
        failed++;
        options.onProgress?.({
          exemplarId,
          phase: "error",
          message: result.error,
        });
      }
    } catch (err) {
      failed++;
      const message = describe(err);
      results.push({
        exemplarId,
        success: false,
        error: message,
        elapsedMs: 0,
      });
      options.onProgress?.({ exemplarId, phase: "error", message });
    }

    if (i < candidates.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    processed: candidates.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
