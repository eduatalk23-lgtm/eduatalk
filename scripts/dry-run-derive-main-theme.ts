#!/usr/bin/env npx tsx
// ============================================
// dry-run-derive-main-theme.ts
//
// M1-c W6 (2026-04-27): mainTheme + cascadePlan capability 단독 dry-run.
// 학생 데이터를 DB 에서 읽어 deriveMainTheme + buildCascadePlan 직접 호출.
// 파이프라인 wiring 없이 prompt 출력 품질 검증용.
//
// 사용법:
//   npx tsx scripts/dry-run-derive-main-theme.ts <studentId> [tenantId]
//
// 환경:
//   .env.local 의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY 필요.
// ============================================

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { deriveMainTheme } from "../lib/domains/record-analysis/capability/main-theme";
import { buildCascadePlan } from "../lib/domains/record-analysis/capability/cascade-plan";
import { reconcileCascadeEvidence } from "../lib/domains/record-analysis/capability/cascade-evidence";

const KIM_DEFAULTS = {
  studentId: "0e3e149d-4b9c-402d-ad5c-b3df04190889",
  tenantId: "84b71a5d-5681-4da3-88d2-91e75ef89015",
};

(async () => {
  const studentId = process.argv[2] ?? KIM_DEFAULTS.studentId;
  const tenantId = process.argv[3] ?? KIM_DEFAULTS.tenantId;

  console.log(`\n=== dry-run-derive-main-theme ===`);
  console.log(`studentId: ${studentId}`);
  console.log(`tenantId:  ${tenantId}\n`);

  const sb = createSupabaseAdminClient()!;

  // 1. 학생 스냅샷 — 진로 정보 (실 컬럼명: target_sub_classification_id)
  const { data: student, error: studentErr } = await sb
    .from("students")
    .select("target_major, desired_career_field, target_sub_classification_id, grade")
    .eq("id", studentId)
    .maybeSingle();
  if (studentErr) {
    console.error("students 조회 에러:", studentErr.message);
    process.exit(1);
  }
  if (!student) {
    console.error("학생을 찾을 수 없습니다.");
    process.exit(1);
  }
  console.log("[학생 진로]");
  console.log(`  target_major: ${student.target_major ?? "(없음)"}`);
  console.log(`  career_field: ${student.desired_career_field ?? "(없음)"}`);
  console.log(`  sub_class_id: ${student.target_sub_classification_id ?? "(없음)"}`);
  console.log(`  grade:        ${student.grade ?? "(미상)"}`);

  // 2. KEDI 분류 라벨 — best-effort (테이블/컬럼 변동 가능)
  let classificationLabel: string | null = null;
  // 분류 라벨 조회는 dry-run 핵심 아님 — 진로 텍스트(target_major/career_field) 만으로 capability 충분.

  // 3. NEIS 발췌 (세특/창체/행특)
  const [{ data: setekRows }, { data: changcheRows }, { data: haengteukRows }] =
    await Promise.all([
      sb.from("student_record_seteks")
        .select("grade, imported_content, confirmed_content, content")
        .eq("student_id", studentId).eq("tenant_id", tenantId).is("deleted_at", null),
      sb.from("student_record_changche")
        .select("grade, imported_content, confirmed_content, content, activity_type")
        .eq("student_id", studentId).eq("tenant_id", tenantId),
      sb.from("student_record_haengteuk")
        .select("grade, imported_content, confirmed_content, content")
        .eq("student_id", studentId).eq("tenant_id", tenantId),
    ]);

  type Extract = { grade: number; category: string; summary: string };
  const neisExtracts: Extract[] = [];
  const neisExtractsByGrade: Record<number, Array<{ category: string; summary: string }>> = {};
  const pickText = (r: { imported_content?: string | null; confirmed_content?: string | null; content?: string | null }) =>
    (r.imported_content ?? r.confirmed_content ?? r.content ?? "").trim();

  for (const r of (setekRows ?? []) as Array<{ grade: number; imported_content?: string | null; confirmed_content?: string | null; content?: string | null }>) {
    const text = pickText(r).slice(0, 200);
    if (!text) continue;
    neisExtracts.push({ grade: r.grade, category: "setek", summary: text });
    (neisExtractsByGrade[r.grade] ??= []).push({ category: "setek", summary: text });
  }
  for (const r of (changcheRows ?? []) as Array<{ grade: number; activity_type?: string; imported_content?: string | null; confirmed_content?: string | null; content?: string | null }>) {
    const text = pickText(r).slice(0, 200);
    if (!text) continue;
    const cat = `changche:${r.activity_type ?? "?"}`;
    neisExtracts.push({ grade: r.grade, category: cat, summary: text });
    (neisExtractsByGrade[r.grade] ??= []).push({ category: cat, summary: text });
  }
  for (const r of (haengteukRows ?? []) as Array<{ grade: number; imported_content?: string | null; confirmed_content?: string | null; content?: string | null }>) {
    const text = pickText(r).slice(0, 200);
    if (!text) continue;
    neisExtracts.push({ grade: r.grade, category: "haengteuk", summary: text });
    (neisExtractsByGrade[r.grade] ??= []).push({ category: "haengteuk", summary: text });
  }
  console.log(`\n[NEIS 발췌] 총 ${neisExtracts.length}건`);
  for (const g of Object.keys(neisExtractsByGrade).sort()) {
    console.log(`  ${g}학년: ${neisExtractsByGrade[Number(g)].length}건`);
  }

  // 4. 수강계획
  const { data: planRows } = await sb
    .from("student_course_plans")
    .select("grade, subject_name")
    .eq("student_id", studentId);
  const coursePlanByGrade: Record<number, string[]> = {};
  for (const p of (planRows ?? []) as Array<{ grade: number; subject_name: string | null }>) {
    if (!p.subject_name) continue;
    (coursePlanByGrade[p.grade] ??= []).push(p.subject_name);
  }
  console.log(`\n[수강계획]`);
  for (const g of Object.keys(coursePlanByGrade).sort()) {
    console.log(`  ${g}학년: ${coursePlanByGrade[Number(g)].slice(0, 6).join(", ")}`);
  }

  // 5. deriveMainTheme 호출
  console.log(`\n=== deriveMainTheme 호출 (fast tier) ===`);
  const themeStart = Date.now();
  const themeRes = await deriveMainTheme({
    studentProfile: {
      targetMajor: student.target_major ?? null,
      careerFieldHint: student.desired_career_field ?? null,
      classificationLabel,
    },
    neisExtracts: neisExtracts.length > 0 ? neisExtracts : undefined,
    coursePlan:
      Object.keys(coursePlanByGrade).length > 0
        ? Object.entries(coursePlanByGrade).map(([g, subjects]) => ({
            grade: Number(g),
            subjects,
          }))
        : undefined,
  });
  console.log(`elapsed: ${Date.now() - themeStart}ms`);
  if (!themeRes.ok) {
    console.error(`❌ FAIL: ${themeRes.reason}`);
    process.exit(1);
  }
  console.log(`✅ OK (model=${themeRes.modelId ?? "?"} tokens=${themeRes.usage?.inputTokens}/${themeRes.usage?.outputTokens})`);
  console.log(`\n[mainTheme]`);
  console.log(`  label:     ${themeRes.theme.label}`);
  console.log(`  keywords:  ${themeRes.theme.keywords.join(", ")}`);
  console.log(`  rationale: ${themeRes.theme.rationale}`);
  console.log(`  citations:`);
  for (const c of themeRes.theme.sourceCitations) console.log(`    - ${c}`);

  // 6. buildCascadePlan 호출
  const targetGrades = Array.from(
    new Set([
      ...Object.keys(neisExtractsByGrade).map((g) => Number(g)),
      ...Object.keys(coursePlanByGrade).map((g) => Number(g)),
      1, 2, 3,
    ]),
  ).filter((g) => g >= 1 && g <= 3).sort();

  console.log(`\n=== buildCascadePlan 호출 (fast tier, targetGrades=${targetGrades.join(",")}) ===`);
  const cascadeStart = Date.now();
  const cascadeRes = await buildCascadePlan({
    mainTheme: themeRes.theme,
    targetGrades,
    currentGrade: student.grade ?? null,
    neisExtractsByGrade:
      Object.keys(neisExtractsByGrade).length > 0 ? neisExtractsByGrade : undefined,
    coursePlanByGrade:
      Object.keys(coursePlanByGrade).length > 0 ? coursePlanByGrade : undefined,
  });
  console.log(`elapsed: ${Date.now() - cascadeStart}ms`);
  if (!cascadeRes.ok) {
    console.error(`❌ FAIL: ${cascadeRes.reason}`);
    process.exit(1);
  }
  console.log(`✅ OK (model=${cascadeRes.modelId ?? "?"} tokens=${cascadeRes.usage?.inputTokens}/${cascadeRes.usage?.outputTokens})`);

  // 옵션 A-2: cascade evidence 코드 후처리 — runner 와 동일.
  const reconciled = reconcileCascadeEvidence({
    plan: cascadeRes.plan,
    neisExtractsByGrade:
      Object.keys(neisExtractsByGrade).length > 0 ? neisExtractsByGrade : undefined,
    mainTheme: themeRes.theme,
  });
  if (reconciled.changes.some((c) => c.action !== "kept")) {
    console.log(`\n[evidence 후처리 변경]`);
    for (const c of reconciled.changes) {
      if (c.action === "kept") continue;
      console.log(`  ${c.grade}학년: ${c.action}` +
        (c.removed ? ` removed=${JSON.stringify(c.removed)}` : "") +
        (c.added ? ` added=${JSON.stringify(c.added)}` : ""));
    }
  }
  const finalPlan = reconciled.plan;

  console.log(`\n[cascadePlan]`);
  console.log(`  themeLabel: ${finalPlan.themeLabel}`);
  if (finalPlan.coherenceNote) {
    console.log(`  coherenceNote: ${finalPlan.coherenceNote}`);
  }
  for (const grade of targetGrades) {
    const node = finalPlan.byGrade[String(grade)];
    if (!node) continue;
    console.log(`\n  ── ${grade}학년 [${node.tier}] ──`);
    console.log(`     subjects:  ${node.subjects.join(", ")}`);
    console.log(`     content:   ${node.contentSummary}`);
    if (node.evidenceFromNeis && node.evidenceFromNeis.length > 0) {
      console.log(`     evidence:`);
      for (const e of node.evidenceFromNeis) console.log(`       - ${e}`);
    }
    console.log(`     rationale: ${node.rationale}`);
  }

  console.log(`\n=== dry-run 완료 ===\n`);
})();
