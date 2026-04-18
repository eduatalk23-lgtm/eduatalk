#!/usr/bin/env npx tsx
/**
 * xrun-seed-01 S7 tier_plan_refinement 단독 재실행 (max chain guard 실측용).
 *
 * 전제:
 *   - S1~S6 이 이미 completed 상태
 *   - dev 서버가 advanced tier + gpt-5.4 override 로 재시작되어 있음
 *   - xrun v2 active (chainDepth=2, MAX=2) → guard 발동 기대
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `xrun-s7guard-${Date.now()}@example.invalid`;
  const password = `Xrun-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("temp admin 생성 실패");
  await admin.from("user_profiles").insert({
    id: createRes.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "Xrun S7 Guard", is_active: true,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password });
  if (!si.session) throw new Error("temp admin 로그인 실패");
  const b64url = Buffer.from(JSON.stringify(si.session), "utf-8")
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const projectRef = new URL(url).hostname.split(".")[0];
  TEMP_COOKIE_HEADER = `sb-${projectRef}-auth-token=base64-${b64url}`;
  TEMP_USER_ID = createRes.user.id;
}

async function cleanupTempAdmin() {
  if (!TEMP_USER_ID) return;
  const admin = createSupabaseAdminClient()!;
  await admin.from("user_profiles").delete().eq("id", TEMP_USER_ID).catch(() => undefined);
  await admin.auth.admin.deleteUser(TEMP_USER_ID).catch(() => undefined);
}

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  await provisionTempAdmin();

  const { data: existing } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, tasks, task_results, task_previews")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    console.error("❌ synthesis 파이프라인 없음");
    process.exit(1);
  }

  const pipelineId = existing.id;
  console.log(`🔄 S7 만 pending 으로 리셋: ${pipelineId.slice(0, 8)}`);

  const tasks = { ...(existing.tasks as Record<string, string>), tier_plan_refinement: "pending" };
  const results = { ...(existing.task_results as Record<string, unknown>) };
  delete results.tier_plan_refinement;
  const previews = { ...(existing.task_previews as Record<string, unknown>) };
  delete previews.tier_plan_refinement;

  await supabase
    .from("student_record_analysis_pipelines")
    .update({ tasks, task_results: results, task_previews: previews, status: "running" })
    .eq("id", pipelineId);

  const t0 = Date.now();
  console.log(`▶ POST /api/admin/pipeline/synthesis/phase-7`);
  const res = await fetch(`${BASE_URL}/api/admin/pipeline/synthesis/phase-7`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: TEMP_COOKIE_HEADER },
    body: JSON.stringify({ pipelineId }),
  });
  const text = await res.text();
  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    console.error(`❌ S7 실패 (${elapsedS}s): ${res.status} ${text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`✅ S7 완료 (${elapsedS}s)`);

  const { data: final } = await supabase
    .from("student_record_analysis_pipelines")
    .select("task_results, task_previews")
    .eq("id", pipelineId)
    .maybeSingle();
  const r = (final?.task_results as Record<string, unknown>)?.tier_plan_refinement;
  const p = (final?.task_previews as Record<string, unknown>)?.tier_plan_refinement;
  console.log(`\n📊 S7 결과`);
  console.log(`  preview: ${p}`);
  console.log(`  result:\n${JSON.stringify(r, null, 2).split("\n").map((l) => "    " + l).join("\n")}`);

  const { data: mains } = await supabase
    .from("student_main_explorations")
    .select("id, version, origin, parent_version_id, is_active, created_at")
    .eq("student_id", STUDENT_ID)
    .order("created_at", { ascending: true });
  console.log(`\n📊 main_explorations (${mains?.length ?? 0})`);
  for (const m of mains ?? []) {
    console.log(`  v${m.version} ${m.origin} active=${m.is_active} parent=${m.parent_version_id?.slice(0,8) ?? "null"} id=${m.id.slice(0,8)}`);
  }
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.stack : e); process.exitCode = 1; })
  .finally(async () => { await cleanupTempAdmin().catch(() => undefined); });
