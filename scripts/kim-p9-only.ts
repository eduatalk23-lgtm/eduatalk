#!/usr/bin/env npx tsx
/**
 * β+1 실측 — Kim 의 가장 최근 G3 (design) 파이프라인에서 P9 draft_refinement 만 실행.
 *
 * 전제:
 *   - `ENABLE_MID_PIPELINE_PLANNER=true ENABLE_DRAFT_REFINEMENT=true pnpm dev` 실행 중
 *   - kim-serin-session-c-fullrun 이 이미 G3 P8 까지 완료 (P9 는 미호출)
 *   - G3 pipeline row 에 midPlan 영속 (ctx.results._midPlan)
 *
 * 목적: P9 pending 배열이 MidPlan.recordPriorityOverride 로 재정렬되는지 확인.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const CHUNK_SIZE = 4;
const CHUNK_LOOP_CAP = 20;
const FETCH_TIMEOUT_MS = 300_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `kim-p9-${Date.now()}@example.invalid`;
  const password = `KimP9-${Math.random().toString(36).slice(2)}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("create failed");
  await admin.from("user_profiles").insert({
    id: createRes.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "Kim P9 Runner", is_active: true,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password });
  if (!si.session) throw new Error("signin failed");
  const b64url = Buffer.from(JSON.stringify(si.session), "utf-8")
    .toString("base64")
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
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const admin = createSupabaseAdminClient()!;

  // Kim 의 G3 (grade=3) design 파이프라인 중 가장 최근 것
  const { data: pipes, error } = await admin
    .from("student_record_analysis_pipelines")
    .select("id, grade, status, tasks, task_results, created_at")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("pipeline_type", "grade")
    .eq("grade", 3)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !pipes?.[0]) throw new Error(`G3 pipeline not found: ${error?.message ?? "empty"}`);
  const pipe = pipes[0];
  console.log(`▶ G3 pipeline: ${pipe.id.slice(0, 8)} (${pipe.status})`);

  const midPlan = (pipe.task_results as Record<string, unknown> | null)?.["_midPlan"] as
    | { recordPriorityOverride?: Record<string, number>; focusHypothesis?: string }
    | undefined;
  console.log(`\n📋 MidPlan:`);
  console.log(`  focusHypothesis: ${midPlan?.focusHypothesis ?? "(none)"}`);
  console.log(`  recordPriorityOverride:`, midPlan?.recordPriorityOverride ?? "(none)");

  // pending 대상 조회 (참고용 — P9 가 자체 조회)
  const { calculateSchoolYear } = await import("../lib/utils/schoolYear");
  const currentSchoolYear = calculateSchoolYear();
  // Kim grade=3 → targetSchoolYear = currentSchoolYear (동일 학년)
  const { data: quality } = await admin
    .from("student_record_content_quality")
    .select("record_id, record_type, overall_score")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("school_year", currentSchoolYear)
    .eq("source", "ai_projected")
    .lt("overall_score", 70)
    .eq("retry_count", 0)
    .order("overall_score", { ascending: true });
  console.log(`\n📊 P9 대상 (score<70, retry=0): ${quality?.length ?? 0}건`);
  for (const q of (quality ?? []).slice(0, 10)) {
    console.log(`  ${q.record_id.slice(0, 8)} (${q.record_type}) score=${q.overall_score}`);
  }

  console.log(`\n🔧 provisioning temp admin...`);
  await provisionTempAdmin();

  console.log(`\n▶ P9 draft_refinement 실행 (chunkSize=${CHUNK_SIZE})`);
  const started = Date.now();
  let processed = 0, refined = 0, rolledBack = 0, skipped = 0;
  for (let i = 0; i < CHUNK_LOOP_CAP; i++) {
    const r = (await postPhase(`/api/admin/pipeline/grade/phase-9`, {
      pipelineId: pipe.id, chunkSize: CHUNK_SIZE,
    })) as { result?: { processed?: number; refined?: number; rolledBack?: number; skipped?: number }; hasMore?: boolean };
    const result = r.result ?? {};
    processed += result.processed ?? 0;
    refined += result.refined ?? 0;
    rolledBack += result.rolledBack ?? 0;
    skipped += result.skipped ?? 0;
    console.log(`  chunk ${i + 1}: processed=${result.processed ?? 0} refined=${result.refined ?? 0} rolledBack=${result.rolledBack ?? 0} skipped=${result.skipped ?? 0} hasMore=${r.hasMore}`);
    if (!r.hasMore) break;
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n✓ P9 완료 — ${elapsed}s`);
  console.log(`  총 processed=${processed} refined=${refined} rolledBack=${rolledBack} skipped=${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await cleanupTempAdmin().catch(() => undefined); });
