"use client";

import { TrendingUp, Sparkles } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import type { ExecutiveSummary } from "@/lib/domains/record-analysis/eval/executive-summary";

interface SnapshotEntry {
  id: string;
  pipelineId: string;
  createdAt: string;
  executiveSummary: ExecutiveSummary | null;
}

interface Props {
  /** 가장 최근 분석 결과 */
  current: ExecutiveSummary;
  /** 과거 재실행 스냅샷 (최신순) — 없으면 단일 시점 fallback */
  history: SnapshotEntry[];
  /** 목표 점수 (기본 85) */
  targetScore?: number;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  A: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  B: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  C: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  D: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const TREND_LABELS: Record<string, { label: string; tone: "positive" | "neutral" | "caution" }> = {
  rising: { label: "성장 중", tone: "positive" },
  stable: { label: "안정", tone: "neutral" },
  mixed: { label: "혼재", tone: "neutral" },
  falling: { label: "주의", tone: "caution" },
};

/**
 * Phase 1.3 — 마스터 패턴 첫 적용 섹션.
 *
 * 종합 역량 점수의 시점별 변화를 표시. 두 가지 상태를 지원:
 * - **다중 시점** (history.length > 0): 시계열 차트 + 추이 delta + AI 해석
 * - **단일 시점** (history.length === 0): 진척 막대 + "재진단 유도" CTA
 *
 * 데이터 소스: `_executiveSummary` (현재) + `pipeline_snapshots` (과거).
 */
export function DiagnosisTimelineSection({ current, history, targetScore = 85 }: Props) {
  // executiveSummary가 있는 스냅샷만 사용 (F0-1 이전 실행은 제외)
  const validHistory = history
    .filter((h): h is SnapshotEntry & { executiveSummary: ExecutiveSummary } => h.executiveSummary !== null)
    .reverse(); // 오래된 순으로 정렬 (차트 표시용)

  const hasHistory = validHistory.length > 0;
  const timelinePoints = [
    ...validHistory.map((h) => ({
      date: h.createdAt,
      score: h.executiveSummary.overallScore,
      grade: h.executiveSummary.overallGrade,
    })),
    {
      date: "current",
      score: current.overallScore,
      grade: current.overallGrade,
    },
  ];

  // 추이 delta: 바로 직전 스냅샷 대비
  const delta = hasHistory
    ? current.overallScore - validHistory[validHistory.length - 1].executiveSummary.overallScore
    : null;

  const targetGap = current.overallScore - targetScore;
  const trendKey = current.growthTrend ?? "stable";
  const trendBadge = TREND_LABELS[trendKey] ?? TREND_LABELS.stable;
  const headerBadge = hasHistory ? trendBadge : { label: "첫 분석", tone: "neutral" as const };

  return (
    <div>
      <ReportSectionHeader
        icon={TrendingUp}
        title="종합 역량 추이"
        subtitle={hasHistory ? `${validHistory.length + 1}개 시점 비교` : "첫 분석 결과"}
      />

      {/* ① 헤더 라벨 (마스터 패턴 ①) */}
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">종합 역량 점수</h3>
        <BadgeLabel label={headerBadge.label} tone={headerBadge.tone} />
      </div>

      {/* ② 핵심 지표 3종 카드 (마스터 패턴 ②) */}
      <MetricTripleCard
        currentScore={current.overallScore}
        currentGrade={current.overallGrade}
        delta={delta}
        targetScore={targetScore}
        targetGap={targetGap}
      />

      {/* ③ 시각화 (마스터 패턴 ③) */}
      <div className="mt-4">
        {hasHistory ? (
          <TimelineChart points={timelinePoints} targetScore={targetScore} />
        ) : (
          <ProgressBar currentScore={current.overallScore} targetScore={targetScore} />
        )}
      </div>

      {/* ④ 근거 활동 — 강점/약점 역량 리스트 (마스터 패턴 ④) */}
      {(current.topStrengths.length > 0 || current.topWeaknesses.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.topStrengths.length > 0 && (
            <EvidenceList
              title="강점 역량"
              tone="positive"
              items={current.topStrengths.map((s) => ({
                label: s.competencyName,
                value: `${s.score}점`,
              }))}
            />
          )}
          {current.topWeaknesses.length > 0 && (
            <EvidenceList
              title="보완 역량"
              tone="caution"
              items={current.topWeaknesses.map((s) => ({
                label: s.competencyName,
                value: `${s.score}점`,
              }))}
            />
          )}
        </div>
      )}

      {/* ⑤ AI 코멘트 (마스터 패턴 ⑤) */}
      <AiCommentBox
        hasHistory={hasHistory}
        delta={delta}
        interpretation={current.sections.growthTrend ?? current.sections.opinion ?? null}
        nextAction={buildNextActionText(hasHistory, delta, targetGap)}
      />
    </div>
  );
}

// ─── 마스터 패턴 하위 컴포넌트 ───────────────────────

interface BadgeLabelProps {
  label: string;
  tone: "positive" | "neutral" | "caution";
}

function BadgeLabel({ label, tone }: BadgeLabelProps) {
  const classes: Record<BadgeLabelProps["tone"], string> = {
    positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    neutral: "bg-bg-secondary text-text-primary border-border",
    caution: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", classes[tone])}>
      {label}
    </span>
  );
}

interface MetricTripleCardProps {
  currentScore: number;
  currentGrade: string;
  delta: number | null;
  targetScore: number;
  targetGap: number;
}

function MetricTripleCard({ currentScore, currentGrade, delta, targetScore, targetGap }: MetricTripleCardProps) {
  const gradeColor = GRADE_COLORS[currentGrade] ?? GRADE_COLORS.C;

  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-white p-4">
      {/* 현재 */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-text-tertiary">현재</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-text-primary">{currentScore}</span>
          <span className="text-xs text-text-tertiary">점</span>
        </div>
        <span className={cn("inline-block w-fit rounded px-1.5 py-0.5 text-3xs font-bold", gradeColor.bg, gradeColor.text)}>
          {currentGrade}등급
        </span>
      </div>

      {/* 추이 */}
      <div className="flex flex-col gap-1 border-l border-border pl-3">
        <p className="text-xs text-text-tertiary">추이</p>
        {delta === null ? (
          <>
            <div className="text-2xl font-bold text-text-tertiary">—</div>
            <p className="text-3xs text-text-tertiary">비교 대상 없음</p>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-2xl font-bold",
                  delta > 0 && "text-emerald-600",
                  delta < 0 && "text-red-600",
                  delta === 0 && "text-text-secondary",
                )}
              >
                {delta > 0 && "+"}
                {delta}
              </span>
              <span className="text-xs text-text-tertiary">점</span>
            </div>
            <p className="text-3xs text-text-tertiary">이전 분석 대비</p>
          </>
        )}
      </div>

      {/* 목표갭 */}
      <div className="flex flex-col gap-1 border-l border-border pl-3">
        <p className="text-xs text-text-tertiary">목표갭</p>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-2xl font-bold",
              targetGap >= 0 ? "text-emerald-600" : "text-amber-600",
            )}
          >
            {targetGap >= 0 ? "+" : ""}
            {targetGap}
          </span>
          <span className="text-xs text-text-tertiary">점</span>
        </div>
        <p className="text-3xs text-text-tertiary">목표 {targetScore}점</p>
      </div>
    </div>
  );
}

interface ProgressBarProps {
  currentScore: number;
  targetScore: number;
}

function ProgressBar({ currentScore, targetScore }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, currentScore));
  const targetPct = Math.min(100, Math.max(0, targetScore));

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-2 flex justify-between text-xs text-text-tertiary">
        <span>0</span>
        <span className="font-medium">현재 {currentScore}점</span>
        <span className="font-medium text-indigo-600">목표 {targetScore}점</span>
        <span>100</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-bg-tertiary">
        <div
          className="absolute inset-y-0 left-0 bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-indigo-700"
          style={{ left: `${targetPct}%` }}
          title="목표 지점"
        />
      </div>
    </div>
  );
}

interface TimelineChartProps {
  points: Array<{ date: string; score: number; grade: string }>;
  targetScore: number;
}

function TimelineChart({ points, targetScore }: TimelineChartProps) {
  // SVG 기반 간단 라인 차트 (recharts 의존 회피, 프린트 친화적)
  const width = 600;
  const height = 160;
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxScore = 100;
  const minScore = 0;
  const scoreRange = maxScore - minScore;

  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const getY = (score: number) =>
    padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;

  const pointCoords = points.map((p, i) => ({
    x: padding.left + i * xStep,
    y: getY(p.score),
    score: p.score,
    grade: p.grade,
    date: p.date,
  }));

  const pathD = pointCoords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const targetY = getY(targetScore);

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="역량 점수 시계열">
        {/* 목표선 */}
        <line
          x1={padding.left}
          y1={targetY}
          x2={width - padding.right}
          y2={targetY}
          stroke="#6366f1"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <text
          x={width - padding.right}
          y={targetY - 4}
          textAnchor="end"
          className="fill-indigo-600"
          fontSize="10"
        >
          목표 {targetScore}
        </text>

        {/* Y축 레이블 (0, 50, 100) */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={padding.left - 4}
              y1={getY(v)}
              x2={padding.left}
              y2={getY(v)}
              stroke="#d1d5db"
            />
            <text
              x={padding.left - 8}
              y={getY(v) + 3}
              textAnchor="end"
              className="fill-gray-500"
              fontSize="10"
            >
              {v}
            </text>
          </g>
        ))}

        {/* 라인 */}
        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2" />

        {/* 포인트 */}
        {pointCoords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" />
            <text
              x={c.x}
              y={c.y - 10}
              textAnchor="middle"
              className="fill-gray-700"
              fontSize="10"
              fontWeight="600"
            >
              {c.score}
            </text>
            <text
              x={c.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-gray-500"
              fontSize="9"
            >
              {formatDateShort(c.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

interface EvidenceListProps {
  title: string;
  tone: "positive" | "caution";
  items: Array<{ label: string; value: string }>;
}

function EvidenceList({ title, tone, items }: EvidenceListProps) {
  const classes: Record<EvidenceListProps["tone"], { border: string; bg: string; title: string; item: string }> = {
    positive: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/50",
      title: "text-emerald-700",
      item: "text-emerald-600",
    },
    caution: {
      border: "border-amber-200",
      bg: "bg-amber-50/50",
      title: "text-amber-700",
      item: "text-amber-600",
    },
  };
  const c = classes[tone];
  return (
    <div className={cn("rounded-lg border p-3", c.border, c.bg)}>
      <p className={cn("text-xs font-semibold", c.title)}>{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {items.map((item, idx) => (
          <li key={idx} className={cn("flex items-center justify-between text-xs", c.item)}>
            <span>{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AiCommentBoxProps {
  hasHistory: boolean;
  delta: number | null;
  interpretation: string | null;
  nextAction: string;
}

function AiCommentBox({ hasHistory, delta, interpretation, nextAction }: AiCommentBoxProps) {
  return (
    <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <p className="text-xs font-semibold text-indigo-700">AI 코멘트</p>
      </div>
      {hasHistory && delta !== null && (
        <p className="text-sm leading-relaxed text-text-primary">
          {interpretation ??
            `지난 분석 대비 ${delta > 0 ? "+" : ""}${delta}점의 변화가 있었습니다.`}
        </p>
      )}
      {!hasHistory && (
        <p className="text-sm leading-relaxed text-text-primary">
          첫 분석 결과입니다. 변화 추이를 확인하려면 재분석이 필요합니다.
          {interpretation && <span className="mt-2 block text-text-secondary">{interpretation}</span>}
        </p>
      )}
      <p className="mt-2 text-sm font-medium leading-relaxed text-indigo-700">
        다음 단계: {nextAction}
      </p>
    </div>
  );
}

// ─── 헬퍼 ───────────────────────

function formatDateShort(iso: string): string {
  if (iso === "current") return "오늘";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return "—";
  }
}

function buildNextActionText(hasHistory: boolean, delta: number | null, targetGap: number): string {
  if (!hasHistory) {
    return "1~2개월 후 재분석을 실행하면 변화 추이가 자동으로 표시됩니다.";
  }
  if (delta === null) {
    return "추이 계산 불가 — 컨설턴트 검토 필요.";
  }
  if (delta > 0 && targetGap >= 0) {
    return "목표 달성. 현재 수준을 유지하며 다음 학기 방향을 설계하세요.";
  }
  if (delta > 0 && targetGap < 0) {
    return `목표까지 ${Math.abs(targetGap)}점 부족. 현재 상승세를 이어가면 도달 가능합니다.`;
  }
  if (delta === 0) {
    return "정체 상태. 약점 역량에 집중해 다음 사이클에서 돌파구를 만드세요.";
  }
  return "점수 하락. 컨설턴트와 원인 분석 후 보완 전략을 재수립하세요.";
}
