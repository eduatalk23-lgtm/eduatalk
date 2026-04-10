#!/usr/bin/env npx tsx
/**
 * Phase A Step 3-c: 클러스터링 결과 DB import
 *
 * (1) /tmp/guide-clusters.json 의 고유 cluster_label 로 exploration_guide_topic_clusters INSERT
 * (2) 각 가이드의 topic_cluster_id + topic_cluster_confidence UPDATE
 *
 * Usage: set -a; source .env.local; set +a; npx tsx scripts/import-guide-clusters.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ env 필요"); process.exit(1);
}

const INPUT_PATH = "/tmp/guide-clusters.json";

interface ClusterResult {
  id: string;
  cluster_label: string;
  confidence: number;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);
  const results: ClusterResult[] = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  console.log(`📂 ${results.length}건 로드`);

  // 고유 cluster_label 추출
  const uniqueLabels = [...new Set(results.map((r) => r.cluster_label))].sort();
  console.log(`🏷️  고유 cluster: ${uniqueLabels.length}개`);

  // (1) exploration_guide_topic_clusters INSERT
  const labelToUuid = new Map<string, string>();
  for (const label of uniqueLabels) {
    // label 형식: "reading__42" | "topic_exploration__all"
    const parts = label.split("__");
    const guideType = parts[0];
    const clusterIdx = parts[1];

    const { data, error } = await supabase
      .from("exploration_guide_topic_clusters")
      .insert({
        name: `${guideType} cluster ${clusterIdx}`,  // 임시 이름 — Step 4 LLM 라벨링에서 갱신
        guide_type: guideType,
        source: "llm_auto",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`❌ cluster insert 실패 (${label}):`, error.message);
      continue;
    }
    labelToUuid.set(label, data.id);
  }
  console.log(`✅ ${labelToUuid.size}개 cluster 생성`);

  // (2) 가이드 UPDATE (배치 — 500건씩)
  const BATCH = 500;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    for (const r of batch) {
      const clusterId = labelToUuid.get(r.cluster_label);
      if (!clusterId) { skipped++; continue; }
      const { error } = await supabase
        .from("exploration_guides")
        .update({
          topic_cluster_id: clusterId,
          topic_cluster_confidence: r.confidence,
        })
        .eq("id", r.id);
      if (error) {
        skipped++;
      } else {
        updated++;
      }
    }
    process.stdout.write(`\r   ${updated}/${results.length} updated...`);
  }
  console.log(`\n✅ ${updated}건 update (skipped ${skipped})`);

  // (3) cluster stats 새로고침 (트리거가 한 건씩 처리하지만, 대량 insert 후 정합성 보장)
  console.log("🔄 cluster stats 갱신...");
  for (const uuid of labelToUuid.values()) {
    await supabase.rpc("refresh_topic_cluster_stats", { p_cluster_id: uuid }).catch(() => {});
  }
  console.log("✅ 완료");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
