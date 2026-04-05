#!/usr/bin/env npx tsx
/**
 * Flow Completion 실데이터 검증 스크립트
 *
 * DB의 student_record_content_quality 테이블에서 실제 분석 결과를 조회하고,
 * computeFlowCompletion() 휴리스틱이 기대 Tier 분포를 생성하는지 검증합니다.
 *
 * 사용법:
 *   npx tsx scripts/eval-flow-completion.ts             # 전체 실행
 *   npx tsx scripts/eval-flow-completion.ts --dry-run   # 행 수만 표시
 *   npx tsx scripts/eval-flow-completion.ts --tier=top   # top 대학 기준
 *   npx tsx scripts/eval-flow-completion.ts --json       # JSON 파일 저장
 *
 * 환경 변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (필수, .env.local에서 자동 로드)
 */

import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  computeFlowCompletion,
  computeAggregateFlowCompletion,
  type QualitySnapshot,
  type FlowCompletionResult,
  type AggregateFlowInput,
} from "../lib/domains/student-record/evaluation-criteria/flow-completion";
import type { UniversityTier } from "../lib/domains/student-record/evaluation-criteria/defaults";

// .env.local 자동 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── CLI 파싱 ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const saveJson = args.includes("--json");
const tierArg = args.find((a) => a.startsWith("--tier="))?.split("=")[1];
const universityTier: UniversityTier = (tierArg as UniversityTier) ?? "mid";

// ─── Supabase Admin Client ──────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── 진로교과 판정 ─────────────────────────────────────────────────────────

/** record_type + subject_category 기반 진로교과 판정 (근사치) */
function isCareerSubject(recordType: string, subjectCategory: string | null): boolean {
  // 창체/행특은 비교과 → 진로교과 아님
  if (recordType !== "setek") return false;
  // 진로선택/전문 교과 또는 진로 관련 키워드
  if (!subjectCategory) return false;
  const career = subjectCategory.toLowerCase();
  return career.includes("진로") || career.includes("전문") || career.includes("심화");
}

// ─── 데이터 조회 ─────────────────────────────────────────────────────────

interface ContentQualityRow {
  id: string;
  student_id: string;
  record_id: string | null;
  record_type: string | null;
  specificity: number;
  coherence: number;
  depth: number;
  grammar: number;
  scientific_validity: number | null;
  overall_score: number;
  issues: string[] | null;
  feedback: string | null;
  source: string | null;
  subject_category: string | null;
}

async function fetchContentQuality(): Promise<ContentQualityRow[]> {
  const allRows: ContentQualityRow[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("student_record_content_quality")
      .select("id, student_id, record_id, record_type, specificity, coherence, depth, grammar, scientific_validity, overall_score, issues, feedback, source, subject_category")
      .eq("source", "ai")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("DB 조회 오류:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    allRows.push(...(data as ContentQualityRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

// ─── 분석 ─────────────────────────────────────────────────────────────

interface StageStats {
  stage: number;
  label: string;
  fulfilledCount: number;
  total: number;
  rate: number;
}

interface IssueFrequency {
  code: string;
  count: number;
  rate: number;
}

interface AnalysisResult {
  totalRows: number;
  universityTier: UniversityTier;
  tierDistribution: Record<string, { count: number; percent: number }>;
  stageStats: StageStats[];
  issueFrequency: IssueFrequency[];
  percentileBreakdown: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
  };
  careerVsNonCareer: {
    career: { count: number; avgPercent: number };
    nonCareer: { count: number; avgPercent: number };
  };
  byStudent: Array<{
    studentId: string;
    recordCount: number;
    avgPercent: number;
    tier: string;
  }>;
}

function analyze(rows: ContentQualityRow[]): AnalysisResult {
  // 1. 각 행에 대해 FlowCompletion 계산
  const results: Array<{ row: ContentQualityRow; result: FlowCompletionResult }> = [];

  for (const row of rows) {
    const snapshot: QualitySnapshot = {
      specificity: row.specificity,
      coherence: row.coherence,
      depth: row.depth,
      grammar: row.grammar,
      scientific_validity: row.scientific_validity,
      overall_score: row.overall_score,
      issues: row.issues,
      feedback: row.feedback,
    };

    const career = isCareerSubject(row.record_type ?? "setek", row.subject_category);
    const result = computeFlowCompletion(snapshot, {
      isCareerSubject: career,
      universityTier,
    });

    results.push({ row, result });
  }

  // 2. Tier 분포
  const tierCounts: Record<string, number> = {};
  for (const { result } of results) {
    const label = result.tier.label;
    tierCounts[label] = (tierCounts[label] ?? 0) + 1;
  }
  const tierDistribution: Record<string, { count: number; percent: number }> = {};
  for (const [label, count] of Object.entries(tierCounts)) {
    tierDistribution[label] = {
      count,
      percent: Math.round((count / results.length) * 1000) / 10,
    };
  }

  // 3. 단계별 충족률
  const stageCounts = new Map<number, { fulfilled: number; total: number; label: string }>();
  for (const { result } of results) {
    for (const stage of result.stages) {
      const entry = stageCounts.get(stage.stage) ?? { fulfilled: 0, total: 0, label: stage.label };
      entry.total++;
      if (stage.fulfilled) entry.fulfilled++;
      stageCounts.set(stage.stage, entry);
    }
  }
  const stageStats: StageStats[] = Array.from(stageCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([stage, entry]) => ({
      stage,
      label: entry.label,
      fulfilledCount: entry.fulfilled,
      total: entry.total,
      rate: Math.round((entry.fulfilled / entry.total) * 1000) / 10,
    }));

  // 4. 이슈 코드 빈도
  const issueCounts: Record<string, number> = {};
  for (const { row } of results) {
    if (row.issues) {
      for (const issue of row.issues) {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      }
    }
  }
  const issueFrequency: IssueFrequency[] = Object.entries(issueCounts)
    .map(([code, count]) => ({ code, count, rate: Math.round((count / results.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);

  // 5. 백분위
  const percents = results.map((r) => r.result.completionPercent).sort((a, b) => a - b);
  const percentile = (p: number) => percents[Math.floor(percents.length * p / 100)] ?? 0;
  const mean = percents.length > 0
    ? Math.round((percents.reduce((s, v) => s + v, 0) / percents.length) * 10) / 10
    : 0;

  // 6. 진로/비진로 비교
  const careerResults = results.filter((r) => r.result.isCareerSubject);
  const nonCareerResults = results.filter((r) => !r.result.isCareerSubject);
  const avg = (arr: typeof results) =>
    arr.length > 0
      ? Math.round((arr.reduce((s, r) => s + r.result.completionPercent, 0) / arr.length) * 10) / 10
      : 0;

  // 7. 학생별 집계
  const byStudentMap = new Map<string, AggregateFlowInput[]>();
  for (const { row, result } of results) {
    const list = byStudentMap.get(row.student_id) ?? [];
    list.push({
      qualityData: {
        specificity: row.specificity,
        coherence: row.coherence,
        depth: row.depth,
        grammar: row.grammar,
        scientific_validity: row.scientific_validity,
        overall_score: row.overall_score,
        issues: row.issues,
        feedback: row.feedback,
      },
      isCareerSubject: result.isCareerSubject,
    });
    byStudentMap.set(row.student_id, list);
  }

  const byStudent = Array.from(byStudentMap.entries())
    .map(([studentId, records]) => {
      const agg = computeAggregateFlowCompletion(records, universityTier);
      return {
        studentId,
        recordCount: records.length,
        avgPercent: agg.avgPercent,
        tier: agg.tier.label,
      };
    })
    .sort((a, b) => b.avgPercent - a.avgPercent);

  return {
    totalRows: results.length,
    universityTier,
    tierDistribution,
    stageStats,
    issueFrequency,
    percentileBreakdown: {
      p10: percentile(10),
      p25: percentile(25),
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      mean,
    },
    careerVsNonCareer: {
      career: { count: careerResults.length, avgPercent: avg(careerResults) },
      nonCareer: { count: nonCareerResults.length, avgPercent: avg(nonCareerResults) },
    },
    byStudent,
  };
}

// ─── 출력 ─────────────────────────────────────────────────────────────

function printReport(result: AnalysisResult): void {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Flow Completion 실데이터 검증 보고서            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  console.log(`총 content_quality 행 (source=ai): ${result.totalRows}건`);
  console.log(`대학 수준 기준: ${result.universityTier}\n`);

  // Tier 분포
  console.log("── Tier 분포 ──────────────────────────────────");
  const tierOrder = ["학종_서류100_가능", "학종_가능_점검필요", "학종_어려움", "교과전형_추천"];
  for (const label of tierOrder) {
    const entry = result.tierDistribution[label] ?? { count: 0, percent: 0 };
    const bar = "█".repeat(Math.round(entry.percent / 2));
    console.log(`  ${label.padEnd(20)} ${String(entry.count).padStart(5)}건 (${String(entry.percent).padStart(5)}%) ${bar}`);
  }

  // 백분위
  console.log("\n── 충족도(%) 분포 ─────────────────────────────");
  const p = result.percentileBreakdown;
  console.log(`  평균: ${p.mean}%  |  P10: ${p.p10}%  P25: ${p.p25}%  P50(중앙값): ${p.p50}%  P75: ${p.p75}%  P90: ${p.p90}%`);

  // 단계별 충족률
  console.log("\n── 8단계별 충족률 ─────────────────────────────");
  for (const s of result.stageStats) {
    const bar = "█".repeat(Math.round(s.rate / 2));
    console.log(`  ⓘ ${String(s.stage).padStart(1)}. ${s.label.padEnd(24)} ${String(s.rate).padStart(5)}% (${s.fulfilledCount}/${s.total}) ${bar}`);
  }

  // 진로/비진로 비교
  console.log("\n── 진로교과 vs 비진로교과 ──────────────────────");
  console.log(`  진로교과:   ${result.careerVsNonCareer.career.count}건, 평균 ${result.careerVsNonCareer.career.avgPercent}%`);
  console.log(`  비진로교과: ${result.careerVsNonCareer.nonCareer.count}건, 평균 ${result.careerVsNonCareer.nonCareer.avgPercent}%`);

  // 이슈 빈도 (Top 10)
  console.log("\n── 이슈 코드 빈도 (Top 10) ────────────────────");
  for (const issue of result.issueFrequency.slice(0, 10)) {
    console.log(`  ${issue.code.padEnd(25)} ${String(issue.count).padStart(4)}건 (${String(issue.rate).padStart(5)}%)`);
  }

  // 학생별 요약 (Top/Bottom 5)
  if (result.byStudent.length > 0) {
    console.log("\n── 학생별 평균 충족도 (상위 5) ─────────────────");
    for (const s of result.byStudent.slice(0, 5)) {
      console.log(`  ${s.studentId.slice(0, 8)}… ${String(s.recordCount).padStart(3)}건 → ${s.avgPercent}% (${s.tier})`);
    }
    console.log("\n── 학생별 평균 충족도 (하위 5) ─────────────────");
    for (const s of result.byStudent.slice(-5).reverse()) {
      console.log(`  ${s.studentId.slice(0, 8)}… ${String(s.recordCount).padStart(3)}건 → ${s.avgPercent}% (${s.tier})`);
    }
  }

  console.log("\n✅ 검증 완료\n");
}

// ─── 메인 ─────────────────────────────────────────────────────────────

async function main() {
  console.log("📊 Flow Completion 실데이터 검증 시작…");
  console.log(`   대학 수준: ${universityTier}`);

  const rows = await fetchContentQuality();
  console.log(`   DB 조회 완료: ${rows.length}건\n`);

  if (isDryRun) {
    console.log("--dry-run: 행 수만 표시하고 종료합니다.");
    return;
  }

  if (rows.length === 0) {
    console.log("⚠️ content_quality 데이터가 없습니다. 파이프라인을 먼저 실행하세요.");
    return;
  }

  const result = analyze(rows);
  printReport(result);

  if (saveJson) {
    const outPath = path.resolve(process.cwd(), "eval-flow-completion-result.json");
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`📁 JSON 저장: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("실행 오류:", err);
  process.exit(1);
});
