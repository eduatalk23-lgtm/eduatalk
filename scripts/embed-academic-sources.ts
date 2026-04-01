/**
 * academic_sources 임베딩 생성 스크립트
 *
 * 실행: set -a && source .env.local && set +a && npx tsx scripts/embed-academic-sources.ts
 */

import "dotenv/config";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 8000;
const DELAY_MS = 2000; // rate limit

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

  // pending 상태인 소스 조회
  const { data: sources, error } = await supabase
    .from("academic_sources")
    .select("id, title, abstract_snippet, cited_text, journal, keywords, subject_areas")
    .eq("embedding_status", "pending");

  if (error) {
    console.error("❌ DB 조회 실패:", error.message);
    process.exit(1);
  }

  console.log(`\n📚 임베딩 대상: ${sources.length}건\n`);

  let success = 0;
  let failed = 0;

  for (const source of sources) {
    const parts: string[] = [];
    parts.push(`제목: ${source.title}`);
    if (source.abstract_snippet) parts.push(`초록: ${source.abstract_snippet.slice(0, 2000)}`);
    if (source.cited_text) parts.push(`인용: ${source.cited_text.slice(0, 1500)}`);
    if (source.journal) parts.push(`학술지: ${source.journal}`);
    if (source.keywords?.length) parts.push(`키워드: ${source.keywords.join(", ")}`);
    if (source.subject_areas?.length) parts.push(`과목: ${source.subject_areas.join(", ")}`);

    const inputText = parts.join("\n\n").slice(0, MAX_INPUT_CHARS);

    try {
      const { embedding } = await embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: inputText,
        providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
      });

      const { error: updateErr } = await supabase
        .from("academic_sources")
        .update({
          embedding: JSON.stringify(embedding),
          embedding_status: "completed",
        })
        .eq("id", source.id);

      if (updateErr) throw updateErr;

      success++;
      console.log(`  ✅ [${success}/${sources.length}] ${source.title.slice(0, 50)}`);
    } catch (err) {
      failed++;
      console.log(`  ❌ ${source.title.slice(0, 50)} — ${err instanceof Error ? err.message : String(err)}`);

      await supabase
        .from("academic_sources")
        .update({ embedding_status: "failed" })
        .eq("id", source.id);
    }

    // rate limit 대기
    if (sources.indexOf(source) < sources.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n📊 결과: ${success} 성공, ${failed} 실패 (총 ${sources.length}건)`);
}

main().catch(console.error);
