#!/usr/bin/env npx tsx
/**
 * 세션 C — 인제고 1학년 k=0 prospective 풀런 (HTTP 경로).
 *
 * 전제: `pnpm dev` 실행 중 (http://localhost:3000).
 *
 * 순서:
 *   1. 파생 DB 전부 클린업 (admin)
 *   2. Blueprint 파이프라인 INSERT → POST /api/admin/pipeline/blueprint
 *   3. Grade(design) G1/G2/G3 INSERT → POST /api/admin/pipeline/grade/phase-{1..8}
 *   4. 검증 요약 출력
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import {
  GRADE_PIPELINE_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
} from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

const SKIP_CLEANUP = process.argv.includes("--no-cleanup");

const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const CHUNK_SIZE = 4;
const CHUNK_LOOP_CAP = 30;
const FETCH_TIMEOUT_MS = 300_000;

// Proxy 인증 우회를 위해 임시 admin 유저를 생성해 세션 쿠키로 HTTP 호출.
// 풀런 종료 시 cleanupTempUser로 삭제.
let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin(): Promise<{ cookieHeader: string; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE 환경변수 미설정");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin client unavailable");

  const email = `session-c-runner-${Date.now()}@example.invalid`;
  const password = `SessionC-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (createErr || !createRes.user) throw createErr ?? new Error("temp 유저 생성 실패");

  // RLS 통과를 위해 user_profiles 레코드 생성 (admin + 동일 tenant)
  const { error: profileErr } = await admin
    .from("user_profiles")
    .insert({
      id: createRes.user.id,
      email,
      role: "admin",
      tenant_id: TENANT_ID,
      name: "SessionC Runner",
      is_active: true,
    });
  if (profileErr) throw new Error(`user_profiles INSERT 실패: ${profileErr.message}`);

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.session) throw signErr ?? new Error("temp 유저 로그인 실패");

  // proxy.ts parseTokenFromCookies는 base64-{base64url(JSON(session))} 포맷을 기대.
  const sessionJson = JSON.stringify(signIn.session);
  const b64url = Buffer.from(sessionJson, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const cookieValue = `base64-${b64url}`;

  const projectRef = (new URL(url).hostname.split(".")[0]) ?? "project";
  const cookieName = `sb-${projectRef}-auth-token`;

  return {
    cookieHeader: `${cookieName}=${cookieValue}`,
    userId: createRes.user.id,
  };
}

async function cleanupTempAdmin() {
  if (!TEMP_USER_ID) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  // user_profiles는 FK CASCADE로 자동 삭제되지만 방어적으로 제거
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
      headers: {
        "Content-Type": "application/json",
        Cookie: TEMP_COOKIE_HEADER,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function cleanup(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  if (!supabase) throw new Error("admin client unavailable");
  console.log(`🧹 파생 DB 클린업 시작`);

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

  console.log(`🧹 클린업 완료\n`);
}

async function insertPipeline(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  opts: {
    pipelineType: "blueprint" | "grade";
    grade?: number;
    mode?: "design" | "analysis";
    taskKeys: readonly string[];
    createdBy: string;
    snapshot: Record<string, unknown>;
  },
): Promise<string> {
  if (!supabase) throw new Error("admin client unavailable");
  const tasks: Record<string, string> = {};
  for (const k of opts.taskKeys) tasks[k] = "pending";

  const { data, error } = await supabase
    .from("student_record_analysis_pipelines")
    .insert({
      student_id: STUDENT_ID,
      tenant_id: TENANT_ID,
      created_by: opts.createdBy,
      status: "running",
      pipeline_type: opts.pipelineType,
      grade: opts.grade ?? null,
      mode: opts.mode ?? null,
      tasks,
      input_snapshot: opts.snapshot,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("파이프라인 INSERT 실패");
  return data.id as string;
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

async function runChunkedGradePhase(label: string, pipelineId: string, phase: number) {
  const t0 = Date.now();
  try {
    let iter = 0;
    while (true) {
      if (iter >= CHUNK_LOOP_CAP) throw new Error(`${label} chunk cap (${CHUNK_LOOP_CAP}) 초과`);
      const resp = await postPhase(`/api/admin/pipeline/grade/phase-${phase}`, {
        pipelineId,
        chunkSize: CHUNK_SIZE,
      });
      iter++;
      if (!resp.hasMore) break;
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${label} — ${elapsed}s (${iter} chunks)`);
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
  console.log(`🎬 인제고 1학년 k=0 prospective 풀런 (HTTP 경로)\n`);

  console.log(`🔑 임시 admin 세션 생성`);
  const tempAuth = await provisionTempAdmin();
  TEMP_COOKIE_HEADER = tempAuth.cookieHeader;
  TEMP_USER_ID = tempAuth.userId;
  console.log(`  temp userId=${TEMP_USER_ID.slice(0, 8)}\n`);

  const { data: refStudent } = await supabase
    .from("students")
    .select("target_major, grade, school_name")
    .eq("id", STUDENT_ID)
    .single();
  if (!refStudent) throw new Error("학생 레코드 없음");

  const { data: pipelineRef } = await supabase
    .from("student_record_analysis_pipelines")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1)
    .maybeSingle();
  let CREATED_BY = pipelineRef?.created_by as string | undefined;
  if (!CREATED_BY) {
    const { data: anyProfile } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .single();
    CREATED_BY = (anyProfile?.id as string) ?? undefined;
  }
  if (!CREATED_BY) throw new Error("created_by 확보 실패");
  console.log(`created_by=${CREATED_BY.slice(0, 8)} · student=${refStudent.school_name} G${refStudent.grade} · target=${refStudent.target_major}\n`);

  // ── 1. 클린업 ──
  if (SKIP_CLEANUP) {
    console.log(`🧹 --no-cleanup 플래그: 클린업 스킵 (이전 실행 기록 보존 — cross-run 검증용)\n`);
  } else {
    await cleanup(supabase);
  }

  // ── 2. Blueprint ──
  console.log(`▶ Blueprint Phase`);
  const blueprintPipelineId = await insertPipeline(supabase, {
    pipelineType: "blueprint",
    taskKeys: BLUEPRINT_TASK_KEYS,
    createdBy: CREATED_BY,
    snapshot: { ...refStudent, consultingGrades: [1, 2, 3] },
  });
  console.log(`  pipelineId=${blueprintPipelineId.slice(0, 8)}`);
  await runPhase("B1 blueprint_generation", async () => {
    await postPhase("/api/admin/pipeline/blueprint", { pipelineId: blueprintPipelineId });
  });

  const { data: bp } = await supabase
    .from("student_record_analysis_pipelines")
    .select("status, task_results, tasks, error_details")
    .eq("id", blueprintPipelineId)
    .single();
  if (bp?.status !== "completed") {
    console.error(`  blueprint 미완료: status=${bp?.status} tasks=${JSON.stringify(bp?.tasks)} error_details=${JSON.stringify(bp?.error_details)}`);
    throw new Error(`Blueprint 파이프라인 완료 안 됨: status=${bp?.status}`);
  }
  const bpResults = (bp.task_results ?? {}) as Record<string, unknown>;
  const bpPhase = bpResults._blueprintPhase as { targetConvergences?: unknown[]; milestones?: Record<string, unknown> } | undefined;
  console.log(`  convergences=${bpPhase?.targetConvergences?.length ?? 0} · milestones=${Object.keys(bpPhase?.milestones ?? {}).length}\n`);

  // ── 3. Grade(design) G1/G2/G3 ──
  for (const grade of [1, 2, 3] as const) {
    console.log(`▶ Grade(design) G${grade}`);
    const gradePipelineId = await insertPipeline(supabase, {
      pipelineType: "grade",
      grade,
      mode: "design",
      taskKeys: GRADE_PIPELINE_TASK_KEYS,
      createdBy: CREATED_BY,
      snapshot: refStudent,
    });
    console.log(`  pipelineId=${gradePipelineId.slice(0, 8)}`);

    await runChunkedGradePhase("P1 competency_setek", gradePipelineId, 1);
    await runChunkedGradePhase("P2 competency_changche", gradePipelineId, 2);
    await runChunkedGradePhase("P3 competency_haengteuk", gradePipelineId, 3);
    await runPhase("P4 setek_guide + slot_generation", async () => {
      await postPhase(`/api/admin/pipeline/grade/phase-4`, { pipelineId: gradePipelineId });
    });
    await runPhase("P5 changche_guide", async () => {
      await postPhase(`/api/admin/pipeline/grade/phase-5`, { pipelineId: gradePipelineId });
    });
    await runPhase("P6 haengteuk_guide", async () => {
      await postPhase(`/api/admin/pipeline/grade/phase-6`, { pipelineId: gradePipelineId });
    });
    await runChunkedGradePhase("P7 draft_generation", gradePipelineId, 7);
    await runChunkedGradePhase("P8 draft_analysis", gradePipelineId, 8);

    const { data: g } = await supabase
      .from("student_record_analysis_pipelines")
      .select("status")
      .eq("id", gradePipelineId)
      .single();
    console.log(`  G${grade} final status=${g?.status}\n`);
  }

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✅ 인제고 1학년 prospective 풀런 완료 (총 ${totalElapsed}s)\n`);

  // ── 4. 검증 요약 ──
  const [
    { data: hyperedges },
    { data: edges },
    { data: scores },
    { data: tags },
    { data: guides1 },
    { data: guides2 },
    { data: guides3 },
    { data: sDrafts },
    { data: cDrafts },
    { data: hDrafts },
  ] = await Promise.all([
    supabase.from("student_record_hyperedges").select("edge_context, theme_label").eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").select("edge_context").eq("student_id", STUDENT_ID),
    supabase.from("student_record_competency_scores").select("source").eq("student_id", STUDENT_ID),
    supabase.from("student_record_activity_tags").select("tag_context").eq("student_id", STUDENT_ID),
    supabase.from("student_record_setek_guides").select("id").eq("student_id", STUDENT_ID),
    supabase.from("student_record_changche_guides").select("id").eq("student_id", STUDENT_ID),
    supabase.from("student_record_haengteuk_guides").select("id").eq("student_id", STUDENT_ID),
    supabase.from("student_record_seteks").select("id, ai_draft_content, grade").eq("student_id", STUDENT_ID),
    supabase.from("student_record_changche").select("id, ai_draft_content, grade").eq("student_id", STUDENT_ID),
    supabase.from("student_record_haengteuk").select("id, ai_draft_content, grade").eq("student_id", STUDENT_ID),
  ]);

  const hyperByCtx = new Map<string, Array<string>>();
  for (const h of hyperedges ?? []) {
    const k = String(h.edge_context);
    if (!hyperByCtx.has(k)) hyperByCtx.set(k, []);
    hyperByCtx.get(k)!.push(String(h.theme_label));
  }
  console.log(`## 검증`);
  console.log(`   하이퍼엣지: 총 ${hyperedges?.length ?? 0}건`);
  for (const [k, v] of hyperByCtx.entries()) {
    console.log(`     ${k}: ${v.length}건`);
    for (const t of v.slice(0, 4)) console.log(`       · ${t}`);
  }
  const edgeByCtx = new Map<string, number>();
  for (const e of edges ?? []) edgeByCtx.set(String(e.edge_context), (edgeByCtx.get(String(e.edge_context)) ?? 0) + 1);
  console.log(`   엣지: 총 ${edges?.length ?? 0}건`);
  for (const [k, v] of edgeByCtx.entries()) console.log(`     ${k}: ${v}건`);
  const scoreBySrc = new Map<string, number>();
  for (const s of scores ?? []) scoreBySrc.set(String(s.source), (scoreBySrc.get(String(s.source)) ?? 0) + 1);
  console.log(`   역량점수: 총 ${scores?.length ?? 0}건`);
  for (const [k, v] of scoreBySrc.entries()) console.log(`     source=${k}: ${v}건`);
  const tagByCtx = new Map<string, number>();
  for (const t of tags ?? []) tagByCtx.set(String(t.tag_context), (tagByCtx.get(String(t.tag_context)) ?? 0) + 1);
  console.log(`   활동태그: 총 ${tags?.length ?? 0}건`);
  for (const [k, v] of tagByCtx.entries()) console.log(`     tag_context=${k}: ${v}건`);
  console.log(`   가이드: setek ${guides1?.length ?? 0}건 / changche ${guides2?.length ?? 0}건 / haengteuk ${guides3?.length ?? 0}건`);

  const countDrafts = (rows: Array<{ ai_draft_content?: string | null; grade?: number | null }> | null) => {
    const byGrade = new Map<number, number>();
    for (const r of rows ?? []) {
      if (!r.ai_draft_content || r.ai_draft_content.length < 10) continue;
      const g = (r.grade as number) ?? 0;
      byGrade.set(g, (byGrade.get(g) ?? 0) + 1);
    }
    return [...byGrade.entries()].sort(([a], [b]) => a - b).map(([g, c]) => `G${g}=${c}`).join(" ");
  };
  console.log(`   AI 가안: setek [${countDrafts(sDrafts)}] / changche [${countDrafts(cDrafts)}] / haengteuk [${countDrafts(hDrafts)}]`);
}

main()
  .catch((err) => {
    console.error("❌ unhandled:", err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupTempAdmin().catch(() => undefined);
  });
