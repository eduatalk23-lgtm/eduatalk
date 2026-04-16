#!/usr/bin/env npx tsx
/**
 * 세션 C — 인제고 synthesis Phase 3부터 이어서 재실행.
 * ai_diagnosis 실패(ON CONFLICT 버그) 수정 후 Phase 3/4/5/6만 재돌림.
 * S1/S2a/S2 완료 태스크는 보존.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const FETCH_TIMEOUT_MS = 300_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `session-c-resume-${Date.now()}@example.invalid`;
  const password = `SessionC-${Math.random().toString(36).slice(2)}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("create failed");
  await admin.from("user_profiles").insert({
    id: createRes.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "Resume Runner", is_active: true,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password });
  if (!si.session) throw new Error("signin failed");
  const b64url = Buffer.from(JSON.stringify(si.session), "utf-8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } finally { clearTimeout(timer); }
}

async function runPhase(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error(`  ✗ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s — ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}

async function main() {
  const supabase = createSupabaseAdminClient()!;
  const t0 = Date.now();
  console.log(`🎬 인제고 synthesis Phase 3~6 resume\n`);

  await provisionTempAdmin();
  console.log(`temp userId=${TEMP_USER_ID.slice(0, 8)}\n`);

  // 기존 synthesis 조회
  const { data: synth } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, tasks, task_results, error_details")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!synth) throw new Error("synthesis 파이프라인 없음");
  const pipelineId = synth.id as string;
  console.log(`pipelineId=${pipelineId.slice(0, 8)}`);

  // 실패한 ai_diagnosis + 이후 pending 태스크 초기화
  const curTasks = (synth.tasks ?? {}) as Record<string, string>;
  const resetKeys = ["ai_diagnosis", "gap_tracking", "bypass_analysis", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"];
  for (const k of resetKeys) {
    if (curTasks[k] === "failed" || curTasks[k] === "pending") curTasks[k] = "pending";
  }
  // ai_diagnosis error 제거
  const errors = (synth.error_details ?? {}) as Record<string, string>;
  delete errors.ai_diagnosis;
  await supabase.from("student_record_analysis_pipelines").update({
    status: "running",
    tasks: curTasks,
    error_details: Object.keys(errors).length > 0 ? errors : null,
  }).eq("id", pipelineId);
  console.log(`task 상태 리셋: ${resetKeys.join(", ")} → pending\n`);

  // Phase 3~6 순차 실행
  await runPhase("S3 ai_diagnosis + course_recommendation + gap_tracking", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-3`, { pipelineId }));
  await runPhase("S4 bypass_analysis", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-4`, { pipelineId }));
  await runPhase("S5 activity_summary + ai_strategy", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-5`, { pipelineId }));
  await runPhase("S6 interview + roadmap", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-6`, { pipelineId }));

  const { data: final } = await supabase
    .from("student_record_analysis_pipelines")
    .select("status, tasks, error_details")
    .eq("id", pipelineId).single();
  console.log(`\nfinal status=${final?.status}`);
  console.log(`tasks=${JSON.stringify(final?.tasks, null, 2)}`);
  if (final?.error_details) console.log(`errors=${JSON.stringify(final.error_details, null, 2)}`);

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ 완료 (총 ${totalElapsed}s)\n`);

  // ── 검증 ──
  const [
    { data: hyperedges },
    { data: diagnoses },
    { data: strategies },
    { data: roadmap },
    { data: interviews },
  ] = await Promise.all([
    supabase.from("student_record_hyperedges").select("edge_context, theme_label").eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").select("school_year, scope, overall_grade, direction_strength, strengths, weaknesses").eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").select("priority, target_area, strategy_content, reasoning").eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").select("grade, semester, area, plan_content").eq("student_id", STUDENT_ID),
    supabase.from("student_interview_preparations").select("id").eq("student_id", STUDENT_ID),
  ]);

  console.log(`## 검증`);
  const hyperByCtx = new Map<string, string[]>();
  for (const h of hyperedges ?? []) {
    const k = String(h.edge_context);
    if (!hyperByCtx.has(k)) hyperByCtx.set(k, []);
    hyperByCtx.get(k)!.push(String(h.theme_label));
  }
  console.log(`   하이퍼엣지: 총 ${hyperedges?.length ?? 0}건`);
  for (const [k, v] of hyperByCtx.entries()) {
    console.log(`     ${k}: ${v.length}건`);
    for (const t of v.slice(0, 4)) console.log(`       · ${t}`);
  }
  console.log(`   진단: 총 ${diagnoses?.length ?? 0}건`);
  for (const d of diagnoses ?? []) {
    const strengths = (d.strengths as unknown[] | null)?.length ?? 0;
    const weaknesses = (d.weaknesses as unknown[] | null)?.length ?? 0;
    console.log(`     [${d.school_year}/${d.scope}] overall=${d.overall_grade} dir=${d.direction_strength} str=${strengths} weak=${weaknesses}`);
  }
  console.log(`   전략: 총 ${strategies?.length ?? 0}건`);
  for (const s of (strategies ?? []).slice(0, 5)) {
    console.log(`     [${s.priority}/${s.target_area}] ${(s.strategy_content as string | null)?.slice(0, 80) ?? "?"}`);
  }
  console.log(`   로드맵: 총 ${roadmap?.length ?? 0}건`);
  console.log(`   면접질문: 총 ${interviews?.length ?? 0}건`);
}

main()
  .catch((err) => {
    console.error("❌", err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupTempAdmin().catch(() => undefined);
  });
