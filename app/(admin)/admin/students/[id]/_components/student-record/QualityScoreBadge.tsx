"use client";

// ============================================
// 콘텐츠 품질 점수 배지 + 요약 카드
// Phase 1-3 역량 분석 결과 content_quality 데이터 표시
// ============================================

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

export type QualityScoreEntry = {
  record_type: string;
  record_id: string;
  overall_score: number;
  issues: string[];
  feedback: string | null;
};

// ─── 등급 계산 ────────────────────────────────

type QualityGrade = "A" | "B" | "C" | "D";

function getQualityGrade(score: number): QualityGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

const GRADE_STYLES: Record<QualityGrade, { badge: string; text: string }> = {
  A: {
    badge: "bg-[var(--color-success-50,#f0fdf4)] border-[var(--color-success-200,#bbf7d0)] text-[var(--color-success-700,#15803d)]",
    text: "A",
  },
  B: {
    badge: "bg-[var(--color-info-50,#eff6ff)] border-[var(--color-info-200,#bfdbfe)] text-[var(--color-info-700,#1d4ed8)]",
    text: "B",
  },
  C: {
    badge: "bg-[var(--color-warning-50,#fffbeb)] border-[var(--color-warning-200,#fde68a)] text-[var(--color-warning-700,#b45309)]",
    text: "C",
  },
  D: {
    badge: "bg-[var(--color-error-50,#fef2f2)] border-[var(--color-error-200,#fecaca)] text-[var(--color-error-700,#b91c1c)]",
    text: "D",
  },
};

// ─── 이슈 코드 → 한글 레이블 ─────────────────

function formatIssueLabel(issue: string): string {
  const map: Record<string, string> = {
    P1_나열식: "P1 나열식",
    P2_복붙: "P2 복붙",
    P3_키워드만: "P3 키워드만",
    P4_내신탐구불일치: "P4 내신↔탐구 불일치",
    P5_내용오류포장: "P5 내용 오류 포장",
    F1_별개활동포장: "F1 별개 활동 포장",
    F2_인과단절: "F2 인과 단절",
    F3_출처불일치: "F3 출처 불일치",
    F4_전제불일치: "F4 전제 불일치",
    F5_비교군오류: "F5 비교군 오류",
    F6_자명한결론: "F6 자명한 결론",
    F10_성장부재: "F10 성장 부재",
    F12_자기주도성부재: "F12 자기주도성 부재",
    F16_진로과잉도배: "F16 진로 과잉 도배",
    M1_교사관찰불가: "M1 교사 관찰 불가",
    진로교과_탐구부족: "진로교과 탐구 부족",
  };
  return map[issue] ?? issue;
}

// ─── 레코드별 품질 배지 ────────────────────────

type QualityBadgeProps = {
  entry: QualityScoreEntry;
};

export function QualityScoreBadge({ entry }: QualityBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const grade = getQualityGrade(entry.overall_score);
  const styles = GRADE_STYLES[grade];
  const hasIssues = entry.issues.length > 0;
  const hasFeedback = !!entry.feedback;

  if (!hasIssues && !hasFeedback) {
    // 이슈도 없고 피드백도 없으면 배지만 표시
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
          styles.badge,
        )}
        title={`품질 점수: ${entry.overall_score}점`}
      >
        {styles.text} {entry.overall_score}점
      </span>
    );
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80",
          styles.badge,
        )}
        title="품질 이슈 보기"
      >
        {styles.text} {entry.overall_score}점
        {hasIssues && (
          <span className="ml-0.5 inline-flex items-center gap-0.5">
            <AlertTriangle size={9} />
            {entry.issues.length}
          </span>
        )}
        {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
      </button>

      {expanded && (
        <div
          className="mt-1.5 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] p-2.5 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {hasIssues && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">
                품질 이슈 ({entry.issues.length}건)
              </p>
              <ul className="flex flex-col gap-0.5">
                {entry.issues.map((issue) => (
                  <li
                    key={issue}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]"
                  >
                    <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--color-warning-500,#f59e0b)]" />
                    {formatIssueLabel(issue)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasFeedback && (
            <div className="flex gap-1.5 rounded-md bg-[var(--surface-secondary,#f9fafb)] px-2 py-1.5">
              <MessageSquare size={11} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{entry.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 전체 품질 요약 카드 ─────────────────────────

type QualitySummaryCardProps = {
  qualityScores: QualityScoreEntry[];
  recordLabelMap: Map<string, { label: string; grade: number }>;
};

export function QualitySummaryCard({ qualityScores, recordLabelMap }: QualitySummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (qualityScores.length === 0) return null;

  // 평균 점수
  const avgScore = Math.round(
    qualityScores.reduce((sum, q) => sum + q.overall_score, 0) / qualityScores.length,
  );
  const avgGrade = getQualityGrade(avgScore);
  const avgStyles = GRADE_STYLES[avgGrade];

  // 빈번한 이슈 Top 3
  const issueCount = new Map<string, number>();
  for (const q of qualityScores) {
    for (const issue of q.issues) {
      issueCount.set(issue, (issueCount.get(issue) ?? 0) + 1);
    }
  }
  const topIssues = [...issueCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 가장 낮은 점수 레코드 Top 3
  const bottomRecords = [...qualityScores]
    .sort((a, b) => a.overall_score - b.overall_score)
    .slice(0, 3)
    .filter((q) => q.overall_score < 70);

  // 이슈도 없고 낮은 레코드도 없으면 표시 생략
  if (topIssues.length === 0 && bottomRecords.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] overflow-hidden">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <span className="text-xs font-semibold text-[var(--text-primary)]">콘텐츠 품질 요약</span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold",
            avgStyles.badge,
          )}
        >
          {avgStyles.text} 평균 {avgScore}점
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{qualityScores.length}건 분석됨</span>
        <span className="ml-auto text-[var(--text-tertiary)]">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-secondary)] px-4 py-3 sm:grid-cols-2">
          {/* 반복 패턴 Top 3 */}
          {topIssues.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                반복 패턴 Top {topIssues.length}
              </p>
              <ul className="flex flex-col gap-1">
                {topIssues.map(([issue, count]) => (
                  <li key={issue} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning-400,#fbbf24)]" />
                      {formatIssueLabel(issue)}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--surface-secondary,#f3f4f6)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                      {count}건
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 주의 레코드 Top 3 */}
          {bottomRecords.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                주의 필요 레코드
              </p>
              <ul className="flex flex-col gap-1">
                {bottomRecords.map((q) => {
                  const info = recordLabelMap.get(q.record_id);
                  const label = info?.label ?? q.record_type;
                  const grade = getQualityGrade(q.overall_score);
                  const gs = GRADE_STYLES[grade];
                  return (
                    <li key={q.record_id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-[var(--text-secondary)]">{label}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                          gs.badge,
                        )}
                      >
                        {gs.text} {q.overall_score}점
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
