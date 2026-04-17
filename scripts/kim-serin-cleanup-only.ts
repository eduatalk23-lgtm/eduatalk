#!/usr/bin/env npx tsx
/**
 * 김세린 파생 DB 클린업 전용 (UI 전체 실행 직전 사용).
 * injego-cleanup-only.ts와 구조 동일. NEIS 원본(imported_content) 및
 * main_exploration은 보존하고 파이프라인 파생물만 삭제한다.
 *
 * 사용 목적: 04-17 A에서 제기된 runFullSequence 실행 순서 이슈 검증
 * (grade analysis → past → blueprint 순차 실행 확인).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("admin client unavailable");

  console.log(`🧹 김세린 (${STUDENT_ID}) 파생 DB 클린업 시작`);

  await supabase.from("student_record_analysis_pipelines").delete().eq("student_id", STUDENT_ID);

  await Promise.all([
    supabase.from("student_record_setek_guides").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_changche_guides").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_haengteuk_guides").delete().eq("student_id", STUDENT_ID),
  ]);

  await Promise.all([
    supabase.from("student_record_seteks").update({ ai_draft_content: null }).eq("student_id", STUDENT_ID),
    supabase.from("student_record_changche").update({ ai_draft_content: null }).eq("student_id", STUDENT_ID),
    supabase.from("student_record_haengteuk").update({ ai_draft_content: null }).eq("student_id", STUDENT_ID),
  ]);

  await Promise.all([
    supabase.from("student_record_hyperedges").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_activity_tags").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_competency_scores").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_content_quality").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_analysis_cache").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_narrative_arc").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_storylines").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_profile_cards").delete().eq("student_id", STUDENT_ID),
  ]);

  console.log(`🧹 클린업 완료`);
}

main().catch((err) => {
  console.error("cleanup failed:", err);
  process.exit(1);
});
