#!/usr/bin/env npx tsx
/**
 * Cross-run 소비자 개별 효과 측정 (04-18 C 후보 C).
 *
 * Run A 파이프라인과 Run B 파이프라인의 task_results 를 직접 비교해,
 * writesForNextRun 계약상 개별 consumer 가 prev run 출력을 실제 반영했는지 측정.
 *
 * 사용:
 *   npx tsx scripts/cross-run-consumer-diff.ts --student=kim \
 *     --run-a=<Run A synthesis pipeline_id> \
 *     --run-b=<Run B synthesis pipeline_id>
 *
 * 측정 섹션:
 *   [G] haengteuk_linking → guide_matching (priorHighLinkAssignmentIds carry-over)
 *   [H] course_recommendation → ai_diagnosis (diagnosis 텍스트 내 과목 멘션)
 *   [I] interview_generation → activity_summary (질문 토픽 → summary keyword overlap)
 *   [J] gap_tracking → ai_strategy (미해결 bridge theme → 전략 텍스트 멘션)
 *
 * 지표 기준:
 *   - recall(A∩B/A) ≥ 0.4 권장 (A 축 유지)
 *   - overlap ≥ 0.15 (C-2 와 동일 기준)
 *
 * Note: [H]/[J] 는 현재 DB 상태(B 실행 후) 를 읽어 텍스트 멘션을 측정하므로,
 *       A 이후 B 가 같은 학생에 대해 바로 실행된 경우에만 유효하다.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENTS = {
  kim: { id: "0e3e149d-4b9c-402d-ad5c-b3df04190889", tenant: "84b71a5d-5681-4da3-88d2-91e75ef89015", label: "김세린" },
  injego: { id: "35ee94b6-9484-4bee-8100-c761c1c56831", tenant: "84b71a5d-5681-4da3-88d2-91e75ef89015", label: "인제고 1학년" },
} as const;

type StudentKey = keyof typeof STUDENTS;

function parseArg(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split("=", 2)[1] : undefined;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(haystack: string, needles: string[]): string[] {
  const h = normalize(haystack);
  return needles.filter((n) => n.length >= 2 && h.includes(normalize(n)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

type TaskResults = Record<string, unknown>;

async function main() {
  const studentKey = parseArg("--student") as StudentKey | undefined;
  const runAId = parseArg("--run-a");
  const runBId = parseArg("--run-b");
  if (!studentKey || !STUDENTS[studentKey] || !runAId || !runBId) {
    console.error(`사용: --student=${Object.keys(STUDENTS).join("|")} --run-a=<pipelineId> --run-b=<pipelineId>`);
    process.exit(1);
  }
  const student = STUDENTS[studentKey];
  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error("admin client unavailable");

  const [{ data: pipeA }, { data: pipeB }] = await Promise.all([
    sb.from("student_record_analysis_pipelines")
      .select("id, pipeline_type, status, completed_at, task_results")
      .eq("id", runAId).single(),
    sb.from("student_record_analysis_pipelines")
      .select("id, pipeline_type, status, completed_at, task_results")
      .eq("id", runBId).single(),
  ]);

  if (!pipeA || !pipeB) throw new Error(`파이프라인 로드 실패: A=${!!pipeA} B=${!!pipeB}`);
  if (pipeA.pipeline_type !== "synthesis" || pipeB.pipeline_type !== "synthesis") {
    throw new Error(`synthesis 파이프라인만 지원: A=${pipeA.pipeline_type} B=${pipeB.pipeline_type}`);
  }
  const tA = (pipeA.task_results ?? {}) as TaskResults;
  const tB = (pipeB.task_results ?? {}) as TaskResults;

  console.log(`\n=== Cross-run consumer diff: ${student.label} ===`);
  console.log(`  A: ${runAId.slice(0, 8)} (${pipeA.completed_at})`);
  console.log(`  B: ${runBId.slice(0, 8)} (${pipeB.completed_at})\n`);

  // ============================================
  // [G] haengteuk_linking → guide_matching
  // ============================================
  console.log(`[G] haengteuk_linking → guide_matching (assignment carry-over)`);
  const linkingA = tA.haengteuk_linking as
    | { linksGenerated?: number; assignmentLinkCounts?: Array<{ assignmentId: string; linkCount: number }> }
    | undefined;
  const matchingB = tB.guide_matching as
    | { assignedCount?: number; candidateCount?: number; priorHighLinkAssignmentIds?: string[] }
    | undefined;
  const aHighLink = (linkingA?.assignmentLinkCounts ?? []).filter((c) => c.linkCount >= 2);
  const bCarried = new Set(matchingB?.priorHighLinkAssignmentIds ?? []);
  const aHighLinkSet = new Set(aHighLink.map((c) => c.assignmentId));
  const gShared = [...aHighLinkSet].filter((x) => bCarried.has(x));
  const gRecall = aHighLinkSet.size > 0 ? gShared.length / aHighLinkSet.size : 0;
  console.log(`   A haengteuk_linking.linksGenerated = ${linkingA?.linksGenerated ?? "(missing)"} · 고링크(≥2) ${aHighLinkSet.size}건`);
  console.log(`   B guide_matching.priorHighLinkAssignmentIds = ${bCarried.size}건 carried`);
  console.log(`   ▶ recall(B∩A/A) = ${gRecall.toFixed(3)} (공통 ${gShared.length}/${aHighLinkSet.size})`);
  if (aHighLinkSet.size === 0) {
    console.log(`     ⓘ A 고링크 0건 — 측정 대상 없음 (skip 판정)`);
  } else {
    console.log(`     기준 ≥ 0.4 → ${gRecall >= 0.4 ? "✅ 통과 (소비자 정상 작동)" : "❌ 미달 (소비 누락)"}`);
  }

  // ============================================
  // [H] course_recommendation → ai_diagnosis
  // 주지표: consumer 자기보고 priorCourseRecCount (writer 가 낸 건수를 소비자가 받았는가)
  // 참고지표: diagnosis 텍스트 내 과목명 멘션율 (어휘 overlap — 한계 있음)
  // ============================================
  console.log(`\n[H] course_recommendation → ai_diagnosis`);
  const courseA = tA.course_recommendation as
    | { totalCount?: number; recommendations?: Array<{ subjectName: string; grade: number; semester: number | null; priority: string | null }> }
    | undefined;
  const diagB = tB.ai_diagnosis as
    | { priorCourseRecCount?: number; priorCourseSectionChars?: number }
    | undefined;
  const aCourseCount = courseA?.totalCount ?? (courseA?.recommendations?.length ?? 0);
  const bReceivedCount = diagB?.priorCourseRecCount ?? 0;
  const bSectionChars = diagB?.priorCourseSectionChars ?? 0;
  console.log(`   A course_recommendation.totalCount = ${aCourseCount}`);
  console.log(`   B ai_diagnosis.priorCourseRecCount = ${bReceivedCount} · priorCourseSectionChars = ${bSectionChars}`);
  const hReceiveRatio = aCourseCount > 0 ? bReceivedCount / aCourseCount : 0;
  if (aCourseCount === 0) {
    console.log(`   ⓘ A 추천 과목 0건 — 측정 대상 없음 (skip)`);
  } else if (bReceivedCount === undefined) {
    console.log(`   ⚠ B 가 priorCourseRecCount 자기보고 필드 미설정 — consumer diff 이전 버전 task_result`);
  } else {
    console.log(`   ▶ [주지표] 소비자 수신율 = ${bReceivedCount}/${aCourseCount} (${(hReceiveRatio * 100).toFixed(1)}%)`);
    console.log(`     기준 = 100% → ${hReceiveRatio === 1 ? "✅ 통과 (전량 수신)" : hReceiveRatio > 0 ? "⚠ 부분 수신" : "❌ 소비 누락"}`);
    console.log(`     priorCourseSectionChars=${bSectionChars} (>0 이면 프롬프트에 실제 주입)`);

    // 참고: 텍스트 멘션율 (어휘 overlap)
    const aSubjects = (courseA?.recommendations ?? []).map((r) => r.subjectName).filter((s) => s && s.length >= 2);
    const aUniqSubjects = [...new Set(aSubjects)];
    const { data: diag } = await sb
      .from("student_record_diagnosis")
      .select("strengths, weaknesses, strategy_notes, direction_reasoning, improvements")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant)
      .eq("source", "ai")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (diag && aUniqSubjects.length > 0) {
      const buckets: string[] = [];
      if (Array.isArray(diag.strengths)) buckets.push(...(diag.strengths as string[]));
      if (Array.isArray(diag.weaknesses)) buckets.push(...(diag.weaknesses as string[]));
      if (diag.strategy_notes) buckets.push(String(diag.strategy_notes));
      if (diag.direction_reasoning) buckets.push(String(diag.direction_reasoning));
      if (Array.isArray(diag.improvements)) {
        for (const imp of diag.improvements as unknown[]) {
          if (typeof imp === "string") buckets.push(imp);
          else if (imp && typeof imp === "object") buckets.push(JSON.stringify(imp));
        }
      }
      const haystack = buckets.join(" | ");
      const mentioned = [...new Set(containsAny(haystack, aUniqSubjects))];
      console.log(`   (참고) 텍스트 멘션율 = ${mentioned.length}/${aUniqSubjects.length} (${((mentioned.length / aUniqSubjects.length) * 100).toFixed(1)}%) — 과목명 필수 멘션 아님`);
    }
  }

  // ============================================
  // [I] interview_generation → activity_summary
  // 주지표: consumer 자기보고 priorInterviewCount
  // 참고지표: summary keyword 내 질문 토큰 overlap
  // ============================================
  console.log(`\n[I] interview_generation → activity_summary`);
  const interviewA = tA.interview_generation as
    | { totalCount?: number; topQuestions?: Array<{ question: string; questionType: string; difficulty: string }> }
    | undefined;
  const summaryB = tB.activity_summary as
    | { summaryCount?: number; summaries?: Array<{ title: string; keywords?: string[] }>; priorInterviewCount?: number; priorInterviewSectionChars?: number }
    | undefined;
  const aTopQs = (interviewA?.topQuestions ?? []).length;
  const bReceivedQs = summaryB?.priorInterviewCount ?? 0;
  const bInterviewChars = summaryB?.priorInterviewSectionChars ?? 0;
  console.log(`   A interview_generation.topQuestions = ${aTopQs}건 (총 ${interviewA?.totalCount ?? 0})`);
  console.log(`   B activity_summary.priorInterviewCount = ${bReceivedQs} · priorInterviewSectionChars = ${bInterviewChars}`);
  const iReceiveRatio = aTopQs > 0 ? bReceivedQs / aTopQs : 0;
  if (aTopQs === 0) {
    console.log(`   ⓘ A topQuestions 0건 — skip`);
  } else {
    console.log(`   ▶ [주지표] 소비자 수신율 = ${bReceivedQs}/${aTopQs} (${(iReceiveRatio * 100).toFixed(1)}%)`);
    console.log(`     기준 = 100% → ${iReceiveRatio === 1 ? "✅ 통과 (전량 수신)" : iReceiveRatio > 0 ? "⚠ 부분 수신" : "❌ 소비 누락"}`);
    console.log(`     priorInterviewSectionChars=${bInterviewChars} (>0 이면 프롬프트에 실제 주입)`);

    // 참고: 토큰 overlap (어휘)
    const aQuestions = interviewA?.topQuestions ?? [];
    const bSummaries = summaryB?.summaries ?? [];
    const bKeywords = bSummaries.flatMap((s) => (s.keywords ?? []).concat(s.title ? [s.title] : []));
    if (aQuestions.length > 0 && bKeywords.length > 0) {
      const STOPWORDS = new Set(["학생", "활동", "탐구", "수업", "과정", "경험", "어떤", "어떻게", "무엇", "설명", "생각", "이유", "근거", "방법", "사례", "부분", "내용", "진행", "참여"]);
      const aTokens = new Set<string>();
      for (const q of aQuestions) {
        const words = normalize(q.question).replace(/[^가-힣a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
        for (const w of words) aTokens.add(w);
      }
      const bHaystack = normalize(bKeywords.join(" "));
      const hit = [...aTokens].filter((t) => bHaystack.includes(t));
      console.log(`   (참고) 토큰 overlap = ${hit.length}/${aTokens.size} (${((hit.length / aTokens.size) * 100).toFixed(1)}%) — 질문 어휘와 keyword 명사구 공간 다름`);
    }
  }

  // ============================================
  // [J] gap_tracking → ai_strategy
  // 주지표: consumer 자기보고 priorGapBridgeCount
  // 참고지표: strategy 텍스트 내 theme 멘션율
  // ============================================
  console.log(`\n[J] gap_tracking → ai_strategy`);
  const gapA = tA.gap_tracking as
    | { bridgeCount?: number; topBridges?: Array<{ themeLabel: string; urgency: string; targetGrade: number | null; sharedCompetencies: string[] }> }
    | undefined;
  const strategyB = tB.ai_strategy as
    | { savedCount?: number; priorGapBridgeCount?: number; priorGapSectionChars?: number }
    | undefined;
  const aTopBridges = (gapA?.topBridges ?? []).length;
  const bReceivedBridges = strategyB?.priorGapBridgeCount ?? 0;
  const bGapChars = strategyB?.priorGapSectionChars ?? 0;
  console.log(`   A gap_tracking.topBridges = ${aTopBridges}건 (총 ${gapA?.bridgeCount ?? 0})`);
  console.log(`   B ai_strategy.priorGapBridgeCount = ${bReceivedBridges} · priorGapSectionChars = ${bGapChars}`);
  const jReceiveRatio = aTopBridges > 0 ? bReceivedBridges / aTopBridges : 0;
  if (aTopBridges === 0) {
    console.log(`   ⓘ A topBridges 0건 — skip`);
  } else {
    console.log(`   ▶ [주지표] 소비자 수신율 = ${bReceivedBridges}/${aTopBridges} (${(jReceiveRatio * 100).toFixed(1)}%)`);
    console.log(`     기준 = 100% → ${jReceiveRatio === 1 ? "✅ 통과 (전량 수신)" : jReceiveRatio > 0 ? "⚠ 부분 수신" : "❌ 소비 누락"}`);
    console.log(`     priorGapSectionChars=${bGapChars} (>0 이면 프롬프트에 실제 주입)`);

    // 참고: theme 멘션율
    const aThemes = [...new Set((gapA?.topBridges ?? []).map((b) => b.themeLabel).filter((t) => t && t.length >= 2))];
    if (aThemes.length > 0) {
      const { data: strategies } = await sb
        .from("student_record_strategies")
        .select("target_area, strategy_content, reasoning")
        .eq("student_id", student.id)
        .eq("tenant_id", student.tenant)
        .eq("status", "planned");
      const buckets = (strategies ?? []).flatMap((s) => [s.target_area, s.strategy_content, s.reasoning].filter(Boolean) as string[]);
      if (buckets.length > 0) {
        const mentioned = [...new Set(containsAny(buckets.join(" | "), aThemes))];
        console.log(`   (참고) theme 멘션율 = ${mentioned.length}/${aThemes.length} (${((mentioned.length / aThemes.length) * 100).toFixed(1)}%)`);
      }
    }
  }

  // ============================================
  // Bonus: activity_summary → storyline (이미 [C-2] 로 측정됨, 참고용 재계산)
  // ============================================
  console.log(`\n[K] activity_summary → storyline_generation (이미 [C-2] 측정 — 참고용)`);
  const prevSummaryA = tA.activity_summary as
    | { summaries?: Array<{ keywords?: string[] }> }
    | undefined;
  const storylineB = tB.storyline_generation as
    | { titles?: Array<{ title: string; keywords: string[]; grade1Theme?: string | null; grade2Theme?: string | null; grade3Theme?: string | null }> }
    | undefined;
  const aSummaryKws = (prevSummaryA?.summaries ?? []).flatMap((s) => s.keywords ?? []).filter((k) => k.length >= 2);
  const aSignalKws = aSummaryKws.filter((k) => {
    const n = normalize(k);
    const NOISE = new Set(["국어", "영어", "수학", "과학", "사회", "물리", "물리학", "화학", "생물", "생명과학", "지구과학", "탐구", "활동", "실험", "프로젝트", "심화", "분석"]);
    return !NOISE.has(n);
  });
  const bStorylineText = (storylineB?.titles ?? [])
    .flatMap((t) => [t.title, ...(t.keywords ?? []), t.grade1Theme, t.grade2Theme, t.grade3Theme].filter(Boolean) as string[])
    .join(" | ");
  const kMentions = aSignalKws.filter((k) => bStorylineText.includes(k));
  const kRatio = aSignalKws.length > 0 ? kMentions.length / aSignalKws.length : 0;
  console.log(`   A activity_summary signal keywords ${aSignalKws.length}건 · B storyline text 에 재등장 ${kMentions.length}건 (${(kRatio * 100).toFixed(1)}%)`);
  if (kMentions.length > 0) console.log(`     재등장 예: ${[...new Set(kMentions)].slice(0, 5).map((k) => `"${k}"`).join(", ")}`);

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
