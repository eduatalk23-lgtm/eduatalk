#!/usr/bin/env npx tsx
/**
 * xrun-seed-01 Synthesis 풀런 (HTTP route 경유, S7 측정용).
 *
 * CLI 직접 실행 시 createSupabaseServerClient() 의 cookies() 가 request scope 밖이라 실패하여
 * S3/S5/S6 LLM 액션이 silently fail. 따라서 dev server 의 HTTP route 를 호출해 정상 컨텍스트로 실행.
 *
 * 전제: pnpm dev (localhost:3000), Run 1 (04-18) 의 Blueprint+Grade+Synthesis 결과 존재.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const FETCH_TIMEOUT_MS = 600_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `xrun-s7-${Date.now()}@example.invalid`;
  const password = `Xrun-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("temp admin 생성 실패");
  await admin.from("user_profiles").insert({
    id: createRes.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "Xrun S7 Runner", is_active: true,
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

async function postPhase(path: string, body: Record<string, unknown>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: TEMP_COOKIE_HEADER },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } finally { clearTimeout(timer); }
}

async function runPhase(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`✅ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error(`❌ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s — ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  await provisionTempAdmin();
  console.log(`🔑 temp admin userId=${TEMP_USER_ID.slice(0, 8)}`);

  const { data: existing } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    console.error(`❌ synthesis 파이프라인 없음`);
    process.exit(1);
  }

  const pipelineId = existing.id;
  console.log(`🔄 Synthesis 파이프라인 reset: ${pipelineId.slice(0, 8)}`);

  const resetTasks: Record<string, string> = {};
  for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) resetTasks[key] = "pending";

  await supabase
    .from("student_record_analysis_pipelines")
    .update({
      tasks: resetTasks,
      status: "running",
      task_previews: {},
      task_results: {},
      error_details: null,
      started_at: new Date().toISOString(),
    })
    .eq("id", pipelineId);

  console.log(`🧹 기존 파생 산출물 클린업`);
  await Promise.all([
    supabase.from("student_record_hyperedges").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_storylines").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_narrative_arc").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_activity_summaries").delete().eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").delete().eq("student_id", STUDENT_ID).eq("edge_context", "synthesis_inferred"),
  ]);

  const t0 = Date.now();
  try {
    await runPhase("S1 storyline_generation", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-1", { pipelineId }));

    await runPhase("S2a narrative_arc (chunked)", async () => {
      let iter = 0;
      while (true) {
        if (iter >= 40) throw new Error("narrative chunk cap");
        const r = (await postPhase("/api/admin/pipeline/synthesis/phase-2/narrative-chunk", {
          pipelineId, chunkSize: 4,
        })) as { hasMore?: boolean };
        iter++;
        if (!r.hasMore) break;
      }
    });

    await runPhase("S2 edge+hyperedge+guide_matching+haengteuk_linking", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-2", { pipelineId }));

    await runPhase("S3 ai_diagnosis + course_recommendation + gap_tracking", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-3", { pipelineId }));

    await runPhase("S4 bypass_analysis", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-4", { pipelineId }));

    await runPhase("S5 activity_summary + ai_strategy", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-5", { pipelineId }));

    await runPhase("S6 interview + roadmap", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-6", { pipelineId }));

    await runPhase("S7 tier_plan_refinement", () =>
      postPhase("/api/admin/pipeline/synthesis/phase-7", { pipelineId }));

    console.log(`\n✅ Synthesis 풀런 완료 (총 ${((Date.now() - t0) / 1000).toFixed(1)}s) — pipelineId=${pipelineId}`);
  } catch (err) {
    console.error(`❌ 풀런 중단:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.stack : e); process.exitCode = 1; })
  .finally(async () => { await cleanupTempAdmin().catch(() => undefined); });
