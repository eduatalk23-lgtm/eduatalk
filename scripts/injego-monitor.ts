import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";

async function main() {
  const sb = createSupabaseAdminClient()!;

  const { data: pipes } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, status, grade, updated_at, task_results")
    .eq("student_id", STUDENT_ID)
    .order("updated_at", { ascending: false });

  console.log(`\n=== 인제고 파이프라인 현황 (${new Date().toLocaleTimeString("ko-KR")}) ===\n`);

  const running = (pipes ?? []).filter(p => ["running", "pending"].includes(p.status));
  const completed = (pipes ?? []).filter(p => p.status === "completed");
  const failed = (pipes ?? []).filter(p => p.status === "failed");

  console.log(`총 ${pipes?.length ?? 0}건: running/pending=${running.length} completed=${completed.length} failed=${failed.length}\n`);

  for (const p of pipes ?? []) {
    const tr = (p.task_results ?? {}) as Record<string, unknown>;
    const taskCount = Object.keys(tr).length;
    const grade = p.grade ? `G${p.grade}` : "";
    console.log(`  ${p.pipeline_type} ${grade} [${p.status}] tasks=${taskCount} updated=${new Date(p.updated_at).toLocaleTimeString("ko-KR")}`);
  }

  if (running.length === 0 && completed.length > 0) {
    console.log("\n✅ 전체 완료 — 산출물 집계:\n");

    const [hes, edges, scores, tags, diag, strats, stories, arcs, roads] = await Promise.all([
      sb.from("student_record_hyperedges").select("edge_context").eq("student_id", STUDENT_ID),
      sb.from("student_record_edges").select("edge_context").eq("student_id", STUDENT_ID),
      sb.from("student_record_competency_scores").select("source").eq("student_id", STUDENT_ID),
      sb.from("student_record_activity_tags").select("tag_context").eq("student_id", STUDENT_ID),
      sb.from("student_record_diagnosis").select("scope").eq("student_id", STUDENT_ID),
      sb.from("student_record_strategies").select("scope").eq("student_id", STUDENT_ID),
      sb.from("student_record_storylines").select("scope").eq("student_id", STUDENT_ID),
      sb.from("student_record_narrative_arc").select("id").eq("student_id", STUDENT_ID),
      sb.from("student_record_roadmap_items").select("id").eq("student_id", STUDENT_ID),
    ]);

    const heByCtx = (hes.data ?? []).reduce((acc, h) => { acc[h.edge_context] = (acc[h.edge_context] || 0) + 1; return acc; }, {} as Record<string, number>);
    const edgeByCtx = (edges.data ?? []).reduce((acc, e) => { acc[e.edge_context] = (acc[e.edge_context] || 0) + 1; return acc; }, {} as Record<string, number>);
    const scoreBySrc = (scores.data ?? []).reduce((acc, s) => { acc[s.source] = (acc[s.source] || 0) + 1; return acc; }, {} as Record<string, number>);
    const tagByCtx = (tags.data ?? []).reduce((acc, t) => { acc[t.tag_context] = (acc[t.tag_context] || 0) + 1; return acc; }, {} as Record<string, number>);
    const storyByScope = (stories.data ?? []).reduce((acc, s) => { acc[s.scope] = (acc[s.scope] || 0) + 1; return acc; }, {} as Record<string, number>);

    console.log(`  하이퍼엣지: ${hes.data?.length ?? 0}`, heByCtx);
    console.log(`  엣지: ${edges.data?.length ?? 0}`, edgeByCtx);
    console.log(`  역량점수: ${scores.data?.length ?? 0}`, scoreBySrc);
    console.log(`  활동태그: ${tags.data?.length ?? 0}`, tagByCtx);
    console.log(`  진단: ${diag.data?.length ?? 0}`);
    console.log(`  전략: ${strats.data?.length ?? 0}`);
    console.log(`  storyline: ${stories.data?.length ?? 0}`, storyByScope);
    console.log(`  narrative_arc: ${arcs.data?.length ?? 0}`);
    console.log(`  로드맵: ${roads.data?.length ?? 0}`);

    // blueprint convergences detail
    const bpipe = await sb
      .from("student_record_analysis_pipelines")
      .select("task_results")
      .eq("student_id", STUDENT_ID)
      .eq("pipeline_type", "blueprint")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bpipe.data?.task_results) {
      const bp = ((bpipe.data.task_results as Record<string, unknown>)._blueprintPhase) as {
        targetConvergences?: Array<{ grade: number; semester?: number; themeLabel: string; tierAlignment?: string }>;
        milestones?: Record<string, unknown>;
      };
      console.log(`\n  Blueprint convergences:`);
      for (const c of bp?.targetConvergences ?? []) {
        console.log(`    - grade=${c.grade} tier=${c.tierAlignment} "${c.themeLabel}"`);
      }
      console.log(`  Milestones keys:`, Object.keys(bp?.milestones ?? {}));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
