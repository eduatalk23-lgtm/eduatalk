#!/usr/bin/env npx tsx
/**
 * xrun-seed-01 Synthesis 풀런 재실행 (Phase 4b Sprint 3 S7 measurement, 2026-04-19).
 *
 * Run 1 (04-18) Blueprint+Grade+Synthesis 결과 재사용. Synthesis 만 reset 후 S1→S7 순차 실행.
 * S7 tier_plan_refinement task_result 의 action / jaccardOverall / jaccardByTier 수집 목적.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { loadPipelineContext } from "../lib/domains/record-analysis/pipeline/pipeline-executor";
import {
  executeSynthesisPhase1,
  executeSynthesisPhase2,
  executeSynthesisPhase2NarrativeChunk,
  executeSynthesisPhase3,
  executeSynthesisPhase4,
  executeSynthesisPhase5,
  executeSynthesisPhase6,
  executeSynthesisPhase7,
} from "../lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status, tasks")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    console.error(`❌ synthesis 파이프라인 없음. tmp/xrun-pipeline.ts 풀런 먼저 필요.`);
    process.exit(1);
  }

  const pipelineId = existing.id;
  console.log(`🔄 Synthesis 파이프라인 reset: ${pipelineId.slice(0, 8)}`);

  const resetTasks: Record<string, string> = {};
  for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
    resetTasks[key] = "pending";
  }

  await supabase
    .from("student_record_analysis_pipelines")
    .update({
      tasks: resetTasks,
      status: "running",
      previews: {},
      results: {},
      errors: {},
      started_at: new Date().toISOString(),
    })
    .eq("id", pipelineId);

  console.log(`🧹 기존 파생 산출물 클린업`);
  await Promise.all([
    supabase.from("student_record_hyperedges").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").delete().eq("student_id", STUDENT_ID).eq("edge_context", "synthesis_inferred"),
  ]);

  const phaseStart = Date.now();

  async function runPhase(n: number, runner: () => Promise<unknown>) {
    const t0 = Date.now();
    console.log(`\n▶️  Phase ${n} 시작`);
    try {
      await runner();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✅ Phase ${n} 완료 (${elapsed}s)`);
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.error(`❌ Phase ${n} 실패 (${elapsed}s):`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  try {
    await runPhase(1, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase1(ctx);
    });

    await runPhase(2, async () => {
      let hasMore = true;
      let chunks = 0;
      while (hasMore) {
        const ctx = await loadPipelineContext(pipelineId);
        const r = await executeSynthesisPhase2NarrativeChunk(ctx, 4);
        hasMore = r.hasMore;
        chunks++;
        console.log(`   narrative chunk ${chunks}: processed=${r.chunkProcessed} hasMore=${hasMore}`);
        if (chunks > 20) {
          console.warn(`   청크 루프 20회 초과 — 중단.`);
          break;
        }
      }
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase2(ctx);
    });

    await runPhase(3, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase3(ctx);
    });

    await runPhase(4, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase4(ctx);
    });

    await runPhase(5, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase5(ctx);
    });

    await runPhase(6, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase6(ctx);
    });

    await runPhase(7, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase7(ctx);
    });

    const totalElapsed = ((Date.now() - phaseStart) / 1000).toFixed(1);
    console.log(`\n✅ Synthesis 풀런 완료 (총 ${totalElapsed}s) — pipelineId=${pipelineId}`);
  } catch (err) {
    const totalElapsed = ((Date.now() - phaseStart) / 1000).toFixed(1);
    console.error(`\n❌ Synthesis 풀런 중단 (${totalElapsed}s)`);
    const { data: final } = await supabase
      .from("student_record_analysis_pipelines")
      .select("status, tasks, errors")
      .eq("id", pipelineId)
      .maybeSingle();
    if (final) {
      const tasks = (final.tasks ?? {}) as Record<string, string>;
      const errors = (final.errors ?? {}) as Record<string, string>;
      console.error(`   status=${final.status}`);
      for (const [k, v] of Object.entries(tasks)) {
        if (v !== "completed") {
          console.error(`   - ${k}: ${v}${errors[k] ? ` — ${errors[k]}` : ""}`);
        }
      }
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
