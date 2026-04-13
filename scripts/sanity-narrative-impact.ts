#!/usr/bin/env npx tsx
/**
 * L4-E / Phase 2-1 Sanity Check — narrativeContext가 가이드 출력에 실제로 반영되는가?
 *
 * 동일 학생의 setekGuide 프롬프트를 (a) narrativeContext 포함, (b) 미포함 두 번 빌드 →
 * LLM 호출 → JSON diff 저장. 컨설턴트가 출력 비교로 의미 있는 차이가 있는지 판정.
 *
 * 사용법:
 *   npx tsx scripts/sanity-narrative-impact.ts <student_id>
 *
 * 출력:
 *   tmp/narrative-sanity/<student_id>/with.json
 *   tmp/narrative-sanity/<student_id>/without.json
 *   tmp/narrative-sanity/<student_id>/prompts.txt   # 두 프롬프트 raw 텍스트
 *   tmp/narrative-sanity/<student_id>/diff-summary.md  # 핵심 diff 요약
 *
 * 주의: 실제 LLM 2회 호출 (Gemini 무료 한도 차감). 가이드 저장 X, 읽기 전용.
 */

import { config } from "dotenv";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { generateTextWithRateLimit } from "../lib/domains/record-analysis/llm/ai-client";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../lib/domains/record-analysis/llm/prompts/setekGuide";
import { computePrioritizedWeaknessesFromInputs } from "../lib/domains/record-analysis/pipeline/narrative-context";
import type {
  SetekGuideInput,
  GuideAnalysisContext,
} from "../lib/domains/record-analysis/llm/types";

// ─────────────────────────────────────────────
// 데이터 조회 (admin client, RLS 우회)
// ─────────────────────────────────────────────

async function fetchMinimalContext(studentId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");

  const [studentRes, profileRes, seteksRes, weakRes, qualityRes] = await Promise.all([
    supabase.from("students")
      .select("id, tenant_id, grade, target_major, school_name")
      .eq("id", studentId).maybeSingle(),
    supabase.from("user_profiles").select("name").eq("id", studentId).maybeSingle(),
    supabase.from("student_record_seteks")
      .select("id, grade, semester, subject_id, content, imported_content, confirmed_content")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("grade", { ascending: true }),
    supabase.from("student_record_competency_scores")
      .select("competency_item, grade, narrative")
      .eq("student_id", studentId)
      .eq("source", "ai")
      .in("grade", ["B-", "C"]),
    supabase.from("student_record_content_quality")
      .select("issues")
      .eq("student_id", studentId)
      .eq("source", "ai"),
  ]);

  if (!studentRes.data) throw new Error(`학생 ${studentId} 미발견`);

  const subjectIds = [...new Set((seteksRes.data ?? []).map((s) => s.subject_id))];
  const subjectsRes = subjectIds.length > 0
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
    : { data: [] };
  const subjectMap = new Map<string, string>();
  for (const s of subjectsRes.data ?? []) subjectMap.set(s.id, s.name);

  return {
    student: studentRes.data,
    studentName: profileRes.data?.name ?? "학생",
    seteks: seteksRes.data ?? [],
    subjectMap,
    weakCompetencies: (weakRes.data ?? []).map((w) => ({
      item: w.competency_item,
      grade: w.grade,
      reasoning: w.narrative,
    })),
    qualityIssuesPerRecord: (qualityRes.data ?? []).map((q) => q.issues ?? []),
  };
}

function effectiveContent(s: { content: string; imported_content: string | null; confirmed_content: string | null }) {
  return s.imported_content?.trim() || s.confirmed_content?.trim() || s.content?.trim() || "";
}

function buildSetekInput(ctx: Awaited<ReturnType<typeof fetchMinimalContext>>, withNarrative: boolean): SetekGuideInput {
  const recordDataByGrade: SetekGuideInput["recordDataByGrade"] = {};
  const grades = [...new Set(ctx.seteks.map((s) => s.grade))].filter((g): g is number => typeof g === "number");

  for (const g of grades) {
    const seteks = ctx.seteks
      .filter((s) => s.grade === g)
      .map((s) => ({
        subject_name: ctx.subjectMap.get(s.subject_id) ?? "과목 미정",
        content: effectiveContent(s),
      }))
      .filter((s) => s.content.length > 0);
    if (seteks.length === 0) continue;
    recordDataByGrade[g] = { seteks, changche: [] };
  }

  const prioritizedWeaknesses = withNarrative
    ? computePrioritizedWeaknessesFromInputs(ctx.weakCompetencies, ctx.qualityIssuesPerRecord)
    : [];

  const analysisContext: GuideAnalysisContext = {
    qualityIssues: [],
    weakCompetencies: ctx.weakCompetencies,
    ...(withNarrative && prioritizedWeaknesses.length > 0
      ? { narrativeContext: { prioritizedWeaknesses } }
      : {}),
  };

  return {
    studentName: ctx.studentName,
    grade: ctx.student.grade,
    targetMajor: ctx.student.target_major ?? undefined,
    targetGrades: grades,
    recordDataByGrade,
    analysisContext,
  };
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────

async function main() {
  const studentId = process.argv[2];
  if (!studentId) {
    console.error("❌ student_id 필수");
    console.error("   사용법: npx tsx scripts/sanity-narrative-impact.ts <student_id>");
    process.exit(1);
  }

  console.log(`🔍 학생 데이터 조회: ${studentId}`);
  const ctx = await fetchMinimalContext(studentId);
  console.log(`  · 이름: ${ctx.studentName} / ${ctx.student.grade}학년 / ${ctx.student.target_major ?? "전공 미정"}`);
  console.log(`  · 세특: ${ctx.seteks.length}건 / 약점 역량: ${ctx.weakCompetencies.length}건 / 품질 레코드: ${ctx.qualityIssuesPerRecord.length}건`);

  const inputWith = buildSetekInput(ctx, true);
  const inputWithout = buildSetekInput(ctx, false);

  const promptWith = buildUserPrompt(inputWith);
  const promptWithout = buildUserPrompt(inputWithout);

  // 사전 검증: prompt에 narrative 섹션이 들어갔는지
  const hasNarrativeSection = promptWith.includes("## 보강 우선순위");
  const hasNarrativeSectionWithout = promptWithout.includes("## 보강 우선순위");
  console.log(`  · narrative 섹션 (with): ${hasNarrativeSection ? "✅" : "❌ ⚠️ 빌더 문제 가능성"}`);
  console.log(`  · narrative 섹션 (without): ${hasNarrativeSectionWithout ? "❌ ⚠️ 누수" : "✅"}`);

  const outDir = path.join(process.cwd(), "tmp", "narrative-sanity", studentId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "prompt-with.txt"), promptWith);
  writeFileSync(path.join(outDir, "prompt-without.txt"), promptWithout);
  console.log(`📝 프롬프트 저장: ${outDir}/prompt-{with,without}.txt`);
  console.log(`  · prompt 길이 — with: ${promptWith.length}자 / without: ${promptWithout.length}자 (Δ ${promptWith.length - promptWithout.length})`);

  console.log(`\n🤖 LLM 호출 1/2 (with narrative)`);
  const startA = Date.now();
  const resultWith = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: promptWith }],
    modelTier: "standard",
    temperature: 0.4,
    maxTokens: 32768,
    responseFormat: "json",
  });
  console.log(`  · 완료 ${Date.now() - startA}ms`);

  console.log(`🤖 LLM 호출 2/2 (without narrative)`);
  const startB = Date.now();
  const resultWithout = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: promptWithout }],
    modelTier: "standard",
    temperature: 0.4,
    maxTokens: 32768,
    responseFormat: "json",
  });
  console.log(`  · 완료 ${Date.now() - startB}ms`);

  const parsedWith = resultWith.content ? parseResponse(resultWith.content) : null;
  const parsedWithout = resultWithout.content ? parseResponse(resultWithout.content) : null;

  writeFileSync(path.join(outDir, "with.json"), JSON.stringify(parsedWith, null, 2));
  writeFileSync(path.join(outDir, "without.json"), JSON.stringify(parsedWithout, null, 2));

  // diff 요약
  const summary: string[] = [];
  summary.push(`# Narrative Impact Sanity — ${ctx.studentName} (${studentId})`);
  summary.push("");
  summary.push(`- 학생: ${ctx.student.grade}학년 / ${ctx.student.target_major ?? "-"} / ${ctx.student.school_name ?? "-"}`);
  summary.push(`- 입력 시그널: 약점 역량 ${ctx.weakCompetencies.length} / 품질 이슈 레코드 ${ctx.qualityIssuesPerRecord.length}`);
  summary.push(`- prompt 길이: with ${promptWith.length} / without ${promptWithout.length} (Δ ${promptWith.length - promptWithout.length})`);
  summary.push("");
  summary.push(`## 응답 메타`);
  summary.push(`- with: ${parsedWith?.guides.length ?? 0} guides, overallDirection ${parsedWith?.overallDirection?.length ?? 0}자`);
  summary.push(`- without: ${parsedWithout?.guides.length ?? 0} guides, overallDirection ${parsedWithout?.overallDirection?.length ?? 0}자`);
  summary.push("");
  summary.push(`## overallDirection 비교`);
  summary.push(`### with`);
  summary.push("```");
  summary.push(parsedWith?.overallDirection ?? "(없음)");
  summary.push("```");
  summary.push(`### without`);
  summary.push("```");
  summary.push(parsedWithout?.overallDirection ?? "(없음)");
  summary.push("```");
  summary.push("");
  summary.push(`## 가이드별 direction 첫 문장 비교 (subject 기준 매칭)`);
  const withMap = new Map((parsedWith?.guides ?? []).map((g) => [g.subjectName, g] as const));
  const withoutMap = new Map((parsedWithout?.guides ?? []).map((g) => [g.subjectName, g] as const));
  const allSubjects = [...new Set([...withMap.keys(), ...withoutMap.keys()])];
  for (const subj of allSubjects) {
    const a = withMap.get(subj);
    const b = withoutMap.get(subj);
    summary.push(`### ${subj}`);
    summary.push(`- with: ${(a?.direction ?? "(없음)").slice(0, 200)}`);
    summary.push(`- without: ${(b?.direction ?? "(없음)").slice(0, 200)}`);
    summary.push(`- keyword diff (with - without): [${a ? a.keywords.filter((k) => !b?.keywords.includes(k)).join(", ") : ""}]`);
    summary.push("");
  }
  writeFileSync(path.join(outDir, "diff-summary.md"), summary.join("\n"));
  console.log(`\n✅ 결과 저장: ${outDir}`);
  console.log(`   - with.json / without.json — 가이드 raw`);
  console.log(`   - prompt-with.txt / prompt-without.txt — 프롬프트 raw`);
  console.log(`   - diff-summary.md — 핵심 diff 요약 (먼저 보세요)`);
}

main().catch((err) => {
  console.error("❌ 실패:", err);
  process.exit(1);
});
