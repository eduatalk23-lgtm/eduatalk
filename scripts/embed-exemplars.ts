#!/usr/bin/env npx tsx
/**
 * Exemplar 서술형 임베딩 배치 생성 CLI
 *
 * 4개 소스 테이블(exemplar_seteks / exemplar_creative_activities / exemplar_haengteuk / exemplar_reading)
 * 의 content 를 Gemini `gemini-embedding-2-preview` (768d) 로 임베딩하여
 * `exemplar_narrative_embeddings` 테이블에 upsert.
 *
 * 사용법:
 *   npx tsx scripts/embed-exemplars.ts --dry-run            # 대상만 출력
 *   npx tsx scripts/embed-exemplars.ts --limit=50           # 50 row 만
 *   npx tsx scripts/embed-exemplars.ts --source=seteks      # 세특만
 *   npx tsx scripts/embed-exemplars.ts --force              # 기존 임베딩도 재생성
 *   npx tsx scripts/embed-exemplars.ts                      # 전체 처리
 *
 * 옵션:
 *   --source=seteks|creative_activities|haengteuk|reading|all  (기본 all)
 *   --batch-size=N   한 번에 embedMany 에 보낼 개수 (기본 64)
 *   --dry-run        쿼리만 수행, 임베딩·저장 생략
 *   --force          기존 임베딩(content_hash 일치) 도 재생성
 *   --limit=N        처리 대상 상한
 *
 * 전제: .env.local 에 GOOGLE_GENERATIVE_AI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { config } from "dotenv";
import path from "path";
import crypto from "crypto";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { geminiRateLimiter } from "@/lib/domains/plan/llm/providers/gemini";

// ─── env ────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY 미설정 (.env.local)");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase 환경변수 미설정");
  process.exit(1);
}

// ─── const ──────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIM = 768;
const MAX_INPUT_CHARS = 8000;

const SOURCE_CONFIG: Record<
  string,
  { table: string; contentCol: string; labelCol: string }
> = {
  seteks: {
    table: "exemplar_seteks",
    contentCol: "content",
    labelCol: "subject_name",
  },
  creative_activities: {
    table: "exemplar_creative_activities",
    contentCol: "content",
    labelCol: "activity_type",
  },
  haengteuk: {
    table: "exemplar_haengteuk",
    contentCol: "content",
    labelCol: "grade",
  },
  reading: {
    table: "exemplar_reading",
    contentCol: "book_description",
    labelCol: "book_title",
  },
};

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const getArg = (name: string, fallback: string) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : fallback;
};

const sourceArg = getArg("source", "all");
const batchSize = parseInt(getArg("batch-size", "64"), 10);
const limit = parseInt(getArg("limit", "0"), 10); // 0 = 무제한

const targetSources =
  sourceArg === "all" ? Object.keys(SOURCE_CONFIG) : [sourceArg];

// ─── helpers ────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function preview(text: string, max = 500): string {
  return text.length > max ? text.slice(0, max) : text;
}

// ─── Supabase admin client ──────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ─── 단일 source 처리 ───────────────────────────────────────────────────────

interface Candidate {
  source_table: string;
  source_id: string;
  exemplar_id: string;
  content: string;
  content_hash: string;
  preview: string;
}

async function collectCandidates(sourceKey: string): Promise<Candidate[]> {
  const cfg = SOURCE_CONFIG[sourceKey];
  if (!cfg) throw new Error(`unknown source: ${sourceKey}`);

  // 모든 row 조회 — 페이지네이션 (Supabase 기본 1000 제한)
  const rows: Array<Record<string, unknown>> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(cfg.table)
      .select(`id, exemplar_id, ${cfg.contentCol}`)
      .not(cfg.contentCol, "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error(`  ❌ select ${cfg.table} @${offset}:`, JSON.stringify(error, null, 2));
      throw error;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  const candidates: Candidate[] = [];
  for (const r of rows) {
    const content = String(r[cfg.contentCol] ?? "").trim();
    if (content.length < 10) continue;
    const truncated = content.slice(0, MAX_INPUT_CHARS);
    candidates.push({
      source_table: cfg.table,
      source_id: r.id as string,
      exemplar_id: r.exemplar_id as string,
      content: truncated,
      content_hash: sha256(truncated),
      preview: preview(truncated),
    });
  }

  // force=false 면 이미 임베딩된(content_hash 일치) row 제외
  // Note: .in() 은 URL 길이 제한으로 대규모 ids 배열 실패 → 전체 테이블 페이지네이션 조회 후 메모리 비교
  if (!force && candidates.length > 0) {
    const existingMap = new Map<string, string>();
    for (let offset = 0; ; offset += 1000) {
      const { data, error: err2 } = await supabase
        .from("exemplar_narrative_embeddings")
        .select("source_id, content_hash")
        .eq("source_table", cfg.table)
        .eq("embedding_model", EMBEDDING_MODEL)
        .range(offset, offset + 999);
      if (err2) {
        console.error(`  ❌ existing lookup ${cfg.table} @${offset}:`, JSON.stringify(err2, null, 2));
        throw err2;
      }
      if (!data || data.length === 0) break;
      for (const e of data) {
        existingMap.set((e as { source_id: string }).source_id, (e as { content_hash: string }).content_hash);
      }
      if (data.length < 1000) break;
    }

    return candidates.filter(
      (c) => existingMap.get(c.source_id) !== c.content_hash,
    );
  }

  return candidates;
}

// ─── 배치 임베딩 + upsert ───────────────────────────────────────────────────

async function embedAndUpsertWithRetry(
  batch: Candidate[],
  maxRetries = 6,
): Promise<{ ok: number; fail: number }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await embedAndUpsert(batch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // RPD(일일) 한도 소진 감지 — retry-after 기다려도 회복 안 되므로 즉시 포기
      if (/limit:\s*1000/.test(msg) && /embed_content_paid_tier_requests/.test(msg)) {
        throw new Error("Daily RPD quota exhausted — resume tomorrow 17:00 KST");
      }
      const is429 = msg.includes("quota") || msg.includes("429") || msg.includes("rate");
      const retryMatch = msg.match(/retry in ([\d.]+)s/i);
      if (is429 && attempt < maxRetries) {
        const waitMs = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000
          : 60_000;
        console.log(
          `   ⏳ rate-limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("max retries exceeded");
}

async function embedAndUpsert(batch: Candidate[]): Promise<{ ok: number; fail: number }> {
  // embedMany 호출 (rate-limited)
  const { embeddings } = await geminiRateLimiter.execute(async () => {
    return embedMany({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch.map((c) => c.content),
      providerOptions: { google: { outputDimensionality: EMBEDDING_DIM } },
    });
  });

  if (embeddings.length !== batch.length) {
    throw new Error(`embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`);
  }

  // upsert — UNIQUE(source_table, source_id, embedding_model)
  const rows = batch.map((c, i) => ({
    exemplar_id: c.exemplar_id,
    source_table: c.source_table,
    source_id: c.source_id,
    content_hash: c.content_hash,
    content_preview: c.preview,
    embedding: JSON.stringify(embeddings[i]),
    embedding_model: EMBEDDING_MODEL,
  }));

  const { error } = await supabase
    .from("exemplar_narrative_embeddings")
    .upsert(rows, {
      onConflict: "source_table,source_id,embedding_model",
    });

  if (error) {
    console.error("   ⚠️ upsert 실패:", error.message);
    return { ok: 0, fail: batch.length };
  }

  return { ok: batch.length, fail: 0 };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("─".repeat(70));
  console.log("Exemplar Narrative Embedding Batch");
  console.log("─".repeat(70));
  console.log(`model      : ${EMBEDDING_MODEL} (${EMBEDDING_DIM}d)`);
  console.log(`sources    : ${targetSources.join(", ")}`);
  console.log(`batch-size : ${batchSize}`);
  console.log(`limit      : ${limit || "∞"}`);
  console.log(`dry-run    : ${dryRun}`);
  console.log(`force      : ${force}`);
  console.log("");

  const totals = { candidates: 0, ok: 0, fail: 0 };
  const startMs = Date.now();

  for (const sourceKey of targetSources) {
    const cfg = SOURCE_CONFIG[sourceKey];
    if (!cfg) {
      console.log(`⏭️  unknown source: ${sourceKey}, skip`);
      continue;
    }

    console.log(`── [${sourceKey}] ${cfg.table} ─────────────────────────`);
    const all = await collectCandidates(sourceKey);
    const work = limit > 0 ? all.slice(0, Math.max(0, limit - totals.candidates)) : all;
    console.log(`   대상 row: ${all.length} (처리: ${work.length}${force ? "" : ", 기존 임베딩 제외"})`);
    totals.candidates += work.length;

    if (dryRun || work.length === 0) continue;

    for (let i = 0; i < work.length; i += batchSize) {
      const batch = work.slice(i, i + batchSize);
      const batchNo = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(work.length / batchSize);

      const t0 = Date.now();
      try {
        const r = await embedAndUpsertWithRetry(batch);
        totals.ok += r.ok;
        totals.fail += r.fail;
        const dt = Math.round((Date.now() - t0) / 1000);
        console.log(`   batch ${batchNo}/${totalBatches}: ok=${r.ok} fail=${r.fail} (${dt}s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        totals.fail += batch.length;
        console.log(`   batch ${batchNo}/${totalBatches}: ❌ ${msg}`);
        // 일일 쿼터 소진 시 즉시 중단 (남은 batch 전부 실패할 것)
        if (msg.includes("Daily RPD quota exhausted")) {
          console.log("\n💤 일일 쿼터 소진 — 내일 17:00 KST 이후 재실행 권장");
          const elapsed = Math.round((Date.now() - startMs) / 1000);
          console.log(`총 대상 ${totals.candidates} | 성공 ${totals.ok} | 실패 ${totals.fail} | ${elapsed}s`);
          process.exit(0);
        }
      }

      // 배치 간 딜레이 (rate limit 보수) — 분당 ~50 call 목표
      if (i + batchSize < work.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (limit > 0 && totals.candidates >= limit) break;
  }

  const elapsed = Math.round((Date.now() - startMs) / 1000);
  console.log("");
  console.log("─".repeat(70));
  console.log(`총 대상 ${totals.candidates} | 성공 ${totals.ok} | 실패 ${totals.fail} | ${elapsed}s`);
  console.log("─".repeat(70));

  process.exit(totals.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fatal:", err instanceof Error ? err.stack : JSON.stringify(err, null, 2));
  process.exit(1);
});
