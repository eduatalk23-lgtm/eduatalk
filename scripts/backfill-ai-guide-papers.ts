/**
 * AI 생성 가이드의 빈 URL 논문을 academic_sources에서 벡터 매칭하여 backfill
 *
 * 실행: set -a && source .env.local && set +a && npx tsx scripts/backfill-ai-guide-papers.ts
 */

import "dotenv/config";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 8000;
const SIMILARITY_THRESHOLD = 0.70;
const DELAY_MS = 2000;

interface PaperTarget {
  guide_id: string;
  guide_title: string;
  paper_index: number;
  paper_title: string;
  paper_summary: string | null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
    process.exit(1);
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY 누락");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. AI 생성 가이드의 빈 URL 논문 조회
  const { data: guides, error: guidesErr } = await supabase
    .from("exploration_guides")
    .select("id, title, source_type, exploration_guide_content!inner(related_papers)")
    .in("source_type", ["ai", "ai_keyword"])
    .not("exploration_guide_content.related_papers", "is", null);

  if (guidesErr) {
    console.error("❌ 가이드 조회 실패:", guidesErr.message);
    process.exit(1);
  }

  // 빈 URL 논문 추출
  const targets: PaperTarget[] = [];
  for (const guide of guides ?? []) {
    const content = (guide as Record<string, unknown>).exploration_guide_content as
      | Array<{ related_papers: Array<{ url?: string; title?: string; summary?: string }> }>
      | undefined;
    if (!content?.[0]?.related_papers) continue;

    const papers = content[0].related_papers;
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      if (!paper.url || paper.url === "") {
        targets.push({
          guide_id: (guide as Record<string, unknown>).id as string,
          guide_title: (guide as Record<string, unknown>).title as string,
          paper_index: i,
          paper_title: paper.title ?? "",
          paper_summary: paper.summary ?? null,
        });
      }
    }
  }

  console.log(`\n📚 매칭 대상: ${targets.length}건\n`);

  if (targets.length === 0) {
    console.log("✅ 매칭할 논문이 없습니다.");
    return;
  }

  let matched = 0;
  let notFound = 0;

  for (const target of targets) {
    // 2. 논문 제목+요약으로 임베딩 생성
    const inputText = [
      `제목: ${target.paper_title}`,
      target.paper_summary ? `요약: ${target.paper_summary}` : "",
      `가이드: ${target.guide_title}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_INPUT_CHARS);

    try {
      const { embedding: queryEmbedding } = await embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: inputText,
        providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
      });

      // 3. academic_sources 벡터 검색
      const { data: results, error: searchErr } = await supabase.rpc("search_academic_sources", {
        query_embedding: JSON.stringify(queryEmbedding),
        subject_filter: null,
        match_count: 3,
        similarity_threshold: SIMILARITY_THRESHOLD,
      });

      if (searchErr) {
        console.log(`  ❌ 검색 실패: ${target.paper_title.slice(0, 50)} — ${searchErr.message}`);
        notFound++;
        await delay(DELAY_MS);
        continue;
      }

      if (!results || results.length === 0) {
        console.log(`  ⏭️  미매칭: ${target.paper_title.slice(0, 60)} (유사도 < ${SIMILARITY_THRESHOLD})`);
        notFound++;
        await delay(DELAY_MS);
        continue;
      }

      const best = results[0] as {
        source_id: string;
        title: string;
        url: string;
        score: number;
        abstract_snippet: string | null;
        cited_text: string | null;
      };

      // 4. related_papers jsonb 업데이트
      const { data: contentRow } = await supabase
        .from("exploration_guide_content")
        .select("related_papers")
        .eq("guide_id", target.guide_id)
        .single();

      if (contentRow?.related_papers) {
        const papers = contentRow.related_papers as Array<Record<string, unknown>>;
        if (papers[target.paper_index]) {
          papers[target.paper_index].url = best.url;
          if (best.cited_text || best.abstract_snippet) {
            papers[target.paper_index].citedText = best.cited_text ?? best.abstract_snippet;
          }

          const { error: updateErr } = await supabase
            .from("exploration_guide_content")
            .update({ related_papers: papers })
            .eq("guide_id", target.guide_id);

          if (updateErr) {
            console.log(`  ❌ 업데이트 실패: ${target.paper_title.slice(0, 50)} — ${updateErr.message}`);
          } else {
            matched++;
            console.log(
              `  ✅ [${matched}] "${target.paper_title.slice(0, 40)}" → "${best.title.slice(0, 40)}" (${best.score.toFixed(2)})`,
            );

            // hit_count 증가
            await supabase.rpc("increment_source_hit_count", { source_id: best.source_id }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.log(
        `  ❌ 에러: ${target.paper_title.slice(0, 50)} — ${err instanceof Error ? err.message : String(err)}`,
      );
      notFound++;
    }

    await delay(DELAY_MS);
  }

  console.log(`\n📊 결과: ${matched} 매칭, ${notFound} 미매칭 (총 ${targets.length}건)`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
