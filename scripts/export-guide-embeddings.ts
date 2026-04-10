#!/usr/bin/env npx tsx
/**
 * Phase A Step 3-a: 가이드 embedding export
 *
 * approved + is_latest 가이드의 (id, guide_type, difficulty_level, embedding) 을
 * JSON Lines 형식으로 /tmp/guide-embeddings.jsonl 에 export.
 * Python clustering 스크립트의 입력으로 사용.
 *
 * Usage: npx tsx scripts/export-guide-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const OUT_PATH = "/tmp/guide-embeddings.jsonl";

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

  console.log("🔍 approved + is_latest 가이드 조회...");

  // 가이드 메타 (paginated — Supabase 기본 1000건 제한 대응)
  const guides: Array<{ id: string; guide_type: string; difficulty_level: string | null; title: string }> = [];
  let gOffset = 0;
  while (true) {
    const { data, error: gErr } = await supabase
      .from("exploration_guides")
      .select("id, guide_type, difficulty_level, title")
      .eq("status", "approved")
      .eq("is_latest", true)
      .order("guide_type")
      .order("title")
      .range(gOffset, gOffset + 999);
    if (gErr) { console.error("❌ 가이드 조회 실패:", gErr.message); process.exit(1); }
    if (!data || data.length === 0) break;
    guides.push(...data);
    gOffset += data.length;
    if (data.length < 1000) break;
  }
  console.log(`   가이드 ${guides.length}건`);

  // embedding 은 별도 조회 (content 테이블, vector → text cast)
  // pgvector vector 는 Supabase JS 에서 문자열로 반환됨: "[0.1,0.2,...]"
  const PAGE = 500;
  const embedMap = new Map<string, string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("exploration_guide_content")
      .select("guide_id, embedding")
      .not("embedding", "is", null)
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("❌ embedding 조회 실패:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      embedMap.set(r.guide_id, r.embedding as string);
    }
    offset += data.length;
    if (data.length < PAGE) break;
  }
  console.log(`   embedding ${embedMap.size}건`);

  // 조인 + JSONL 출력
  const lines: string[] = [];
  let skipped = 0;
  for (const g of guides) {
    const emb = embedMap.get(g.id);
    if (!emb) { skipped++; continue; }
    lines.push(JSON.stringify({
      id: g.id,
      guide_type: g.guide_type,
      difficulty_level: g.difficulty_level,
      title: g.title,
      embedding: emb, // pgvector 문자열 "[0.1,0.2,...]"
    }));
  }

  writeFileSync(OUT_PATH, lines.join("\n"), "utf-8");
  console.log(`✅ ${OUT_PATH} 에 ${lines.length}건 export (skipped ${skipped})`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
