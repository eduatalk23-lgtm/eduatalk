#!/usr/bin/env npx tsx
/**
 * 세션 C — 김세린 k=2 풀런 (HTTP 경로).
 *
 * 전제: `pnpm dev` 실행 중.
 *
 * 순서:
 *   1. 파생 DB 클린업
 *   2. Grade(analysis) G1 → G2 phases 1-6 (analysis 모드, P7/P8 없음)
 *   3. Past Analytics A1/A2/A3
 *   4. Blueprint B1
 *   5. Grade(design) G3 phases 1-8
 *   6. Synthesis phases 1-6
 *   7. 검증: past scope + final scope + bridge + 모든 학생 노출 산출물
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import {
  GRADE_PIPELINE_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
  PAST_ANALYTICS_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
} from "../lib/domains/record-analysis/pipeline/pipeline-config";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const CHUNK_SIZE = 4;
const NARRATIVE_CHUNK_SIZE = 4;
const CHUNK_LOOP_CAP = 40;
const FETCH_TIMEOUT_MS = 300_000;

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `session-c-kim-${Date.now()}@example.invalid`;
  const password = `SessionC-${Math.random().toString(36).slice(2)}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("create failed");
  await admin.from("user_profiles").insert({
    id: createRes.user.id,
    email,
    role: "admin",
    tenant_id: TENANT_ID,
    name: "Kim-Serin Runner",
    is_active: true,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email, password });
  if (!si.session) throw new Error("signin failed");
  const b64url = Buffer.from(JSON.stringify(si.session), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
  } finally {
    clearTimeout(timer);
  }
}

async function seedMainExploration(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  if (!supabase) throw new Error("admin client unavailable");
  const { data: existing } = await supabase
    .from("student_main_explorations")
    .select("id")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("is_active", true)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`🌱 main_exploration 기존 active 있음 (${existing[0].id.slice(0, 8)}) — skip seed`);
    return;
  }
  const { error } = await supabase.from("student_main_explorations").insert({
    student_id: STUDENT_ID,
    tenant_id: TENANT_ID,
    school_year: new Date().getFullYear(),
    grade: 2,
    semester: 2,
    scope: "overall",
    direction: "design",
    semantic_role: "hybrid_recursion",
    source: "consultant",
    pinned_by_consultant: true,
    is_active: true,
    theme_label: "빛과 물질의 상호작용 — 광물리·분광학 기반 천체 관측 탐구",
    theme_keywords: ["광물리", "분광학", "천체관측"],
    career_field: "NAT",
    tier_plan: {
      foundational: {
        theme: "파동·빛의 기본 성질과 고전역학 기반",
        key_questions: ["빛의 파동/입자 이중성을 실험으로 어떻게 드러내는가?"],
        suggested_activities: ["물리학I 파동 단원 심화 독서", "이중슬릿 재현 모의 실험"],
      },
      development: {
        theme: "분광학으로 원자·분자 구조 추론",
        key_questions: ["분광선이 물질 조성의 지문이 되는 이유는?"],
        suggested_activities: ["스펙트럼 관측 실험", "천체 스펙트럼 데이터 분석"],
      },
      advanced: {
        theme: "관측 데이터 해석과 광시야 천문 프로젝트",
        key_questions: ["광시야 조사에서 특이 천체를 어떻게 식별하는가?"],
        suggested_activities: ["공개 천문대 데이터 재분석", "광시야 관측 보고서 작성"],
      },
    },
  });
  if (error) throw new Error(`main_exploration seed 실패: ${error.message}`);
  console.log(`🌱 main_exploration seed 생성 (2학년 2학기, overall × design × hybrid_recursion)`);
}

async function cleanup(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  if (!supabase) throw new Error("admin client unavailable");
  console.log(`🧹 클린업`);

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
}

async function insertPipeline(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  opts: {
    pipelineType: "blueprint" | "grade" | "past_analytics" | "synthesis";
    grade?: number;
    mode?: "design" | "analysis" | "prospective";
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
    console.log(`  ✓ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error(`  ✗ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s — ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}

async function runChunkedGradePhase(label: string, pipelineId: string, phase: number) {
  const t0 = Date.now();
  try {
    let iter = 0;
    while (true) {
      if (iter >= CHUNK_LOOP_CAP) throw new Error(`${label} chunk cap`);
      const resp = (await postPhase(`/api/admin/pipeline/grade/phase-${phase}`, {
        pipelineId,
        chunkSize: CHUNK_SIZE,
      })) as { hasMore?: boolean };
      iter++;
      if (!resp.hasMore) break;
    }
    console.log(`  ✓ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s (${iter} chunks)`);
  } catch (err) {
    console.error(`  ✗ ${label} — ${((Date.now() - t0) / 1000).toFixed(1)}s — ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}

async function runGradeAllPhases(pipelineId: string, mode: "analysis" | "design", label: string) {
  console.log(`\n▶ ${label}`);
  await runChunkedGradePhase("P1 competency_setek", pipelineId, 1);
  await runChunkedGradePhase("P2 competency_changche", pipelineId, 2);
  await runChunkedGradePhase("P3 competency_haengteuk", pipelineId, 3);
  await runPhase("P4 setek_guide + slot_generation", () =>
    postPhase(`/api/admin/pipeline/grade/phase-4`, { pipelineId }));
  await runPhase("P5 changche_guide", () =>
    postPhase(`/api/admin/pipeline/grade/phase-5`, { pipelineId }));
  await runPhase("P6 haengteuk_guide", () =>
    postPhase(`/api/admin/pipeline/grade/phase-6`, { pipelineId }));
  if (mode === "design") {
    await runChunkedGradePhase("P7 draft_generation", pipelineId, 7);
    await runChunkedGradePhase("P8 draft_analysis", pipelineId, 8);
  }
}

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");

  const t0 = Date.now();
  console.log(`🎬 김세린 k=2 풀런 (HTTP)\n`);

  console.log(`🔑 임시 admin 세션 생성`);
  await provisionTempAdmin();
  console.log(`  temp userId=${TEMP_USER_ID.slice(0, 8)}\n`);

  const { data: refStudent } = await supabase
    .from("students")
    .select("target_major, grade, school_name")
    .eq("id", STUDENT_ID)
    .single();
  if (!refStudent) throw new Error("학생 없음");

  const { data: pipelineRef } = await supabase
    .from("student_record_analysis_pipelines")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1)
    .maybeSingle();
  const CREATED_BY = pipelineRef?.created_by as string;
  if (!CREATED_BY) throw new Error("created_by 확보 실패");

  console.log(`created_by=${CREATED_BY.slice(0, 8)} · student=${refStudent.school_name} G${refStudent.grade} · target=${refStudent.target_major}\n`);

  // ── 1. 클린업 ──
  await cleanup(supabase);
  console.log(`🧹 완료\n`);

  // ── 1b. main_exploration seed (4축×3층 Blueprint B1 전제) ──
  await seedMainExploration(supabase);


  // ── 2. Grade(analysis) G1 + G2 ──
  for (const grade of [1, 2] as const) {
    const gradePipelineId = await insertPipeline(supabase, {
      pipelineType: "grade",
      grade,
      mode: "analysis",
      taskKeys: GRADE_PIPELINE_TASK_KEYS,
      createdBy: CREATED_BY,
      snapshot: refStudent,
    });
    await runGradeAllPhases(gradePipelineId, "analysis", `Grade(analysis) G${grade} — ${gradePipelineId.slice(0, 8)}`);
  }

  // ── 3. Past Analytics ──
  console.log(`\n▶ Past Analytics`);
  const pastPipelineId = await insertPipeline(supabase, {
    pipelineType: "past_analytics",
    taskKeys: PAST_ANALYTICS_TASK_KEYS,
    createdBy: CREATED_BY,
    snapshot: { ...refStudent, neisGrades: [1, 2] },
  });
  console.log(`  pipelineId=${pastPipelineId.slice(0, 8)}`);
  for (const phase of [1, 2, 3] as const) {
    await runPhase(`A${phase}`, () =>
      postPhase(`/api/admin/pipeline/past-analytics/${phase}`, { pipelineId: pastPipelineId }));
  }

  // ── 4. Blueprint ──
  console.log(`\n▶ Blueprint`);
  const blueprintPipelineId = await insertPipeline(supabase, {
    pipelineType: "blueprint",
    taskKeys: BLUEPRINT_TASK_KEYS,
    createdBy: CREATED_BY,
    snapshot: { ...refStudent, consultingGrades: [3] },
  });
  console.log(`  pipelineId=${blueprintPipelineId.slice(0, 8)}`);
  await runPhase("B1 blueprint_generation", () =>
    postPhase(`/api/admin/pipeline/blueprint`, { pipelineId: blueprintPipelineId }));

  // ── 5. Grade(design) G3 ──
  const g3PipelineId = await insertPipeline(supabase, {
    pipelineType: "grade",
    grade: 3,
    mode: "design",
    taskKeys: GRADE_PIPELINE_TASK_KEYS,
    createdBy: CREATED_BY,
    snapshot: refStudent,
  });
  await runGradeAllPhases(g3PipelineId, "design", `Grade(design) G3 — ${g3PipelineId.slice(0, 8)}`);

  // ── 6. Synthesis ──
  console.log(`\n▶ Synthesis`);
  const { data: grades } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "grade");
  const gradePipelineIds = (grades ?? []).map((g) => g.id as string);
  const synthPipelineId = await insertPipeline(supabase, {
    pipelineType: "synthesis",
    mode: "analysis",
    taskKeys: SYNTHESIS_PIPELINE_TASK_KEYS,
    createdBy: CREATED_BY,
    snapshot: { ...refStudent, gradePipelineIds },
  });
  console.log(`  pipelineId=${synthPipelineId.slice(0, 8)}`);
  await runPhase("S1 storyline_generation", () =>
    postPhase(`/api/admin/pipeline/synthesis/phase-1`, { pipelineId: synthPipelineId }));
  await runPhase("S2a narrative_arc_extraction (chunked)", async () => {
    let iter = 0;
    while (true) {
      if (iter >= CHUNK_LOOP_CAP) throw new Error("narrative chunk cap");
      const r = (await postPhase("/api/admin/pipeline/synthesis/phase-2/narrative-chunk", {
        pipelineId: synthPipelineId,
        chunkSize: NARRATIVE_CHUNK_SIZE,
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

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ 김세린 풀런 완료 (총 ${totalElapsed}s)\n`);

  // ── 7. 검증 ──
  const [
    { data: hyperedges },
    { data: edges },
    { data: scores },
    { data: tags },
    { data: diagnoses },
    { data: strategies },
    { data: roadmap },
    { data: storylines },
    { data: narrativeArcs },
  ] = await Promise.all([
    supabase.from("student_record_hyperedges").select("edge_context, theme_label").eq("student_id", STUDENT_ID),
    supabase.from("student_record_edges").select("edge_context").eq("student_id", STUDENT_ID),
    supabase.from("student_record_competency_scores").select("source").eq("student_id", STUDENT_ID),
    supabase.from("student_record_activity_tags").select("tag_context").eq("student_id", STUDENT_ID),
    supabase.from("student_record_diagnosis").select("school_year, scope, overall_grade, direction_strength, strengths, weaknesses").eq("student_id", STUDENT_ID),
    supabase.from("student_record_strategies").select("scope, priority, target_area, strategy_content").eq("student_id", STUDENT_ID),
    supabase.from("student_record_roadmap_items").select("grade, semester, area").eq("student_id", STUDENT_ID),
    supabase.from("student_record_storylines").select("scope, title").eq("student_id", STUDENT_ID),
    supabase.from("student_record_narrative_arc").select("id").eq("student_id", STUDENT_ID),
  ]);

  console.log(`## 검증`);
  const hyperByCtx = new Map<string, string[]>();
  for (const h of hyperedges ?? []) {
    const k = String(h.edge_context);
    if (!hyperByCtx.has(k)) hyperByCtx.set(k, []);
    hyperByCtx.get(k)!.push(String(h.theme_label));
  }
  console.log(`   하이퍼엣지: ${hyperedges?.length ?? 0}건`);
  for (const [k, v] of hyperByCtx.entries()) {
    console.log(`     ${k}: ${v.length}건`);
    for (const t of v.slice(0, 3)) console.log(`       · ${t}`);
  }
  const edgeByCtx = new Map<string, number>();
  for (const e of edges ?? []) edgeByCtx.set(String(e.edge_context), (edgeByCtx.get(String(e.edge_context)) ?? 0) + 1);
  console.log(`   엣지: ${edges?.length ?? 0}건`);
  for (const [k, v] of edgeByCtx.entries()) console.log(`     ${k}: ${v}건`);
  const scoreBySrc = new Map<string, number>();
  for (const s of scores ?? []) scoreBySrc.set(String(s.source), (scoreBySrc.get(String(s.source)) ?? 0) + 1);
  console.log(`   역량점수: ${scores?.length ?? 0}건 · ${[...scoreBySrc.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const tagByCtx = new Map<string, number>();
  for (const t of tags ?? []) tagByCtx.set(String(t.tag_context), (tagByCtx.get(String(t.tag_context)) ?? 0) + 1);
  console.log(`   활동태그: ${tags?.length ?? 0}건 · ${[...tagByCtx.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);

  const diagByScope = new Map<string, number>();
  for (const d of diagnoses ?? []) diagByScope.set(String(d.scope), (diagByScope.get(String(d.scope)) ?? 0) + 1);
  console.log(`   진단: ${diagnoses?.length ?? 0}건 · ${[...diagByScope.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  for (const d of diagnoses ?? []) {
    const strengths = (d.strengths as unknown[] | null)?.length ?? 0;
    const weaknesses = (d.weaknesses as unknown[] | null)?.length ?? 0;
    console.log(`     [${d.school_year}/${d.scope}] overall=${d.overall_grade} dir=${d.direction_strength} str=${strengths} weak=${weaknesses}`);
  }
  const strategyByScope = new Map<string, number>();
  for (const s of strategies ?? []) strategyByScope.set(String(s.scope), (strategyByScope.get(String(s.scope)) ?? 0) + 1);
  console.log(`   전략: ${strategies?.length ?? 0}건 · ${[...strategyByScope.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const storylineByScope = new Map<string, number>();
  for (const s of storylines ?? []) storylineByScope.set(String(s.scope), (storylineByScope.get(String(s.scope)) ?? 0) + 1);
  console.log(`   storyline: ${storylines?.length ?? 0}건 · ${[...storylineByScope.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`   narrative_arc: ${narrativeArcs?.length ?? 0}건`);
  console.log(`   로드맵: ${roadmap?.length ?? 0}건`);
}

main()
  .catch((err) => {
    console.error("❌", err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupTempAdmin().catch(() => undefined);
  });
