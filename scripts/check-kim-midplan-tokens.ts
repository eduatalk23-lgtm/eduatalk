#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

(async () => {
  const sb = createSupabaseAdminClient()!;

  // 1. 김세린 grade pipelines 의 _midPlan focusHypothesis 들 추출
  const { data: pipes } = await sb
    .from("student_record_analysis_pipelines")
    .select("grade, task_results")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "grade")
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const focusList: string[] = [];
  const seenGrades = new Set<number>();
  for (const p of pipes ?? []) {
    if (p.grade == null || seenGrades.has(p.grade)) continue;
    seenGrades.add(p.grade);
    const mp = (p.task_results as any)?._midPlan;
    if (mp?.focusHypothesis) {
      focusList.push(`G${p.grade}: ${mp.focusHypothesis}`);
    }
  }
  console.log("=== focusHypothesis 모음 ===");
  for (const f of focusList) console.log("  ", f);

  // 2. 키워드 추출 — v3: 보수적 stopword + 매칭 개수 비례 보너스
  const tokens = new Set<string>();
  // 어미·조사 stopword: 어절이 어미로 끝나면 의미 약함
  const KO_SUFFIX_STOP = /(은|는|이|가|을|를|에|와|과|의|로|도|만|에서|부터|까지|에게|이다|있다|되다|되|할|것|면|며|므로|이며|있으며|있는|있을|관련된|있다|이다|이며|이지만|할까|일까|것이다|것이며)$/;
  // 의미 없는 일반어절 — broad 한 동사/조사 형태
  const KO_GENERIC_STOP = new Set([
    "있다", "있으며", "있는", "있을", "이", "그", "저",
    "대한", "위한", "위해", "대해", "통해", "통한", "관련", "관련된",
    "학생", "학생은", "역량이", "역량을", "이슈가", "테마", "테마에",
    "이해가", "이해", "필요할", "필요", "부족할", "부족", "가능성", "가능성이",
    "것으로", "추정된다", "추정", "발생할", "발생",
  ]);
  for (const f of focusList) {
    const kebab = f.toLowerCase().match(/[a-z]+(?:-[a-z]+)+/g) ?? [];
    for (const m of kebab) tokens.add(m);
    const cleaned = f.replace(/\([^)]*\)/g, " ");
    const allWords = cleaned.split(/[\s·,/[\]{}"'`~!@#$%^&*+=|<>?:;.0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && /^[가-힣]+$/.test(w));
    const semantic = allWords.filter((w) => !KO_SUFFIX_STOP.test(w) && !KO_GENERIC_STOP.has(w));
    for (const w of semantic) tokens.add(w);
    for (let i = 0; i < semantic.length - 1; i++) {
      tokens.add(`${semantic[i]} ${semantic[i + 1]}`);
    }
  }

  // v4: gradeThemes 도 토큰 source 에 추가
  for (const p of pipes ?? []) {
    if (p.grade == null) continue;
    const tr = (p.task_results as any) ?? {};
    const themesEntry = tr.cross_subject_theme_extraction;
    if (!themesEntry?.themes) continue;
    const dominantSet = new Set<string>(themesEntry.dominantThemeIds ?? []);
    for (const theme of themesEntry.themes) {
      if (!dominantSet.has(theme.id)) continue;
      if (/^[a-z]+(?:-[a-z]+)+$/.test(theme.id)) tokens.add(theme.id.toLowerCase());
      if (theme.label) {
        tokens.add(theme.label.toLowerCase());
        for (const w of theme.label.split(/[\s·]+/).map((s: string) => s.trim()).filter(
          (s: string) => s.length >= 2 && /^[가-힣]+$/.test(s) && !KO_GENERIC_STOP.has(s),
        )) tokens.add(w);
      }
      for (const kw of theme.keywords ?? []) {
        const k = kw.trim().toLowerCase();
        if (k.length >= 2 && !KO_GENERIC_STOP.has(k)) tokens.add(k);
      }
    }
  }
  console.log("\n=== 추출 토큰 (총", tokens.size, "개) ===");
  console.log("  ", [...tokens].slice(0, 30).join(", "));

  // 3. 김세린에게 배정된 가이드들의 title 가져와서 매칭 시뮬레이션
  const { data: assigns } = await sb
    .from("exploration_guide_assignments")
    .select("guide_id, student_notes, exploration_guides!inner(id, title)")
    .eq("student_id", STUDENT_ID)
    .eq("status", "assigned")
    .order("created_at", { ascending: false })
    .limit(50);

  console.log(`\n=== 배정 가이드 ${assigns?.length} 건 / 매칭 개수 분포 ===`);
  const distribution: Record<number, number> = {};
  const sample: { count: number; title: string; hits: string[] }[] = [];
  for (const a of assigns ?? []) {
    const g = (a as any).exploration_guides;
    if (!g?.title) continue;
    const titleLower = g.title.toLowerCase();
    const hits: string[] = [];
    for (const tok of tokens) {
      if (titleLower.includes(tok)) hits.push(tok);
    }
    const cnt = hits.length;
    distribution[cnt] = (distribution[cnt] ?? 0) + 1;
    if (sample.length < 12) sample.push({ count: cnt, title: g.title.slice(0, 80), hits: hits.slice(0, 3) });
  }
  for (const [c, n] of Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  매칭 ${c}개: ${n}건`);
  }

  // 매칭 개수 비례 보너스 시뮬레이션
  console.log("\n=== 비례 보너스 ===");
  let bonus0 = 0, bonus105 = 0, bonus110 = 0, bonus115 = 0;
  for (const [c, n] of Object.entries(distribution)) {
    const cnt = Number(c);
    if (cnt === 0) bonus0 += n;
    else if (cnt === 1) bonus105 += n;
    else if (cnt === 2) bonus110 += n;
    else bonus115 += n;
  }
  console.log(`  1.00× (0 매칭): ${bonus0}건`);
  console.log(`  1.05× (1 매칭): ${bonus105}건`);
  console.log(`  1.10× (2 매칭): ${bonus110}건`);
  console.log(`  1.15× (3+ 매칭): ${bonus115}건`);

  console.log("\n매칭 샘플 (12건):");
  for (const s of sample.sort((a, b) => b.count - a.count)) {
    console.log(`  [${s.count}] ${s.title} → ${s.hits.join(", ")}`);
  }
})();
