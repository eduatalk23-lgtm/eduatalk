// ============================================
// 케이스 메모리 임베딩 서비스
// 가이드 vector/embedding-service.ts 패턴 재사용
// ============================================

import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "case-embedding" };
const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 4000;

const EMBED_PROVIDER_OPTIONS = {
  google: { outputDimensionality: EMBEDDING_DIMENSIONS },
};

/**
 * 케이스 데이터에서 임베딩용 텍스트 생성.
 * 진단 요약 + 전략 요약 + 핵심 인사이트를 결합.
 */
export function buildCaseEmbeddingInput(
  diagnosisSummary: string,
  strategySummary: string,
  keyInsights: string[],
  targetMajor?: string | null,
  studentGrade?: number | null,
): string {
  const parts: string[] = [];

  if (targetMajor) parts.push(`희망전공: ${targetMajor}`);
  if (studentGrade) parts.push(`학년: ${studentGrade}학년`);
  parts.push(`진단: ${diagnosisSummary}`);
  parts.push(`전략: ${strategySummary}`);
  if (keyInsights.length > 0) {
    parts.push(`핵심: ${keyInsights.join(", ")}`);
  }

  return parts.join("\n\n").slice(0, MAX_INPUT_CHARS);
}

/**
 * 단일 케이스 임베딩 생성 및 DB 저장
 */
export async function embedSingleCase(caseId: string): Promise<boolean> {
  logActionDebug(LOG_CTX, `embedSingleCase: id=${caseId}`);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError(LOG_CTX, "Admin client 생성 실패");
    return false;
  }

  const { data: caseRow } = await supabase
    .from("consulting_cases")
    .select("diagnosis_summary, strategy_summary, key_insights, target_major, student_grade")
    .eq("id", caseId)
    .single();

  if (!caseRow) {
    logActionWarn(LOG_CTX, `케이스 없음: ${caseId}`);
    return false;
  }

  const inputText = buildCaseEmbeddingInput(
    caseRow.diagnosis_summary,
    caseRow.strategy_summary,
    caseRow.key_insights ?? [],
    caseRow.target_major,
    caseRow.student_grade,
  );

  if (inputText.length < 20) {
    logActionWarn(LOG_CTX, `임베딩 입력 텍스트가 너무 짧음: ${caseId}`);
    await supabase
      .from("consulting_cases")
      .update({ embedding_status: "failed" })
      .eq("id", caseId);
    return false;
  }

  try {
    const { embedding } = await geminiRateLimiter.execute(async () => {
      return embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: inputText,
        providerOptions: EMBED_PROVIDER_OPTIONS,
      });
    });
    geminiQuotaTracker.recordRequest();

    const { error } = await supabase
      .from("consulting_cases")
      .update({
        embedding: JSON.stringify(embedding),
        embedding_status: "completed",
      })
      .eq("id", caseId);

    if (error) {
      await supabase
        .from("consulting_cases")
        .update({ embedding_status: "failed" })
        .eq("id", caseId);
      logActionError(LOG_CTX, error.message);
      return false;
    }

    logActionDebug(LOG_CTX, `임베딩 완료: ${caseId}`);
    return true;
  } catch (error) {
    await supabase
      .from("consulting_cases")
      .update({ embedding_status: "failed" })
      .eq("id", caseId);
    logActionError(LOG_CTX, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * 배치 임베딩 생성
 */
export async function embedBatchCases(
  caseIds: string[],
  batchSize = 50,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < caseIds.length; i += batchSize) {
    const batch = caseIds.slice(i, i + batchSize);
    logActionDebug(LOG_CTX, `배치 ${Math.floor(i / batchSize) + 1}: ${batch.length}건`);

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      failed += batch.length;
      continue;
    }

    const { data: cases } = await supabase
      .from("consulting_cases")
      .select("id, diagnosis_summary, strategy_summary, key_insights, target_major, student_grade")
      .in("id", batch);

    if (!cases || cases.length === 0) {
      failed += batch.length;
      continue;
    }

    const validItems: Array<{ caseId: string; text: string }> = [];
    for (const c of cases) {
      const text = buildCaseEmbeddingInput(
        c.diagnosis_summary,
        c.strategy_summary,
        c.key_insights ?? [],
        c.target_major,
        c.student_grade,
      );
      if (text.length < 20) {
        failed++;
        continue;
      }
      validItems.push({ caseId: c.id, text });
    }

    if (validItems.length === 0) continue;

    try {
      const { embeddings } = await geminiRateLimiter.execute(async () => {
        return embedMany({
          model: google.textEmbeddingModel(EMBEDDING_MODEL),
          values: validItems.map((item) => item.text),
          providerOptions: EMBED_PROVIDER_OPTIONS,
        });
      });
      geminiQuotaTracker.recordRequest();

      for (let j = 0; j < validItems.length; j++) {
        const { error } = await supabase
          .from("consulting_cases")
          .update({
            embedding: JSON.stringify(embeddings[j]),
            embedding_status: "completed",
          })
          .eq("id", validItems[j].caseId);

        if (error) {
          await supabase
            .from("consulting_cases")
            .update({ embedding_status: "failed" })
            .eq("id", validItems[j].caseId);
          failed++;
        } else {
          success++;
        }
      }
    } catch (error) {
      logActionError(LOG_CTX, error instanceof Error ? error : new Error(String(error)));
      for (const item of validItems) {
        await supabase
          .from("consulting_cases")
          .update({ embedding_status: "failed" })
          .eq("id", item.caseId);
      }
      failed += validItems.length;
    }

    // 배치 간 딜레이
    if (i + batchSize < caseIds.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { success, failed };
}

/**
 * pending 상태 교정의 임베딩 생성 (배치).
 * embed-cases.ts 스크립트에서 호출 가능 (server-only 없음).
 */
export async function embedPendingCorrections(limit = 50): Promise<{ success: number; failed: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { success: 0, failed: 0 };

  const { data: pending } = await supabase
    .from("agent_corrections")
    .select("id, original_response, correction_text, context_summary")
    .eq("embedding_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!pending || pending.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const correction of pending) {
    const inputText = [
      correction.context_summary ? `상황: ${correction.context_summary}` : "",
      `원래 답변: ${correction.original_response.slice(0, 500)}`,
      `교정: ${correction.correction_text}`,
    ].filter(Boolean).join("\n\n").slice(0, MAX_INPUT_CHARS);

    try {
      const { embedding } = await geminiRateLimiter.execute(async () => {
        return embed({
          model: google.textEmbeddingModel(EMBEDDING_MODEL),
          value: inputText,
          providerOptions: EMBED_PROVIDER_OPTIONS,
        });
      });
      geminiQuotaTracker.recordRequest();

      const { error } = await supabase
        .from("agent_corrections")
        .update({ embedding: JSON.stringify(embedding), embedding_status: "completed" })
        .eq("id", correction.id);

      if (error) {
        await supabase.from("agent_corrections").update({ embedding_status: "failed" }).eq("id", correction.id);
        failed++;
      } else {
        success++;
      }
    } catch {
      await supabase.from("agent_corrections").update({ embedding_status: "failed" }).eq("id", correction.id);
      failed++;
    }
  }

  return { success, failed };
}
