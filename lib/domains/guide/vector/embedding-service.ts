// ============================================
// 탐구 가이드 임베딩 서비스
// Phase C: pgvector + gemini-embedding-2-preview
// ============================================

import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";
import type { ExplorationGuideContent, TheorySection, ContentSection } from "../types";

const LOG_TAG = "guide.embedding";
const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 8000; // 임베딩 모델 토큰 제한 대비 안전 마진

/** embed/embedMany 공통 provider 옵션 */
const EMBED_PROVIDER_OPTIONS = {
  google: { outputDimensionality: EMBEDDING_DIMENSIONS },
};

/**
 * 가이드 콘텐츠에서 임베딩용 텍스트 생성
 * 제목 + 동기 + 이론(2000자 cap) + 고찰 + 요약 + 세특예시
 */
export function buildEmbeddingInput(
  title: string,
  content: ExplorationGuideContent,
): string {
  const parts: string[] = [];

  // 제목
  parts.push(`제목: ${title}`);

  // 동기
  if (content.motivation) {
    parts.push(`동기: ${content.motivation}`);
  }

  // 이론 (2000자 cap) — content_sections 우선, 없으면 레거시 theory_sections
  if (content.content_sections?.length) {
    const sectionSummary = content.content_sections
      .filter((s: ContentSection) => s.key !== "setek_examples")
      .map((s: ContentSection) => `${s.label}: ${s.content}`)
      .join("\n");
    parts.push(`내용: ${sectionSummary.slice(0, 2000)}`);

    // outline depth 0~1 텍스트 포함 (목차형 키워드 검색 지원)
    const outlineTexts = content.content_sections
      .filter((s: ContentSection) => s.outline && s.outline.length > 0)
      .flatMap((s: ContentSection) =>
        (s.outline ?? [])
          .filter((item) => item.depth <= 1)
          .map((item) => item.text),
      );
    if (outlineTexts.length > 0) {
      parts.push(`목차: ${outlineTexts.join(", ").slice(0, 800)}`);
    }
  } else if (content.theory_sections?.length) {
    const theorySummary = content.theory_sections
      .map((s: TheorySection) => `${s.title}: ${s.content}`)
      .join("\n");
    parts.push(`이론: ${theorySummary.slice(0, 2000)}`);
  }

  // 고찰
  if (content.reflection) {
    parts.push(`고찰: ${content.reflection}`);
  }

  // 요약
  if (content.summary) {
    parts.push(`요약: ${content.summary}`);
  }

  // 세특 예시
  if (content.setek_examples?.length) {
    parts.push(`세특예시: ${content.setek_examples.slice(0, 3).join("\n")}`);
  }

  const fullText = parts.join("\n\n");
  return fullText.slice(0, MAX_INPUT_CHARS);
}

/**
 * 단일 가이드 임베딩 생성 및 DB 저장
 */
export async function embedSingleGuide(guideId: string): Promise<boolean> {
  logActionDebug(LOG_TAG, `embedSingleGuide: id=${guideId}`);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError(LOG_TAG, "Admin client 생성 실패");
    return false;
  }

  // 가이드 제목 + 콘텐츠 조회
  const [{ data: guide }, { data: content }] = await Promise.all([
    supabase
      .from("exploration_guides")
      .select("title")
      .eq("id", guideId)
      .single(),
    supabase
      .from("exploration_guide_content")
      .select("*")
      .eq("guide_id", guideId)
      .single(),
  ]);

  if (!guide || !content) {
    logActionWarn(LOG_TAG, `가이드 또는 콘텐츠 없음: ${guideId}`);
    return false;
  }

  const inputText = buildEmbeddingInput(
    guide.title,
    content as unknown as ExplorationGuideContent,
  );
  if (inputText.length < 10) {
    logActionWarn(LOG_TAG, `임베딩 입력 텍스트가 너무 짧음: ${guideId}`);
    await supabase
      .from("exploration_guide_content")
      .update({ embedding_status: "failed" })
      .eq("guide_id", guideId);
    return false;
  }

  // Rate-limited 임베딩 생성
  const { embedding } = await geminiRateLimiter.execute(async () => {
    return embed({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      value: inputText,
      providerOptions: EMBED_PROVIDER_OPTIONS,
    });
  });
  geminiQuotaTracker.recordRequest();

  // DB 저장 + 상태 마킹
  const { error } = await supabase
    .from("exploration_guide_content")
    .update({
      embedding: JSON.stringify(embedding),
      embedding_status: "completed",
    })
    .eq("guide_id", guideId);

  if (error) {
    // 실패 마킹
    await supabase
      .from("exploration_guide_content")
      .update({ embedding_status: "failed" })
      .eq("guide_id", guideId);
    logActionError(LOG_TAG, error instanceof Error ? error.message : String(error));
    return false;
  }

  logActionDebug(LOG_TAG, `임베딩 저장 완료: ${guideId}`);
  return true;
}

/**
 * 배치 임베딩 생성
 * @param guideIds - 임베딩할 가이드 ID 배열
 * @param batchSize - 배치 크기 (기본: 50)
 */
export async function embedBatchGuides(
  guideIds: string[],
  batchSize = 50,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < guideIds.length; i += batchSize) {
    const batch = guideIds.slice(i, i + batchSize);
    logActionDebug(
      LOG_TAG,
      `배치 ${Math.floor(i / batchSize) + 1}: ${batch.length}건`,
    );

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      failed += batch.length;
      continue;
    }

    // 가이드 제목 + 콘텐츠 일괄 조회
    const [{ data: guides }, { data: contents }] = await Promise.all([
      supabase
        .from("exploration_guides")
        .select("id, title")
        .in("id", batch),
      supabase
        .from("exploration_guide_content")
        .select("*")
        .in("guide_id", batch),
    ]);

    if (!guides || !contents) {
      failed += batch.length;
      continue;
    }

    const guideMap = new Map<string, string>();
    for (const g of guides as Array<{ id: string; title: string }>) {
      guideMap.set(g.id, g.title);
    }
    const contentMap = new Map<string, Record<string, unknown>>();
    for (const c of contents as Array<{ guide_id: string }>) {
      contentMap.set(c.guide_id, c);
    }

    // 임베딩 텍스트 구성
    const validItems: Array<{ guideId: string; text: string }> = [];
    for (const id of batch) {
      const title = guideMap.get(id);
      const content = contentMap.get(id);
      if (!title || !content) {
        failed++;
        continue;
      }
      const text = buildEmbeddingInput(
        title,
        content as ExplorationGuideContent,
      );
      if (text.length < 10) {
        failed++;
        continue;
      }
      validItems.push({ guideId: id, text });
    }

    if (validItems.length === 0) continue;

    try {
      // Rate-limited 배치 임베딩
      const { embeddings } = await geminiRateLimiter.execute(async () => {
        return embedMany({
          model: google.textEmbeddingModel(EMBEDDING_MODEL),
          values: validItems.map((item) => item.text),
          providerOptions: EMBED_PROVIDER_OPTIONS,
        });
      });
      geminiQuotaTracker.recordRequest();

      // 개별 저장 + 상태 마킹
      for (let j = 0; j < validItems.length; j++) {
        const { error } = await supabase
          .from("exploration_guide_content")
          .update({
            embedding: JSON.stringify(embeddings[j]),
            embedding_status: "completed",
          })
          .eq("guide_id", validItems[j].guideId);

        if (error) {
          await supabase
            .from("exploration_guide_content")
            .update({ embedding_status: "failed" })
            .eq("guide_id", validItems[j].guideId);
          logActionError(LOG_TAG, error instanceof Error ? error.message : String(error));
          failed++;
        } else {
          success++;
        }
      }
    } catch (error) {
      logActionError(LOG_TAG, error instanceof Error ? error.message : String(error));
      // 배치 전체 실패 시 모든 항목 failed 마킹
      for (const item of validItems) {
        await supabase
          .from("exploration_guide_content")
          .update({ embedding_status: "failed" })
          .eq("guide_id", item.guideId);
      }
      failed += validItems.length;
    }

    // 배치 간 딜레이 (rate limit 방지)
    if (i + batchSize < guideIds.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { success, failed };
}
