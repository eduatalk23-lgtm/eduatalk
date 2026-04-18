/**
 * Phase 2 Auto-Bootstrap direct-call 검증 (tsx 경로)
 * HTTP 경로는 middleware auth 때문에 UI 로그인 필요.
 * tsx 로는 executeBootstrapPhase 직접 호출 — BT0 는 ctx.supabase(admin) 만 사용
 * 해서 통과. BT1/BT2 는 createSupabaseServerClient 의존으로 스킵.
 *
 * 검증 항목:
 *   1) pipeline row INSERT
 *   2) unique index 23505
 *   3) BOOTSTRAP_TASK_TIMEOUTS 조회 (NaN timeout 버그 fix 확인)
 *   4) BT0 target_major_validation 통과
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { runTargetMajorValidation } from "@/lib/domains/record-analysis/pipeline/bootstrap";
import { createClient } from "@supabase/supabase-js";
import { BOOTSTRAP_TASK_KEYS } from "@/lib/domains/record-analysis/pipeline/pipeline-config";
import { runTaskWithState } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";

const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  console.log("🚀 Phase 2 Direct-call 검증 (BT0 only)\n");

  await admin
    .from("student_record_analysis_pipelines")
    .delete()
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "bootstrap");

  const tasksInit: Record<string, string> = {};
  for (const k of BOOTSTRAP_TASK_KEYS) tasksInit[k] = "pending";

  // ── INSERT ─────────────────────────────────────
  const { data: row, error: insertErr } = await admin
    .from("student_record_analysis_pipelines")
    .insert({
      student_id: STUDENT_ID,
      tenant_id: TENANT_ID,
      pipeline_type: "bootstrap",
      status: "pending",
      tasks: tasksInit,
      task_previews: {},
      task_results: {},
      error_details: {},
      started_at: null,
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    console.error("❌ INSERT 실패:", insertErr?.message);
    process.exit(1);
  }
  console.log(`✓ pipeline INSERT: ${row.id}`);

  // ── unique index ────────────────────────────────
  const { error: dupErr } = await admin
    .from("student_record_analysis_pipelines")
    .insert({
      student_id: STUDENT_ID,
      tenant_id: TENANT_ID,
      pipeline_type: "bootstrap",
      status: "pending",
      tasks: tasksInit,
      task_previews: {},
      task_results: {},
      error_details: {},
      started_at: null,
    });
  const uniqueOk = dupErr?.code === "23505";
  console.log(`${uniqueOk ? "✓" : "✗"} unique index 23505`);

  // ── BT0 direct ──────────────────────────────────
  const ctx = await loadPipelineContext(row.id as string);
  await runTaskWithState(ctx, "target_major_validation", () => runTargetMajorValidation(ctx));

  const { data: resultRow } = await admin
    .from("student_record_analysis_pipelines")
    .select("tasks, task_previews, error_details")
    .eq("id", row.id as string)
    .single();
  const tasks = (resultRow?.tasks ?? {}) as Record<string, string>;
  const previews = (resultRow?.task_previews ?? {}) as Record<string, string>;
  const errors = (resultRow?.error_details ?? {}) as Record<string, string>;

  const bt0Ok = tasks.target_major_validation === "completed";
  console.log(
    `${bt0Ok ? "✓" : "✗"} BT0 target_major_validation: ${tasks.target_major_validation} — ${previews.target_major_validation ?? ""}`,
  );
  if (errors.target_major_validation) {
    console.log(`  err: ${errors.target_major_validation}`);
  }

  // ── 정리 ────────────────────────────────────────
  await admin
    .from("student_record_analysis_pipelines")
    .delete()
    .eq("id", row.id as string);

  const allOk = uniqueOk && bt0Ok;
  console.log(`\n${allOk ? "✅ 통과" : "❌ 실패"}`);
  console.log("\n참고: BT1(main_exp LLM) + BT2(course_plan) 는 HTTP 컨텍스트 필요 → UI 실측으로 검증");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ 예외:", err);
  process.exit(1);
});
