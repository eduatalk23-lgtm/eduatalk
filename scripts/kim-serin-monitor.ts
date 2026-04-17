#!/usr/bin/env npx tsx
/**
 * 김세린 파이프라인 실행 순서 모니터링.
 * #1 UI runFullSequence 순서 검증용 — grade analysis → past → blueprint → grade design → synth.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

async function main() {
  const sb = createSupabaseAdminClient()!;

  const { data: pipes } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, status, mode, grade, started_at, updated_at, tasks")
    .eq("student_id", STUDENT_ID)
    .order("started_at", { ascending: true, nullsFirst: true });

  console.log(`\n=== 김세린 파이프라인 실행 순서 (${new Date().toLocaleTimeString("ko-KR")}) ===\n`);

  const running = (pipes ?? []).filter((p) => ["running", "pending"].includes(p.status));
  const completed = (pipes ?? []).filter((p) => p.status === "completed");
  const failed = (pipes ?? []).filter((p) => p.status === "failed");
  const cancelled = (pipes ?? []).filter((p) => p.status === "cancelled");

  console.log(
    `총 ${pipes?.length ?? 0}건 · running=${running.length} completed=${completed.length} failed=${failed.length} cancelled=${cancelled.length}\n`,
  );

  for (const p of pipes ?? []) {
    const tasks = (p.tasks ?? {}) as Record<string, string>;
    const counts = { completed: 0, running: 0, pending: 0, failed: 0, skipped: 0 };
    for (const s of Object.values(tasks)) {
      if (s in counts) counts[s as keyof typeof counts]++;
    }
    const taskSummary = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([k, c]) => `${k}=${c}`)
      .join(", ");
    const gradePart = p.grade ? `/G${p.grade}` : "";
    const modePart = p.mode ? `/${p.mode}` : "";
    const startedMs = p.started_at ? new Date(p.started_at).toLocaleTimeString("ko-KR") : "—";
    const updatedMs = new Date(p.updated_at).toLocaleTimeString("ko-KR");
    const elapsed = p.started_at
      ? `(${Math.round((new Date(p.updated_at).getTime() - new Date(p.started_at).getTime()) / 1000)}s)`
      : "";
    console.log(
      `  ${p.pipeline_type}${gradePart}${modePart.padEnd(10)} [${p.status.padEnd(9)}] ` +
        `started=${startedMs} updated=${updatedMs} ${elapsed}`,
    );
    if (taskSummary) console.log(`     · ${taskSummary}`);
  }

  // 시계열 정렬: started_at 오름차순 요약
  console.log(`\n📊 시작 순서 (started_at):`);
  const ordered = (pipes ?? [])
    .filter((p) => p.started_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime());
  for (const p of ordered) {
    const gradePart = p.grade ? `/G${p.grade}` : "";
    const modePart = p.mode ? `/${p.mode}` : "";
    console.log(`  ${new Date(p.started_at!).toISOString().slice(11, 19)} — ${p.pipeline_type}${gradePart}${modePart}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
