#!/usr/bin/env npx tsx
/**
 * Synthesis Phase 2 재실행 스크립트 (김세린 + Wave 5.1d 파이프라인 수정 검증용)
 *
 * Phase 2 = edge_computation + guide_matching + haengteuk_linking.
 * 기존 pipeline row의 `tasks` 필드에서 이 3개 태스크를 pending 으로 reset 후
 * executeSynthesisPhase2 를 직접 호출한다 (HTTP route 우회 — validatePhasePrerequisites 생략).
 *
 * 사용법:
 *   npx tsx scripts/rerun-synthesis-phase-2.ts <pipeline_id>
 *
 * 예시:
 *   npx tsx scripts/rerun-synthesis-phase-2.ts 39843cfa-86bc-4fbc-9073-cc2d3df2afb7
 */

// dotenv 로드 먼저 (모듈 import 순서 중요)
import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { loadPipelineContext } from "../lib/domains/record-analysis/pipeline/pipeline-executor";
import { executeSynthesisPhase2 } from "../lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";

async function main() {
  const pipelineId = process.argv[2];
  if (!pipelineId) {
    console.error("❌ pipeline_id 필수");
    console.error("   사용법: npx tsx scripts/rerun-synthesis-phase-2.ts <pipeline_id>");
    process.exit(1);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  console.log(`🔍 파이프라인 조회: ${pipelineId}`);
  const { data: row, error } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, student_id, pipeline_type, status, tasks")
    .eq("id", pipelineId)
    .single();

  if (error || !row) {
    console.error(`❌ 파이프라인 조회 실패: ${error?.message ?? "not found"}`);
    process.exit(1);
  }
  if (row.pipeline_type !== "synthesis") {
    console.error(`❌ synthesis 파이프라인이 아님 (pipeline_type=${row.pipeline_type})`);
    process.exit(1);
  }

  console.log(`   student_id=${row.student_id}`);
  console.log(`   status=${row.status}`);

  // Phase 2 태스크만 pending 으로 reset
  const currentTasks = (row.tasks ?? {}) as Record<string, string>;
  const updatedTasks = {
    ...currentTasks,
    edge_computation: "pending",
    guide_matching: "pending",
    // haengteuk_linking 은 별도 태스크 키가 아닌 guide_matching 내부 후처리라 tasks 필드엔 없음
  };

  console.log(`🔄 태스크 상태 reset: edge_computation + guide_matching → pending`);
  const { error: resetErr } = await supabase
    .from("student_record_analysis_pipelines")
    .update({
      tasks: updatedTasks,
      status: "running",
    })
    .eq("id", pipelineId);
  if (resetErr) {
    console.error(`❌ reset 실패: ${resetErr.message}`);
    process.exit(1);
  }

  // Phase 2 재실행
  console.log(`▶️  executeSynthesisPhase2 호출`);
  const startMs = Date.now();
  try {
    const ctx = await loadPipelineContext(pipelineId);
    await executeSynthesisPhase2(ctx);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`✅ Phase 2 재실행 완료 (${elapsed}s)`);
  } catch (err) {
    console.error(`❌ Phase 2 실행 실패:`, err);
    process.exit(1);
  }

  // 재실행 후 status 복구
  await supabase
    .from("student_record_analysis_pipelines")
    .update({ status: row.status })
    .eq("id", pipelineId);

  // 결과 검증
  console.log(`\n📊 재실행 후 세특 배정 현황 조회`);
  const { data: assignments } = await supabase
    .from("exploration_guide_assignments")
    .select("id, school_year, target_subject_id, target_activity_type, linked_record_type")
    .eq("student_id", row.student_id)
    .is("target_activity_type", null);

  const setekByYear = new Map<number, number>();
  for (const a of assignments ?? []) {
    const y = (a.school_year as number) ?? 0;
    setekByYear.set(y, (setekByYear.get(y) ?? 0) + 1);
  }
  console.log(`   세특 배정 총 ${assignments?.length ?? 0}건`);
  for (const [year, count] of [...setekByYear.entries()].sort()) {
    console.log(`   - ${year}학년도: ${count}건`);
  }
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
