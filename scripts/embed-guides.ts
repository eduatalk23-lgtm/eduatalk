#!/usr/bin/env npx tsx
// ============================================
// 가이드 임베딩 배치 스크립트
// Usage: npx tsx scripts/embed-guides.ts [--dry-run] [--limit=100]
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

async function main() {
  console.log("🔄 가이드 임베딩 배치 처리 시작");
  console.log(`   모드: ${dryRun ? "DRY-RUN (실제 임베딩 없음)" : "LIVE"}`);
  if (limit) console.log(`   제한: ${limit}건`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  // 임베딩이 없는 가이드 조회
  let query = supabase
    .from("exploration_guide_content")
    .select("guide_id")
    .is("embedding", null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data: targets, error } = await query;
  if (error) {
    console.error("❌ 대상 조회 실패:", error.message);
    process.exit(1);
  }

  if (!targets || targets.length === 0) {
    console.log("✅ 임베딩이 필요한 가이드가 없습니다.");
    return;
  }

  console.log(`📋 대상: ${targets.length}건`);

  if (dryRun) {
    console.log("🔍 DRY-RUN 모드 — 실제 임베딩을 생성하지 않습니다.");
    console.log(`   대상 guide_id 샘플: ${targets.slice(0, 5).map((t) => t.guide_id).join(", ")}`);
    return;
  }

  // Dynamic import to avoid loading AI SDK in dry-run
  const { embedBatchGuides } = await import(
    "../lib/domains/guide/vector/embedding-service"
  );

  const guideIds = targets.map((t) => t.guide_id);
  const startTime = Date.now();

  const result = await embedBatchGuides(guideIds, 50);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 배치 완료 (${elapsed}s)`);
  console.log(`   성공: ${result.success}건`);
  console.log(`   실패: ${result.failed}건`);

  // 전체 임베딩 상태 확인
  const { count: totalCount } = await supabase
    .from("exploration_guide_content")
    .select("*", { count: "exact", head: true });

  const { count: embeddedCount } = await supabase
    .from("exploration_guide_content")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  console.log(`\n📊 전체 상태: ${embeddedCount ?? 0}/${totalCount ?? 0} 임베딩 완료`);
}

main().catch((err) => {
  console.error("❌ 배치 처리 실패:", err);
  process.exit(1);
});
