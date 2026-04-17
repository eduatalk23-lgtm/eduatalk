#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 파생 DB 클린업 전용 (UI 전체 실행 직전 사용).
 * injego-session-c-fullrun.ts의 cleanup 함수만 추출.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("admin client unavailable");

  console.log(`🧹 인제고 1학년 (${STUDENT_ID}) 파생 DB 클린업 시작`);

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
