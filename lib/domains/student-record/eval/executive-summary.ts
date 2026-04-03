/**
 * 생기부 Executive Summary 생성기 (B3)
 *
 * A1~B1 분석 결과를 모아 한 페이지 분량의 구조화된 요약을 생성한다.
 *
 * - LLM 호출 없음 — 완전히 규칙 기반
 * - 모든 선택적 필드(A2/A3/B1 결과)는 없어도 graceful degradation
 * - 외부 라이브러리 의존 없음 — 순수 TypeScript
 *
 * 사용처: scripts/eval-student-record.ts (B3 최종 통합)
 */

import type { AggregatedVerification } from "./highlight-verifier";
import type { TimeSeriesAnalysis } from "./timeseries-analyzer";
import type { UniversityMatchAnalysis } from "./university-profile-matcher";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

/** 단일 역량의 최신 점수 스냅샷 */
export interface CompetencySnapshot {
  competencyId: string;
  competencyName: string;
  /** 0~100 정규화 점수 */
  score: number;
}

/** Executive Summary 생성을 위한 입력 */
export interface ExecutiveSummaryInput {
  studentId: string;
  studentName?: string;
  /** 최신 학년 역량 점수 목록 (최소 1개 이상) */
  competencySnapshots: CompetencySnapshot[];
  /** A2: 하이라이트 원문 검증 집계 (없으면 생략) */
  highlightVerification?: AggregatedVerification;
  /** A3: 역량 시계열 분석 (없으면 생략) */
  timeSeriesAnalysis?: TimeSeriesAnalysis;
  /** B1: 대학 프로필 매칭 분석 (없으면 생략) */
  universityMatch?: UniversityMatchAnalysis;
}

/** 역량 종합 등급 */
export type OverallGrade = "S" | "A" | "B" | "C" | "D";

/** Executive Summary 최종 결과 */
export interface ExecutiveSummary {
  studentId: string;
  studentName: string;
  /** 생성 시각 (ISO 8601) */
  generatedAt: string;

  // 1. 핵심 지표
  /** 역량 점수 평균 (0~100) */
  overallScore: number;
  /** 종합 등급: S(90+) / A(80+) / B(70+) / C(60+) / D(60 미만) */
  overallGrade: OverallGrade;
  /** 하이라이트 원문 검증 통과율 (0~100). A2 결과 없으면 undefined */
  highlightQuality?: number;
  /** 성장 추이: 'rising'|'falling'|'stable'|'volatile'. A3 결과 없으면 undefined */
  growthTrend?: string;

  // 2. 역량 프로필
  /** 강점 TOP3 (점수 내림차순) */
  topStrengths: CompetencySnapshot[];
  /** 약점 TOP3 (점수 오름차순) */
  topWeaknesses: CompetencySnapshot[];

  // 3. 성장 추이
  /** 가장 성장한 역량 이름. A3 결과 없으면 undefined */
  mostImprovedCompetency?: string;
  /** 이상 감지 건수. A3 결과 없으면 undefined */
  anomalyCount?: number;

  // 4. 대학 적합도 (상위 3개 트랙)
  topUniversityMatches?: Array<{
    label: string;
    grade: string;
    score: number;
  }>;

  // 5. 종합 의견 (규칙 기반 한 문단)
  narrative: string;

  // 섹션별 출력 텍스트 (터미널/UI 출력용)
  sections: {
    keyMetrics: string;
    competencyProfile: string;
    growthTrend: string;
    universityFit: string;
    opinion: string;
  };
}

// ─── 상수 ───────────────────────────────────────────────────────────────────

const GRADE_THRESHOLDS: Array<{ min: number; grade: OverallGrade }> = [
  { min: 90, grade: "S" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 0,  grade: "D" },
];

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function scoreToOverallGrade(score: number): OverallGrade {
  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "D";
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 성장 추이 레이블을 한국어로 변환한다.
 */
function trendToKorean(trend: string): string {
  switch (trend) {
    case "rising":   return "상승세";
    case "falling":  return "하락세";
    case "stable":   return "안정세";
    case "volatile": return "변동세";
    default:         return trend;
  }
}

/**
 * 시계열 분석 결과에서 성장 추이 문자열을 결정한다.
 * 가장 많이 등장한 trend type을 대표값으로 선택.
 */
function deriveGrowthTrend(tsAnalysis: TimeSeriesAnalysis): string {
  if (tsAnalysis.trends.length === 0) return "stable";

  const counts: Record<string, number> = {};
  for (const t of tsAnalysis.trends) {
    counts[t.trend] = (counts[t.trend] ?? 0) + 1;
  }

  // 최빈 trend 선택
  let dominant = "stable";
  let maxCount = 0;
  for (const [trend, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = trend;
    }
  }
  return dominant;
}

/**
 * 시계열 분석에서 가장 성장한 역량의 이름을 조회한다.
 */
function findMostImprovedName(tsAnalysis: TimeSeriesAnalysis): string | undefined {
  if (tsAnalysis.mostImprovedCompetency === "") return undefined;
  const found = tsAnalysis.trends.find(
    (t) => t.competencyId === tsAnalysis.mostImprovedCompetency,
  );
  return found?.competencyName;
}

// ─── 섹션 텍스트 생성 ───────────────────────────────────────────────────────

function buildKeyMetricsSection(summary: Omit<ExecutiveSummary, "sections">): string {
  const lines: string[] = [];
  lines.push("[ 1. 핵심 지표 ]");
  lines.push(`  전체 역량 평균: ${summary.overallScore}점 / 등급: ${summary.overallGrade}`);

  if (summary.highlightQuality !== undefined) {
    lines.push(`  하이라이트 품질: ${summary.highlightQuality}% (원문 검증 통과율)`);
  } else {
    lines.push("  하이라이트 품질: 측정 결과 없음");
  }

  if (summary.growthTrend !== undefined) {
    lines.push(`  성장 추이: ${trendToKorean(summary.growthTrend)}`);
  } else {
    lines.push("  성장 추이: 시계열 데이터 없음");
  }

  return lines.join("\n");
}

function buildCompetencyProfileSection(summary: Omit<ExecutiveSummary, "sections">): string {
  const lines: string[] = [];
  lines.push("[ 2. 역량 프로필 ]");

  if (summary.topStrengths.length > 0) {
    const strengthsList = summary.topStrengths
      .map((s) => `${s.competencyName}(${s.score})`)
      .join(", ");
    lines.push(`  강점 TOP${summary.topStrengths.length}: ${strengthsList}`);
  } else {
    lines.push("  강점: 데이터 없음");
  }

  if (summary.topWeaknesses.length > 0) {
    const weaknessesList = summary.topWeaknesses
      .map((s) => `${s.competencyName}(${s.score})`)
      .join(", ");
    lines.push(`  약점 TOP${summary.topWeaknesses.length}: ${weaknessesList}`);
  } else {
    lines.push("  약점: 데이터 없음");
  }

  return lines.join("\n");
}

function buildGrowthTrendSection(summary: Omit<ExecutiveSummary, "sections">): string {
  const lines: string[] = [];
  lines.push("[ 3. 성장 추이 ]");

  if (summary.mostImprovedCompetency !== undefined) {
    lines.push(`  가장 성장한 역량: ${summary.mostImprovedCompetency}`);
  } else {
    lines.push("  가장 성장한 역량: 시계열 데이터 없음");
  }

  if (summary.anomalyCount !== undefined) {
    lines.push(
      summary.anomalyCount > 0
        ? `  이상 감지: ${summary.anomalyCount}건`
        : "  이상 감지: 없음",
    );
  } else {
    lines.push("  이상 감지: 시계열 데이터 없음");
  }

  return lines.join("\n");
}

function buildUniversityFitSection(summary: Omit<ExecutiveSummary, "sections">): string {
  const lines: string[] = [];
  lines.push("[ 4. 대학 적합도 ]");

  if (summary.topUniversityMatches && summary.topUniversityMatches.length > 0) {
    summary.topUniversityMatches.forEach((m, idx) => {
      lines.push(`  ${idx + 1}위: ${m.label} (${m.grade}등급, ${m.score}점)`);
    });
  } else {
    lines.push("  대학 프로필 매칭 결과 없음");
  }

  return lines.join("\n");
}

function buildOpinionSection(narrative: string): string {
  return `[ 5. 종합 의견 ]\n  ${narrative}`;
}

// ─── narrative 규칙 기반 생성 ───────────────────────────────────────────────

/**
 * 규칙 기반 종합 의견 문단 생성.
 *
 * 패턴: [강점TOP2 역량] + [성장 추이] + [대학 1위 트랙] 조합.
 * 각 요소가 없으면 graceful degradation.
 */
function buildNarrative(input: {
  overallScore: number;
  overallGrade: OverallGrade;
  topStrengths: CompetencySnapshot[];
  growthTrend?: string;
  timeSeriesAnalysis?: TimeSeriesAnalysis;
  topUniversityMatches?: Array<{ label: string; grade: string; score: number }>;
}): string {
  const parts: string[] = [];

  // 강점 파트
  const top2 = input.topStrengths.slice(0, 2);
  if (top2.length >= 2) {
    parts.push(
      `${top2[0].competencyName}(${top2[0].score})과 ${top2[1].competencyName}(${top2[1].score})에서 강점을 보이며`,
    );
  } else if (top2.length === 1) {
    parts.push(`${top2[0].competencyName}(${top2[0].score})에서 강점을 보이며`);
  }

  // 성장 추이 파트
  if (input.growthTrend !== undefined && input.timeSeriesAnalysis) {
    const tsa = input.timeSeriesAnalysis;
    const trendLabel = trendToKorean(input.growthTrend);
    const growthRate = tsa.overallGrowthRate;
    const growthStr = growthRate > 0
      ? `+${growthRate}점/학년`
      : growthRate < 0
        ? `${growthRate}점/학년`
        : "변화 없음";
    parts.push(`${trendLabel}(${growthStr})을 기록한 학생으로,`);
  } else {
    // 시계열 없으면 등급으로 대체
    parts.push(`전체 역량 ${input.overallGrade}등급(${input.overallScore}점)을 기록한 학생으로,`);
  }

  // 대학 적합도 파트
  if (input.topUniversityMatches && input.topUniversityMatches.length > 0) {
    const top = input.topUniversityMatches[0];
    parts.push(`${top.label} 적합도가 ${top.grade}등급(${top.score}점)으로 가장 높습니다.`);
  } else {
    parts.push("종합적인 역량 향상이 기대됩니다.");
  }

  return parts.join(" ");
}

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * A1~B1 분석 결과를 종합하여 Executive Summary를 생성한다.
 *
 * 모든 선택적 입력(highlightVerification, timeSeriesAnalysis, universityMatch)은
 * 없어도 동작한다 (graceful degradation).
 *
 * @param input - ExecutiveSummaryInput
 * @returns     ExecutiveSummary
 */
export function generateExecutiveSummary(input: ExecutiveSummaryInput): ExecutiveSummary {
  const {
    studentId,
    studentName = "학생",
    competencySnapshots,
    highlightVerification,
    timeSeriesAnalysis,
    universityMatch,
  } = input;

  // 1. 전체 역량 평균
  const scores = competencySnapshots.map((s) => s.score);
  const overallScore = scores.length > 0 ? Math.round(mean(scores) * 10) / 10 : 0;
  const overallGrade = scoreToOverallGrade(overallScore);

  // 2. 하이라이트 품질 (A2)
  const highlightQuality = highlightVerification?.passRate;

  // 3. 성장 추이 (A3)
  const growthTrend = timeSeriesAnalysis ? deriveGrowthTrend(timeSeriesAnalysis) : undefined;
  const mostImprovedCompetency = timeSeriesAnalysis
    ? findMostImprovedName(timeSeriesAnalysis)
    : undefined;
  const anomalyCount = timeSeriesAnalysis ? timeSeriesAnalysis.anomalies.length : undefined;

  // 4. 역량 프로필 (강점/약점)
  const sorted = [...competencySnapshots].sort((a, b) => b.score - a.score);
  const topStrengths = sorted.slice(0, 3);
  const topWeaknesses = [...competencySnapshots].sort((a, b) => a.score - b.score).slice(0, 3);

  // 5. 대학 적합도 상위 3개 (B1)
  const topUniversityMatches = universityMatch
    ? universityMatch.matches.slice(0, 3).map((m) => ({
        label: m.label,
        grade: m.grade,
        score: round1(m.matchScore),
      }))
    : undefined;

  // 6. narrative 생성
  const narrative = buildNarrative({
    overallScore,
    overallGrade,
    topStrengths,
    growthTrend,
    timeSeriesAnalysis,
    topUniversityMatches,
  });

  const baseSummary = {
    studentId,
    studentName,
    generatedAt: new Date().toISOString(),
    overallScore,
    overallGrade,
    highlightQuality,
    growthTrend,
    topStrengths,
    topWeaknesses,
    mostImprovedCompetency,
    anomalyCount,
    topUniversityMatches,
    narrative,
  };

  // 섹션 텍스트 생성
  const sections = {
    keyMetrics: buildKeyMetricsSection(baseSummary),
    competencyProfile: buildCompetencyProfileSection(baseSummary),
    growthTrend: buildGrowthTrendSection(baseSummary),
    universityFit: buildUniversityFitSection(baseSummary),
    opinion: buildOpinionSection(narrative),
  };

  return { ...baseSummary, sections };
}

/**
 * ExecutiveSummary를 터미널 출력용 전체 텍스트로 포맷한다.
 *
 * 박스 형태로 감싼 한 페이지 분량의 리포트를 반환한다.
 *
 * @param summary - generateExecutiveSummary()의 반환값
 * @returns       터미널 출력용 문자열
 */
export function formatExecutiveSummaryText(summary: ExecutiveSummary): string {
  const WIDTH = 64;
  const border = "═".repeat(WIDTH);
  const divider = "─".repeat(WIDTH);

  const header = [
    border,
    ` 학생 역량 종합 리포트 (Executive Summary)`,
    ` 학생: ${summary.studentName}  ID: ${summary.studentId}`,
    ` 생성: ${summary.generatedAt}`,
    border,
  ].join("\n");

  const body = [
    summary.sections.keyMetrics,
    divider,
    summary.sections.competencyProfile,
    divider,
    summary.sections.growthTrend,
    divider,
    summary.sections.universityFit,
    divider,
    summary.sections.opinion,
    border,
  ].join("\n");

  return `${header}\n${body}`;
}
