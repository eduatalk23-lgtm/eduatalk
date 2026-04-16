#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 grade(design) 파이프라인 심층 조사.
 * - task 상태 (어떤 태스크가 completed/failed/skipped인지)
 * - 가이드 테이블 조회 + source 컬럼 확인
 * - draft_generation 결과
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");

  // ── 파이프라인 tasks 상세 ──
  const { data: pipelines, error: pipelineErr } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, grade, mode, status, tasks")
    .eq("student_id", STUDENT_ID)
    .order("started_at", { ascending: true });
  if (pipelineErr) console.error("pipeline ERR", pipelineErr);
  console.log(`pipelines: ${pipelines?.length ?? 0}건`);

  for (const p of pipelines ?? []) {
    console.log(`\n═══ ${p.pipeline_type}${(p as { mode?: string }).mode ? `(${(p as { mode?: string }).mode})` : ""} ${p.grade ? `G${p.grade}` : ""} — ${(p.id as string).slice(0, 8)} ═══`);
    const tasks = (p.tasks ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(tasks)) {
      const marker = v === "completed" ? "✓" : v === "failed" ? "✗" : v === "skipped" ? "→" : "·";
      console.log(`   ${marker} ${k}: ${v}`);
    }
  }

  // ── 가이드 조회 (모든 필드) ──
  for (const table of ["student_record_setek_guides", "student_record_changche_guides", "student_record_haengteuk_guides"] as const) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .eq("student_id", STUDENT_ID);
    console.log(`\n## ${table}: ${rows?.length ?? 0}건${error ? ` ERROR ${error.message}` : ""}`);
    for (const r of (rows ?? []).slice(0, 3)) {
      const keys = Object.keys(r as Record<string, unknown>);
      console.log(`   keys: ${keys.slice(0, 10).join(", ")}${keys.length > 10 ? ` +${keys.length - 10}` : ""}`);
      console.log(`   sample: grade=${(r as Record<string, unknown>).grade} guide_mode=${(r as Record<string, unknown>).guide_mode}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
