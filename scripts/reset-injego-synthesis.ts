#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 학생 Synthesis 파이프라인을 UI 재실행 가능 상태로 reset.
 *
 * CLI 에서 executeSynthesisPhase* 를 직접 호출하면 requireAdminOrConsultant 가
 * 쿠키 기반 세션을 요구하므로 phase 3~6 이 silent fail. → 완료 표시만 남은 빈 상태.
 * 이 스크립트는 synthesis 파이프라인 상태를 pending 으로 재설정하여
 * UI 에서 "재실행" 버튼으로 깨끗이 돌릴 수 있게 만든다.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    console.log(`ℹ️  synthesis 파이프라인 없음 — UI 에서 새로 생성`);
    return;
  }

  const resetTasks: Record<string, string> = {};
  for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
    resetTasks[key] = "pending";
  }

  await supabase
    .from("student_record_analysis_pipelines")
    .update({
      tasks: resetTasks,
      status: "pending",
      previews: {},
      results: {},
      errors: {},
    })
    .eq("id", existing.id);

  // 파생 산출물 클린업 (이미 CLI 에서 삭제됐지만 멱등 유지)
  await Promise.all([
    supabase.from("student_record_hyperedges").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").delete().eq("student_id", STUDENT_ID).eq("edge_context", "synthesis_inferred"),
  ]);

  console.log(`✅ Synthesis 파이프라인 reset (id=${existing.id.slice(0, 8)})`);
  console.log(`   → UI 에서 재실행 가능`);
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
