#!/usr/bin/env npx tsx
/**
 * 이가은 (인제고 1학년) Synthesis 파이프라인 풀런 (HTTP 경로).
 *
 * 전제: 이미 grade(design) G1/G2/G3 + blueprint 완료 상태.
 *
 * 목적: shadow slot-aware scoring 측정 (G3 mid+1학년 pairsRejected, G1 design weakCompetencies)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const NARRATIVE_CHUNK_SIZE = 4;
const CHUNK_LOOP_CAP = 40;
const FETCH_TIMEOUT_MS = 300_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `synth-igaeun-${Date.now()}@example.invalid`;
  const password = `Synth-${Math.random().toString(36).slice(2)}`;
  const { data: cr, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !cr.user) throw ce ?? new Error("create failed");
  await admin.from("user_profiles").insert({
    id: cr.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "Igaeun Synth Runner", is_active: true,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password });
  if (!si.session) throw new Error("signin failed");
  const b64url = Buffer.from(JSON.stringify(si.session), "utf-8")
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const projectRef = new URL(url).hostname.split(".")[0];
  TEMP_COOKIE_HEADER = `sb-${projectRef}-auth-token=base64-${b64url}`;
  TEMP_USER_ID = cr.user.id;
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
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } finally {
    clearTimeout(timer);
  }
}

async function runPhase(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    const e = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${label} — ${e}s`);
  } catch (err) {
    const e = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`  ✗ ${label} — ${e}s — ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function main() {
  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error("admin unavailable");
  const t0 = Date.now();
  console.log("🎬 이가은 Synthesis 풀런\n");

  await provisionTempAdmin();
  console.log(`🔑 temp userId=${TEMP_USER_ID.slice(0, 8)}\n`);

  const { data: refStudent } = await sb
    .from("students")
    .select("target_major, grade, school_name, target_school_tier")
    .eq("id", STUDENT_ID)
    .single();
  if (!refStudent) throw new Error("학생 없음");

  const { data: pipelineRef } = await sb
    .from("student_record_analysis_pipelines")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1).maybeSingle();
  const CREATED_BY = pipelineRef?.created_by as string;
  if (!CREATED_BY) throw new Error("created_by 확보 실패");

  // grade pipeline ids
  const { data: grades } = await sb
    .from("student_record_analysis_pipelines")
    .select("id")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "grade");
  const gradePipelineIds = (grades ?? []).map((g) => g.id as string);
  console.log(`gradePipelineIds=${gradePipelineIds.length}\n`);

  // 기존 synthesis 정리
  await sb.from("student_record_analysis_pipelines")
    .delete()
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis");

  const tasks: Record<string, string> = {};
  for (const k of SYNTHESIS_PIPELINE_TASK_KEYS) tasks[k] = "pending";
  const { data: ins, error: insErr } = await sb
    .from("student_record_analysis_pipelines")
    .insert({
      student_id: STUDENT_ID, tenant_id: TENANT_ID, created_by: CREATED_BY,
      status: "running", pipeline_type: "synthesis", mode: "analysis",
      tasks, input_snapshot: { ...refStudent, gradePipelineIds },
      started_at: new Date().toISOString(),
    })
    .select("id").single();
  if (insErr || !ins) throw insErr ?? new Error("synthesis insert 실패");
  const synthPipelineId = ins.id as string;
  console.log(`▶ Synthesis pipelineId=${synthPipelineId.slice(0,8)}\n`);

  await runPhase("S1 storyline_generation", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-1`, { pipelineId: synthPipelineId }));

  await runPhase("S2a narrative_arc_extraction (chunked)", async () => {
    let iter = 0;
    while (true) {
      if (iter >= CHUNK_LOOP_CAP) throw new Error("narrative chunk cap");
      const r = (await postPhase("/api/admin/pipeline/synthesis/phase-2/narrative-chunk", {
        pipelineId: synthPipelineId, chunkSize: NARRATIVE_CHUNK_SIZE,
      })) as { hasMore?: boolean };
      iter++;
      if (!r.hasMore) break;
    }
  });

  await runPhase("S2 edge+hyperedge+guide_matching+haengteuk_linking", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-2`, { pipelineId: synthPipelineId }));
  await runPhase("S3 ai_diagnosis + course_recommendation + gap_tracking", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-3`, { pipelineId: synthPipelineId }));
  await runPhase("S4 bypass_analysis", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-4`, { pipelineId: synthPipelineId }));
  await runPhase("S5 activity_summary + ai_strategy", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-5`, { pipelineId: synthPipelineId }));
  await runPhase("S6 interview + roadmap", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-6`, { pipelineId: synthPipelineId }));
  await runPhase("S7 tier_plan_refinement", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-7`, { pipelineId: synthPipelineId }));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ 이가은 Synthesis 완료 — ${elapsed}s`);
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.stack : e); process.exitCode = 1; })
  .finally(() => cleanupTempAdmin().catch(() => undefined));
