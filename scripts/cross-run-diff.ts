#!/usr/bin/env npx tsx
/**
 * Cross-run 스냅샷 2개 비교.
 *
 * 사용:
 *   npx tsx scripts/cross-run-diff.ts tmp/cross-run/kim--run1-post.json tmp/cross-run/kim--run2-post.json
 *
 * 출력 메트릭:
 *   [A] 파이프라인 누적 증가분 (synth/blueprint completed 개수)
 *   [B] previousRunOutputs 실제 활성 증거:
 *       - run2 synthesis.completed_at > run1 synthesis.completed_at ?
 *       - run2의 storyline_generation preview가 run1과 비교해 신규 storyline/연결 수 변화
 *   [C] Storyline 연속성:
 *       - title Jaccard, keywords Jaccard
 *       - run1 activity_summaries.summary_title 토큰이 run2 storyline title/keywords 에 등장한 비율 (cross-run 프롬프트 주입 효과 간접 지표)
 *   [D] Blueprint convergences:
 *       - themeLabel Jaccard, count delta, tier 분포
 *   [E] Hyperedge/엣지 변화량
 *   [F] Narrative arc / 진단 / 전략 개수 변화
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Snapshot = {
  meta: { studentKey: string; studentLabel: string; label: string; capturedAt: string };
  pipelines: {
    total: number;
    synthesisCompletedCount: number;
    blueprintCompletedCount: number;
    latestSynthesis: null | {
      id: string;
      completed_at: string | null;
      taskResultKeys: string[];
      storylineGenerationResult: unknown;
      activitySummaryResult: unknown;
    };
    latestBlueprint: null | {
      id: string;
      completed_at: string | null;
      targetConvergences: Array<{
        grade?: number;
        themeLabel?: string;
        tierAlignment?: string;
        themeKeywords?: string[];
        sharedCompetencies?: string[];
      }>;
      milestoneGrades: string[];
      growthTargetCount: number;
    };
  };
  storylines: {
    count: number;
    items: Array<{ id: string; title: string; keywords: string[] | null; grade_themes: (string | null)[] }>;
  };
  activitySummaries: {
    count: number;
    titles: Array<{ id: string; title: string; school_year: number; target_grades: number[] }>;
  };
  hyperedges: { count: number; byContext: Record<string, number>; themeLabelsByContext: Record<string, string[]> };
  edges: { count: number; byContext: Record<string, number> };
  diagnosis: { count: number; byScope: Record<string, number> };
  strategies: { count: number; byScope: Record<string, number> };
  roadmap: { count: number };
  narrativeArcs: { count: number; bySource: Record<string, number> };
  haengteukGuideLinks: { count: number };
};

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\[ai\]/g, "").replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  // 한글 2-gram + 공백분리 단어 혼합 (한글 토큰화 근사)
  const words = normalize(s).split(/[\s,·\-_/]+/).filter((w) => w.length >= 2);
  const bigrams: string[] = [];
  const raw = normalize(s).replace(/\s+/g, "");
  for (let i = 0; i < raw.length - 1; i++) bigrams.push(raw.slice(i, i + 2));
  return [...new Set([...words, ...bigrams])];
}

function containsAny(haystack: string, needles: string[]): boolean {
  const h = normalize(haystack);
  return needles.some((n) => n.length >= 2 && h.includes(normalize(n)));
}

async function main() {
  const [, , p1, p2] = process.argv;
  if (!p1 || !p2) {
    console.error("사용: npx tsx scripts/cross-run-diff.ts <snapshot-A.json> <snapshot-B.json>");
    process.exit(1);
  }
  const [a, b] = await Promise.all([
    readFile(resolve(p1), "utf-8").then((t) => JSON.parse(t) as Snapshot),
    readFile(resolve(p2), "utf-8").then((t) => JSON.parse(t) as Snapshot),
  ]);

  if (a.meta.studentKey !== b.meta.studentKey) {
    console.error(`⚠ 학생 불일치: ${a.meta.studentKey} vs ${b.meta.studentKey} — 비교 의미 없음`);
    process.exit(1);
  }

  console.log(`\n=== Cross-run diff: ${a.meta.studentLabel} ===`);
  console.log(`  A: ${a.meta.label} (${a.meta.capturedAt})`);
  console.log(`  B: ${b.meta.label} (${b.meta.capturedAt})\n`);

  // [A] 파이프라인 증가분
  console.log(`[A] 파이프라인 누적`);
  console.log(`   total          ${a.pipelines.total} → ${b.pipelines.total} (Δ${b.pipelines.total - a.pipelines.total})`);
  console.log(`   synth completed ${a.pipelines.synthesisCompletedCount} → ${b.pipelines.synthesisCompletedCount} (Δ${b.pipelines.synthesisCompletedCount - a.pipelines.synthesisCompletedCount})`);
  console.log(`   bp    completed ${a.pipelines.blueprintCompletedCount} → ${b.pipelines.blueprintCompletedCount} (Δ${b.pipelines.blueprintCompletedCount - a.pipelines.blueprintCompletedCount})`);

  // [B] previousRunOutputs 활성 증거
  console.log(`\n[B] previousRunOutputs 활성 신호`);
  const synthDelta = b.pipelines.synthesisCompletedCount - a.pipelines.synthesisCompletedCount;
  if (synthDelta <= 0) {
    console.log(`   ⚠ B 시점에서 새 synthesis 완료본이 증가하지 않음 — 재실행 전 또는 실패`);
  } else {
    console.log(`   ✓ B에 새 synthesis 완료본 ${synthDelta}개 추가`);
    if (a.pipelines.latestSynthesis && b.pipelines.latestSynthesis) {
      const aId = a.pipelines.latestSynthesis.id;
      const bId = b.pipelines.latestSynthesis.id;
      if (aId !== bId) {
        console.log(`   ✓ latestSynthesis 교체: ${aId.slice(0, 8)} → ${bId.slice(0, 8)}`);
        console.log(`     A task_results keys: ${a.pipelines.latestSynthesis.taskResultKeys.length}개`);
        console.log(`     B task_results keys: ${b.pipelines.latestSynthesis.taskResultKeys.length}개`);
        console.log(`     A storyline_generation: ${JSON.stringify(a.pipelines.latestSynthesis.storylineGenerationResult)}`);
        console.log(`     B storyline_generation: ${JSON.stringify(b.pipelines.latestSynthesis.storylineGenerationResult)}`);
      }
    }
  }

  // [C] Storyline 연속성
  console.log(`\n[C] Storyline 연속성`);
  const aTitles = new Set(a.storylines.items.map((s) => normalize(s.title)));
  const bTitles = new Set(b.storylines.items.map((s) => normalize(s.title)));
  const titleJac = jaccard(aTitles, bTitles);
  const aKeys = new Set(a.storylines.items.flatMap((s) => (s.keywords ?? []).map(normalize)));
  const bKeys = new Set(b.storylines.items.flatMap((s) => (s.keywords ?? []).map(normalize)));
  const keyJac = jaccard(aKeys, bKeys);
  console.log(`   count: ${a.storylines.count} → ${b.storylines.count}`);
  console.log(`   title Jaccard:    ${titleJac.toFixed(3)}  (A=${aTitles.size} · B=${bTitles.size} · ∩=${[...aTitles].filter((x) => bTitles.has(x)).length})`);
  console.log(`   keyword Jaccard:  ${keyJac.toFixed(3)}  (A=${aKeys.size} · B=${bKeys.size})`);
  const droppedTitles = [...aTitles].filter((t) => !bTitles.has(t));
  const newTitles = [...bTitles].filter((t) => !aTitles.has(t));
  if (droppedTitles.length) console.log(`   drop titles (A only): ${droppedTitles.slice(0, 3).map((t) => `"${t}"`).join(", ")}${droppedTitles.length > 3 ? " …" : ""}`);
  if (newTitles.length) console.log(`   new  titles (B only): ${newTitles.slice(0, 3).map((t) => `"${t}"`).join(", ")}${newTitles.length > 3 ? " …" : ""}`);

  // [C-2] Cross-run 프롬프트 주입 효과 (2026-04-18 재설계)
  // 주 지표: "A keyword 문자열이 B storyline 에 완전 포함되는 비율"
  //   - 공정한 측정: 명사구 단위 재활용 신호만 포착 (bigram 토큰 희석 제거)
  //   - 기준: ≥ 15% 통과 (Run 3→4 검증)
  // 참고 지표: bigram+word 토큰 hit ratio (이전 버전 호환, 문장 파편 시절 잔재)
  console.log(`\n[C-2] 프롬프트 주입 효과 (A summary keywords → B storyline 재등장)`);
  const aSummaryResult = a.pipelines.latestSynthesis?.activitySummaryResult as
    | { summaries?: Array<{ keywords?: string[] }> }
    | null
    | undefined;
  const aSummaryKeywords = (aSummaryResult?.summaries ?? [])
    .flatMap((s) => s.keywords ?? [])
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
  if (aSummaryKeywords.length === 0) {
    console.log(`   ⚠ A latestSynthesis.activity_summary.summaries[].keywords 비어있음 — 힌트 원천 없음`);
  } else {
    const bStorylineHay = b.storylines.items
      .map((s) => [s.title, ...(s.keywords ?? []), ...s.grade_themes.filter(Boolean)].join(" "))
      .join(" | ");
    const bHayNormalized = normalize(bStorylineHay);
    // 주 지표: keyword 문자열 단위 hit (명사구 완전 포함)
    const hitKeywords = aSummaryKeywords.filter((kw) => containsAny(bStorylineHay, [kw]));
    const keywordHitRatio = aSummaryKeywords.length > 0 ? hitKeywords.length / aSummaryKeywords.length : 0;
    // 참고 지표: bigram+word 토큰 hit
    const aTokenSet = new Set<string>();
    for (const kw of aSummaryKeywords) {
      for (const t of tokenize(kw)) aTokenSet.add(t);
    }
    const hitTokens = [...aTokenSet].filter((t) => t.length >= 2 && bHayNormalized.includes(t));
    const tokenHitRatio = aTokenSet.size > 0 ? hitTokens.length / aTokenSet.size : 0;

    console.log(`   A summary keywords (명사구 토큰): ${aSummaryKeywords.length}건`);
    console.log(`   ▶ [주지표] B storyline 에 A keyword 문자열 재등장: ${hitKeywords.length}/${aSummaryKeywords.length} (${(keywordHitRatio * 100).toFixed(1)}%)`);
    console.log(`     기준 ≥ 15.0% → ${keywordHitRatio >= 0.15 ? "✅ 통과" : "❌ 미달"}`);
    if (hitKeywords.length > 0) {
      console.log(`     예: ${hitKeywords.slice(0, 5).map((k) => `"${k.slice(0, 30)}"`).join(", ")}`);
    }
    console.log(`   (참고) bigram+word 토큰 hit: ${hitTokens.length}/${aTokenSet.size} (${(tokenHitRatio * 100).toFixed(1)}%)`);
  }

  // [D] Blueprint convergences
  console.log(`\n[D] Blueprint convergences`);
  const aConv = a.pipelines.latestBlueprint?.targetConvergences ?? [];
  const bConv = b.pipelines.latestBlueprint?.targetConvergences ?? [];
  const aThemes = new Set(aConv.map((c) => normalize(c.themeLabel ?? "")));
  const bThemes = new Set(bConv.map((c) => normalize(c.themeLabel ?? "")));
  console.log(`   count: ${aConv.length} → ${bConv.length}`);
  console.log(`   (참고) theme Jaccard(문자열 전체 집합): ${jaccard(aThemes, bThemes).toFixed(3)}`);

  // [D-2] 주지표: themeKeywords + themeLabel 토큰 overlap
  // "광시야 천문 프로젝트 수렴" ↔ "관측 데이터 해석과 광시야 천문 프로젝트" 같은 질적 연속성을
  // 단어 단위로 탐지. stopword("수렴/탐구/프로젝트/심화/기초/활동/연구/핵심")는 분모/분자 제외.
  const STOPWORDS = new Set([
    "수렴", "탐구", "프로젝트", "심화", "기초", "활동", "연구", "핵심",
    "과제", "실험", "분석", "이해", "응용",
  ]);
  function convTokens(conv: typeof aConv[number]): Set<string> {
    const labelWords = normalize(conv.themeLabel ?? "")
      .split(/[\s,·\-_/]+/)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
    const keywords = (conv.themeKeywords ?? []).map((k) => normalize(k))
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
    return new Set([...labelWords, ...keywords]);
  }
  const aKeywordSet = new Set<string>();
  const bKeywordSet = new Set<string>();
  for (const c of aConv) for (const t of convTokens(c)) aKeywordSet.add(t);
  for (const c of bConv) for (const t of convTokens(c)) bKeywordSet.add(t);
  const shared = [...aKeywordSet].filter((x) => bKeywordSet.has(x));
  const kwJaccard = jaccard(aKeywordSet, bKeywordSet);
  console.log(`   ▶ [주지표] keyword Jaccard: ${kwJaccard.toFixed(3)}  (A=${aKeywordSet.size} · B=${bKeywordSet.size} · ∩=${shared.length})`);
  console.log(`     기준 ≥ 0.3 → ${kwJaccard >= 0.3 ? "✅ 통과 (연속성 유지)" : "❌ 미달 (LLM 변동 또는 cross-run 미배선)"}`);
  if (shared.length > 0) {
    console.log(`     공통 키워드: ${shared.slice(0, 10).join(", ")}`);
  }
  console.log(`   A:`);
  for (const c of aConv.slice(0, 6)) {
    const kw = c.themeKeywords?.length ? ` | ${c.themeKeywords.slice(0, 4).join(",")}` : "";
    console.log(`     · G${c.grade}/${c.tierAlignment} "${c.themeLabel}"${kw}`);
  }
  console.log(`   B:`);
  for (const c of bConv.slice(0, 6)) {
    const kw = c.themeKeywords?.length ? ` | ${c.themeKeywords.slice(0, 4).join(",")}` : "";
    console.log(`     · G${c.grade}/${c.tierAlignment} "${c.themeLabel}"${kw}`);
  }

  // [E] 그래프 계층
  console.log(`\n[E] 그래프 계층`);
  console.log(`   hyperedges ${a.hyperedges.count} → ${b.hyperedges.count}  (A=${JSON.stringify(a.hyperedges.byContext)} · B=${JSON.stringify(b.hyperedges.byContext)})`);
  console.log(`   edges      ${a.edges.count} → ${b.edges.count}          (A=${JSON.stringify(a.edges.byContext)} · B=${JSON.stringify(b.edges.byContext)})`);
  console.log(`   narrative_arc ${a.narrativeArcs.count} → ${b.narrativeArcs.count}`);

  // [F] 기타 산출물
  console.log(`\n[F] 기타 산출물`);
  console.log(`   diagnosis  ${a.diagnosis.count} → ${b.diagnosis.count}  ${JSON.stringify(a.diagnosis.byScope)} → ${JSON.stringify(b.diagnosis.byScope)}`);
  console.log(`   strategies ${a.strategies.count} → ${b.strategies.count}  ${JSON.stringify(a.strategies.byScope)} → ${JSON.stringify(b.strategies.byScope)}`);
  console.log(`   roadmap    ${a.roadmap.count} → ${b.roadmap.count}`);
  console.log(`   activity_summaries ${a.activitySummaries.count} → ${b.activitySummaries.count}`);
  console.log(`   haengteuk_guide_links ${a.haengteukGuideLinks.count} → ${b.haengteukGuideLinks.count}\n`);

  // 요약 라인
  const persistent = aTitles.size > 0 ? [...aTitles].filter((x) => bTitles.has(x)).length / aTitles.size : 0;
  console.log(`▶ 요약`);
  console.log(`   storyline 지속성(title A∩B / A):  ${(persistent * 100).toFixed(1)}%`);
  console.log(`   blueprint keyword Jaccard:       ${kwJaccard.toFixed(3)}  (공통 ${shared.length}개)`);
  console.log(`   (참고) blueprint theme Jaccard:  ${jaccard(aThemes, bThemes).toFixed(3)}  (문자열 전체 집합 — 유사 테마도 불일치로 판정하는 한계 있음)`);
  console.log(`   (해석: 지속성 높음 = 연속성 유지 / 낮음 = 운 혹은 LLM 변동성, 둘 다 값을 갖는지 먼저 확인)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
