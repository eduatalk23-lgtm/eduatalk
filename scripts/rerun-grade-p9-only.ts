#!/usr/bin/env npx tsx
/**
 * Grade P9 draft_refinement 단독 재실행 (Phase 5 Sprint 2 실측용).
 *
 * 전제:
 *   - Grade 파이프라인의 P1~P8 가 이미 completed
 *   - dev 서버가 ENABLE_DRAFT_REFINEMENT=true 로 재시작되어 있음
 *   - DB 마이그레이션 `content_quality.retry_count` 적용 완료
 *
 * 사용법:
 *   npx tsx scripts/rerun-grade-p9-only.ts <targetGrade>
 *   # 또는 env 로 지정
 *   P9_STUDENT_ID=<uuid> P9_TARGET_GRADE=<n> npx tsx scripts/rerun-grade-p9-only.ts
 *
 * default STUDENT_ID = xrun-seed-01.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID =
  process.env.P9_STUDENT_ID ?? "c0ffee01-5eed-4d00-9000-000000000001";
const TARGET_GRADE = Number(
  process.env.P9_TARGET_GRADE ?? process.argv[2] ?? "2",
);
const TENANT_ID = process.env.P9_TENANT_ID ?? "84b71a5d-5681-4da3-88d2-91e75ef89015";
const BASE_URL = process.env.DEV_URL ?? "http://localhost:3000";
const CHUNK_SIZE = Number(process.env.P9_CHUNK_SIZE ?? "4");

let TEMP_COOKIE_HEADER = "";
let TEMP_USER_ID = "";

async function provisionTempAdmin(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createSupabaseAdminClient()!;
  const email = `p9run-${Date.now()}@example.invalid`;
  const password = `P9-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data: createRes, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { signup_role: "admin", tenant_id: TENANT_ID },
  });
  if (ce || !createRes.user) throw ce ?? new Error("temp admin 생성 실패");
  await admin.from("user_profiles").insert({
    id: createRes.user.id, email, role: "admin", tenant_id: TENANT_ID,
    name: "P9 Rerun", is_active: true,
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

  if (!Number.isFinite(TARGET_GRADE) || TARGET_GRADE < 1 || TARGET_GRADE > 3) {
    console.error(`❌ 잘못된 targetGrade: ${TARGET_GRADE}`);
    process.exit(1);
  }

  console.log(`▶ student_id=${STUDENT_ID.slice(0, 8)} targetGrade=${TARGET_GRADE} chunkSize=${CHUNK_SIZE}`);

  await provisionTempAdmin();

  // Grade 파이프라인 조회 (가장 최근 것)
  const { data: pipe } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, grade, status, tasks, task_results, task_previews")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "grade")
    .eq("grade", TARGET_GRADE)
    .in("status", ["completed", "running", "pending"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pipe) {
    console.error(`❌ Grade ${TARGET_GRADE} 파이프라인 없음`);
    process.exit(1);
  }

  const pipelineId = pipe.id;
  console.log(`🔄 draft_refinement pending 리셋: pipelineId=${pipelineId.slice(0, 8)} (현 status=${pipe.status})`);

  const tasks = { ...(pipe.tasks as Record<string, string>), draft_refinement: "pending" };
  const results = { ...(pipe.task_results as Record<string, unknown>) };
  delete results.draft_refinement;
  delete (results as Record<string, unknown>)["draft_refinement_accumulated"];
  const previews = { ...(pipe.task_previews as Record<string, unknown>) };
  delete previews.draft_refinement;

  await supabase
    .from("student_record_analysis_pipelines")
    .update({ tasks, task_results: results, task_previews: previews, status: "running" })
    .eq("id", pipelineId);

  // Pre-state: eligible 레코드 사전 집계
  const currentYear = new Date().getMonth() + 1 >= 3
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;
  const { data: student } = await supabase
    .from("students").select("grade").eq("id", STUDENT_ID).maybeSingle();
  const studentGrade = (student?.grade as number) ?? 3;
  const targetSchoolYear = currentYear - studentGrade + TARGET_GRADE;

  const { data: preQuality } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, overall_score, retry_count, issues, feedback, specificity, coherence, depth, grammar")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected")
    .lt("overall_score", 70)
    .eq("retry_count", 0);

  const eligible = (preQuality ?? []) as Array<{
    record_id: string; record_type: string; overall_score: number;
    issues: unknown; feedback: string;
    specificity: number; coherence: number; depth: number; grammar: number;
  }>;
  console.log(`\n📋 대상 레코드 (school_year=${targetSchoolYear}): ${eligible.length} 건`);
  for (const r of eligible) {
    const issues = Array.isArray(r.issues) ? (r.issues as string[]) : [];
    console.log(`  [${r.record_type}] ${r.record_id.slice(0, 8)} score=${r.overall_score} (spec=${r.specificity} coh=${r.coherence} depth=${r.depth} gram=${r.grammar}) issues=${issues.length}`);
  }

  if (eligible.length === 0) {
    console.log("\n⚠ 대상 레코드 0건 — POST 스킵하고 종료");
    return;
  }

  // POST phase-9 (hasMore 없을 때까지)
  let chunkIdx = 0;
  while (true) {
    chunkIdx++;
    const t0 = Date.now();
    console.log(`\n▶ [chunk ${chunkIdx}] POST /api/admin/pipeline/grade/phase-9 (chunkSize=${CHUNK_SIZE})`);
    const res = await fetch(`${BASE_URL}/api/admin/pipeline/grade/phase-9`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: TEMP_COOKIE_HEADER },
      body: JSON.stringify({ pipelineId, chunkSize: CHUNK_SIZE }),
    });
    const text = await res.text();
    const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
    if (!res.ok) {
      console.error(`❌ chunk ${chunkIdx} 실패 (${elapsedS}s): ${res.status} ${text.slice(0, 800)}`);
      process.exit(1);
    }
    const body = JSON.parse(text) as { hasMore?: boolean; chunkProcessed?: number; totalUncached?: number };
    console.log(`  ✅ ${elapsedS}s | hasMore=${body.hasMore ?? false} chunkProcessed=${body.chunkProcessed ?? 0} totalUncached=${body.totalUncached ?? 0}`);
    if (!body.hasMore) break;
    if (chunkIdx > 20) {
      console.error("❌ chunk 무한 루프 감지 (>20) — 중단");
      process.exit(1);
    }
  }

  // Final 결과 조회
  const { data: final } = await supabase
    .from("student_record_analysis_pipelines")
    .select("task_results, task_previews, tasks, status")
    .eq("id", pipelineId)
    .maybeSingle();

  const result = (final?.task_results as Record<string, unknown>)?.draft_refinement;
  const preview = (final?.task_previews as Record<string, unknown>)?.draft_refinement;
  const taskState = (final?.tasks as Record<string, string>)?.draft_refinement;

  console.log(`\n📊 P9 최종 결과 (pipeline.status=${final?.status}, draft_refinement=${taskState})`);
  console.log(`  preview: ${preview}`);
  console.log(`  result:\n${JSON.stringify(result, null, 2).split("\n").map((l) => "    " + l).join("\n")}`);

  // Post-state: retry_count / score 변동 확인
  const recordIds = eligible.map((r) => r.record_id);
  const { data: postQuality } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, overall_score, retry_count, issues")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected")
    .in("record_id", recordIds);

  const preMap = new Map(eligible.map((r) => [r.record_id, r]));
  console.log(`\n📈 레코드별 score 변화 (before → after / retry_count)`);
  let deltaSum = 0;
  let refinedCnt = 0;
  let rolledCnt = 0;
  for (const p of (postQuality ?? []) as Array<{
    record_id: string; record_type: string; overall_score: number; retry_count: number;
  }>) {
    const pre = preMap.get(p.record_id);
    if (!pre) continue;
    const delta = p.overall_score - pre.overall_score;
    const tag = p.retry_count === 0 ? "未시도" : delta > 0 ? `refined(+${delta})` : delta === 0 ? "보류(rollback)" : `rollback(${delta})`;
    console.log(`  [${p.record_type}] ${p.record_id.slice(0, 8)} ${pre.overall_score} → ${p.overall_score} retry=${p.retry_count} ${tag}`);
    if (p.retry_count === 1) {
      if (delta > 0) { refinedCnt++; deltaSum += delta; }
      else { rolledCnt++; }
    }
  }
  console.log(`\n🏁 요약: refined=${refinedCnt}, rolledBack=${rolledCnt}, total_eligible=${eligible.length}, avgScoreDelta=${refinedCnt ? (deltaSum / refinedCnt).toFixed(2) : "0"}`);
}

main()
  .catch((e) => { console.error("❌", e instanceof Error ? e.stack : e); process.exitCode = 1; })
  .finally(async () => { await cleanupTempAdmin().catch(() => undefined); });
