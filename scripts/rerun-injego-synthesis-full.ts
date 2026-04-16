#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 학생 Synthesis 풀런 재실행 (2026-04-16 B5/C2/A2/C3/C1 검증용).
 *
 * 기존 synthesis 파이프라인을 reset 후 Phase 1 → 6 순차 실행.
 * narrative_arc_extraction 은 청크 경로(executeSynthesisPhase2NarrativeChunk)로
 * hasMore=false 까지 반복 후 Phase 2 main 호출.
 *
 * 검증 포인트:
 *   B4: blueprint 1학년 foundational 수렴 1건 이상
 *   B3: bridge 하이퍼엣지 shared_competencies 비어있지 않음
 *   B1: diagnosis direction_strength=weak 해제 또는 weaknesses에 "이수율 0%" 미포함
 *   B5: strategy suggestions 중 reasoning 에 "Bridge:" 포함
 *   C2: projected edge → hyperedge (edge_context=projected) 생성
 *   A2: haengteuk_linking 150s 이내 완료
 *   C3: roadmap items plan_content/rationale 에 blueprint 테마 반영
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
} from "../lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  // 기존 synthesis 파이프라인 조회
  const { data: existing } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status, tasks")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    console.error(`❌ synthesis 파이프라인 없음. UI에서 최초 1회 생성 후 재실행 필요.`);
    process.exit(1);
  }

  const pipelineId = existing.id;
  console.log(`🔄 Synthesis 파이프라인 reset: ${pipelineId.slice(0, 8)}`);

  // 모든 태스크를 pending 으로 reset (전체 재실행)
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

  // 기존 DB 산출물 클린업
  console.log(`🧹 기존 파생 산출물 클린업`);
  await Promise.all([
    // hyperedges (blueprint/bridge/analysis/projected/synthesis_inferred 전부)
    supabase.from("student_record_hyperedges").delete().eq("student_id", STUDENT_ID),
    // diagnosis / strategies / roadmap items
    supabase.from("student_record_diagnosis").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").delete().eq("student_id", STUDENT_ID),
    // edges: synthesis_inferred 만 클린 (analysis/projected 는 grade pipeline 산출물이라 유지)
    supabase.from("student_record_edges").delete().eq("student_id", STUDENT_ID).eq("edge_context", "synthesis_inferred"),
  ]);

  // ── 순차 실행 ──
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
    // Phase 1
    await runPhase(1, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase1(ctx);
    });

    // Phase 2: narrative_arc chunked → main
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
          console.warn(`   청크 루프 20회 초과 — 비정상. 중단.`);
          break;
        }
      }
      // Phase 2 main
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase2(ctx);
    });

    // Phase 3
    await runPhase(3, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase3(ctx);
    });

    // Phase 4
    await runPhase(4, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase4(ctx);
    });

    // Phase 5
    await runPhase(5, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase5(ctx);
    });

    // Phase 6
    await runPhase(6, async () => {
      const ctx = await loadPipelineContext(pipelineId);
      await executeSynthesisPhase6(ctx);
    });

    const totalElapsed = ((Date.now() - phaseStart) / 1000).toFixed(1);
    console.log(`\n✅ Synthesis 풀런 완료 (총 ${totalElapsed}s)`);
  } catch (err) {
    const totalElapsed = ((Date.now() - phaseStart) / 1000).toFixed(1);
    console.error(`\n❌ Synthesis 풀런 중단 (${totalElapsed}s)`);
    // 최종 파이프라인 상태 요약
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
