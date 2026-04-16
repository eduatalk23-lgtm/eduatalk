#!/usr/bin/env npx tsx
/**
 * 세션 C — 인제고 1학년 k=0 Synthesis 풀런 (HTTP 경로).
 *
 * 전제:
 *   - `pnpm dev` 실행 중
 *   - Blueprint + Grade(design) G1/G2/G3 파이프라인 completed 상태
 *     (scripts/injego-session-c-fullrun.ts로 선행 완료)
 *
 * 검증 포인트:
 *   - Bridge 하이퍼엣지 생성 여부 (gap_tracking 태스크)
 *   - diagnosis/strategy/roadmap 생성 여부 (학생 노출 산출물)
 *   - projected 폴백 동작 여부 (K=0은 analysis=0, projected만 있음)
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
const CHUNK_LOOP_CAP = 30;
const FETCH_TIMEOUT_MS = 300_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE 환경변수 미설정");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin client unavailable");

  const email = `session-c-synth-${Date.now()}@example.invalid`;
  const password = `SessionC-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (createErr || !createRes.user) throw createErr ?? new Error("temp 유저 생성 실패");

  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: createRes.user.id,
    email,
    role: "admin",
    tenant_id: TENANT_ID,
    name: "SessionC Synth Runner",
    is_active: true,
  });
  if (profileErr) throw new Error(`user_profiles INSERT 실패: ${profileErr.message}`);

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  if (signErr || !signIn.session) throw signErr ?? new Error("temp 유저 로그인 실패");

  const sessionJson = JSON.stringify(signIn.session);
  const b64url = Buffer.from(sessionJson, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const cookieValue = `base64-${b64url}`;
  const projectRef = new URL(url).hostname.split(".")[0] ?? "project";
  const cookieName = `sb-${projectRef}-auth-token`;

  TEMP_COOKIE_HEADER = `${cookieName}=${cookieValue}`;
  TEMP_USER_ID = createRes.user.id;
}

async function cleanupTempAdmin() {
  if (!TEMP_USER_ID) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("user_profiles").delete().eq("id", TEMP_USER_ID).catch(() => undefined);
  await admin.auth.admin.deleteUser(TEMP_USER_ID).catch(() => undefined);
  TEMP_USER_ID = "";
}

async function postPhase(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function runPhase(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    await fn();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${label} — ${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`  ✗ ${label} — ${elapsed}s — ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");

  const t0 = Date.now();
  console.log(`🎬 인제고 K=0 Synthesis 풀런\n`);

  console.log(`🔑 임시 admin 세션 생성`);
  await provisionTempAdmin();
  console.log(`  temp userId=${TEMP_USER_ID.slice(0, 8)}\n`);

  // ── 0. created_by ──
  const { data: pipelineRef } = await supabase
    .from("student_record_analysis_pipelines")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1)
    .maybeSingle();
  const CREATED_BY = pipelineRef?.created_by as string;
  if (!CREATED_BY) throw new Error("created_by 확보 실패");

  // ── 1. grade(design) 완료 확인 ──
  const { data: grades } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, grade, status")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "grade")
    .order("grade");
  const incomplete = (grades ?? []).filter((g) => g.status !== "completed");
  if (incomplete.length > 0) {
    throw new Error(`grade 파이프라인 미완료: ${JSON.stringify(incomplete)}`);
  }
  console.log(`grade(design) G1/G2/G3 completed 확인\n`);

  // ── 2. Synthesis 파이프라인 INSERT ──
  // 기존 synthesis 행이 있으면 삭제 (clean start)
  await supabase
    .from("student_record_analysis_pipelines")
    .delete()
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis");

  const initTasks: Record<string, string> = {};
  for (const k of SYNTHESIS_PIPELINE_TASK_KEYS) initTasks[k] = "pending";

  const gradePipelineIds = (grades ?? []).map((g) => g.id as string);

  const { data: refStudent } = await supabase
    .from("students")
    .select("target_major, grade, school_name")
    .eq("id", STUDENT_ID)
    .single();

  const { data: synth, error: synthErr } = await supabase
    .from("student_record_analysis_pipelines")
    .insert({
      student_id: STUDENT_ID,
      tenant_id: TENANT_ID,
      created_by: CREATED_BY,
      status: "running",
      pipeline_type: "synthesis",
      grade: null,
      mode: "prospective",
      tasks: initTasks,
      input_snapshot: { ...refStudent, gradePipelineIds },
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (synthErr || !synth) throw synthErr ?? new Error("synthesis INSERT 실패");
  const synthesisPipelineId = synth.id as string;
  console.log(`▶ Synthesis synthesisPipelineId=${synthesisPipelineId.slice(0, 8)}\n`);

  // ── 3. Synthesis phases ──
  await runPhase("S1 storyline_generation", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-1`, { pipelineId: synthesisPipelineId });
  });

  // Phase 2: narrative_arc chunked → main
  await runPhase("S2a narrative_arc_extraction (chunked)", async () => {
    let iter = 0;
    while (true) {
      if (iter >= CHUNK_LOOP_CAP) throw new Error("narrative chunk cap");
      const r = (await postPhase("/api/admin/pipeline/synthesis/phase-2/narrative-chunk", {
        pipelineId: synthesisPipelineId,
        chunkSize: NARRATIVE_CHUNK_SIZE,
      })) as { hasMore?: boolean };
      iter++;
      if (!r.hasMore) break;
    }
  });
  await runPhase("S2 edge_computation + hyperedge + guide_matching + haengteuk_linking", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-2`, { pipelineId: synthesisPipelineId });
  });
  await runPhase("S3 ai_diagnosis + course_recommendation + gap_tracking", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-3`, { pipelineId: synthesisPipelineId });
  });
  await runPhase("S4 bypass_analysis", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-4`, { pipelineId: synthesisPipelineId });
  });
  await runPhase("S5 activity_summary + ai_strategy", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-5`, { pipelineId: synthesisPipelineId });
  });
  await runPhase("S6 interview + roadmap", async () => {
    await postPhase(`/api/admin/pipeline/synthesis/phase-6`, { pipelineId: synthesisPipelineId });
  });

  const { data: synthFinal } = await supabase
    .from("student_record_analysis_pipelines")
    .select("status, tasks")
    .eq("id", synthesisPipelineId)
    .single();
  console.log(`\nSynthesis final status=${synthFinal?.status}`);

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Synthesis 완료 (총 ${totalElapsed}s)\n`);

  // ── 4. 검증 ──
  const [
    { data: hyperedges },
    { data: edges },
    { data: diagnoses },
    { data: strategies },
    { data: roadmap },
    { data: storylines },
    { data: narrativeArcs },
    { data: interviews },
  ] = await Promise.all([
    supabase.from("student_record_hyperedges").select("edge_context, theme_label").eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").select("edge_context").eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").select("school_year, scope, overall_grade, direction_strength, strengths, weaknesses, strategy_notes").eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").select("priority, target_area, strategy_content, reasoning, scope").eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").select("grade, semester, area, plan_content").eq("student_id", STUDENT_ID),
    supabase.from("student_record_storylines").select("title, scope").eq("student_id", STUDENT_ID),
    supabase.from("student_record_narrative_arc").select("id").eq("student_id", STUDENT_ID),
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
  const edgeByCtx = new Map<string, number>();
  for (const e of edges ?? []) edgeByCtx.set(String(e.edge_context), (edgeByCtx.get(String(e.edge_context)) ?? 0) + 1);
  console.log(`   엣지: 총 ${edges?.length ?? 0}건`);
  for (const [k, v] of edgeByCtx.entries()) console.log(`     ${k}: ${v}건`);

  console.log(`   storyline: 총 ${storylines?.length ?? 0}건`);
  console.log(`   narrative_arc: 총 ${narrativeArcs?.length ?? 0}건`);

  console.log(`   진단: 총 ${diagnoses?.length ?? 0}건`);
  for (const d of (diagnoses ?? []).slice(0, 2)) {
    const strengths = (d.strengths as unknown[] | null)?.length ?? 0;
    const weaknesses = (d.weaknesses as unknown[] | null)?.length ?? 0;
    console.log(`     [${d.school_year}/${d.scope}] overall=${d.overall_grade} dir=${d.direction_strength} str=${strengths} weak=${weaknesses}`);
  }

  console.log(`   전략: 총 ${strategies?.length ?? 0}건`);
  for (const s of (strategies ?? []).slice(0, 5)) {
    console.log(`     [${s.priority}/${s.target_area}/${s.scope}] ${(s.strategy_content as string | null)?.slice(0, 80) ?? "??"}`);
    if (s.reasoning) console.log(`        reason: ${(s.reasoning as string).slice(0, 100)}`);
  }

  console.log(`   로드맵: 총 ${roadmap?.length ?? 0}건`);
  for (const r of (roadmap ?? []).slice(0, 3)) {
    console.log(`     [G${r.grade}-${r.semester}/${r.area}] ${(r.plan_content as string | null)?.slice(0, 80) ?? "??"}`);
  }
  console.log(`   면접질문: 총 ${interviews?.length ?? 0}건`);
}

main()
  .catch((err) => {
    console.error("❌ unhandled:", err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupTempAdmin().catch(() => undefined);
  });
