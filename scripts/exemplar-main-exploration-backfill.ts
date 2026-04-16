#!/usr/bin/env npx tsx
/**
 * Phase δ-1 — exemplar 메인 탐구 패턴 backfill CLI.
 *
 * 사용법:
 *   npx tsx scripts/exemplar-main-exploration-backfill.ts              # 기본값 5건
 *   npx tsx scripts/exemplar-main-exploration-backfill.ts --limit=20   # 20건
 *   npx tsx scripts/exemplar-main-exploration-backfill.ts --dry-run    # LLM/DB 쓰기 생략
 *   npx tsx scripts/exemplar-main-exploration-backfill.ts --delay=5000 # Gemini Free Tier 안전
 *   npx tsx scripts/exemplar-main-exploration-backfill.ts --force      # 이미 채워진 exemplar 도 재추출
 *
 * Gemini Free Tier: 하루 20회, 분 15회 제한. 기본 delay=3000ms 보수.
 */

import { config } from "dotenv";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { runMainExplorationExtractionBatch } from "@/lib/domains/exemplar/extraction/main-exploration-extractor";

// ─── env ────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정 (.env.local 확인)");
  process.exit(1);
}

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? parseInt(delayArg.split("=")[1], 10) : 3000;

const versionArg = args.find((a) => a.startsWith("--version="));
const extractorVersion = versionArg ? versionArg.split("=")[1] : "v1";

// ─── 실행 ───────────────────────────────────────────────────────────────────

async function main() {
  const client: SupabaseClient<Database> = createClient<Database>(
    supabaseUrl as string,
    serviceRoleKey as string,
    { auth: { persistSession: false } },
  );

  console.log("─".repeat(60));
  console.log("exemplar main-exploration pattern backfill (δ-1)");
  console.log("─".repeat(60));
  console.log(`limit=${limit}, delay=${delayMs}ms, dryRun=${dryRun}, force=${force}, version=${extractorVersion}`);
  console.log("");

  const startMs = Date.now();
  const result = await runMainExplorationExtractionBatch({
    client,
    limit,
    delayMs,
    dryRun,
    force,
    extractorVersion,
    onProgress: (evt) => {
      console.log(`[${evt.phase}] ${evt.exemplarId} ${evt.message ?? ""}`.trim());
    },
  });

  const elapsed = Math.round((Date.now() - startMs) / 1000);
  console.log("");
  console.log("─".repeat(60));
  console.log(`processed=${result.processed} | ok=${result.succeeded} | fail=${result.failed} | skip=${result.skipped} | ${elapsed}s`);
  console.log("─".repeat(60));

  const failures = result.results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log("\n실패:");
    for (const f of failures) {
      console.log(`  - ${f.exemplarId}: ${f.error}`);
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
