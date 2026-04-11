"use client";

// ============================================
// F2: 계열 적합도 카드 (진단 탭 인라인)
// ============================================

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { UniversityMatchAnalysis, ProfileMatchResult } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import { ChevronDown } from "lucide-react";

const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  S: { bg: "bg-emerald-100 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400" },
  A: { bg: "bg-emerald-50 dark:bg-emerald-900/10", text: "text-emerald-600 dark:text-emerald-400" },
  B: { bg: "bg-blue-50 dark:bg-blue-900/10", text: "text-blue-700 dark:text-blue-400" },
  C: { bg: "bg-amber-50 dark:bg-amber-900/10", text: "text-amber-700 dark:text-amber-400" },
  D: { bg: "bg-red-50 dark:bg-red-900/10", text: "text-red-700 dark:text-red-400" },
};

interface Props {
  analysis: UniversityMatchAnalysis;
}

export function UniversityMatchCard({ analysis }: Props) {
  const [expanded, setExpanded] = useState(false);
  const top = analysis.topMatch;
  const topGc = GRADE_STYLE[top.grade] ?? GRADE_STYLE.C;

  return (
    <div className="flex flex-col gap-3">
      {/* 최적 계열 */}
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", topGc.bg)}>
          <span className={cn("text-lg font-bold", topGc.text)}>{top.grade}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{top.label}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{top.matchScore}점</p>
          </div>
        </div>
      </div>

      {/* 전체 트랙 바 차트 */}
      <div className="flex flex-col gap-1.5">
        {analysis.matches.map((m) => (
          <TrackBar key={m.track} match={m} isTop={m.track === top.track} />
        ))}
      </div>

      {/* 요약 */}
      <p className="text-xs text-[var(--text-secondary)]">{analysis.summary}</p>

      {/* 상세 (접힌 상태) */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          계열별 상세
          <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
        {expanded && (
          <div className="mt-2 flex flex-col gap-2">
            {analysis.matches.map((m) => (
              <TrackDetail key={m.track} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackBar({ match, isTop }: { match: ProfileMatchResult; isTop: boolean }) {
  const gc = GRADE_STYLE[match.grade] ?? GRADE_STYLE.C;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-20 shrink-0 text-xs", isTop ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}>
        {match.label}
      </span>
      <div className="relative h-4 flex-1 rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", isTop ? "bg-violet-500 dark:bg-violet-400" : "bg-[var(--text-quaternary)]")}
          style={{ width: `${Math.min(match.matchScore, 100)}%` }}
        />
      </div>
      <span className={cn("w-8 shrink-0 text-right text-[10px] font-medium", gc.text)}>
        {match.grade}
      </span>
    </div>
  );
}

function TrackDetail({ match }: { match: ProfileMatchResult }) {
  const gc = GRADE_STYLE[match.grade] ?? GRADE_STYLE.C;
  return (
    <div className={cn("rounded-lg border px-3 py-2", gc.bg, "border-[var(--border-primary)]")}>
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-semibold", gc.text)}>{match.grade}</span>
        <span className="text-xs font-medium text-[var(--text-primary)]">{match.label}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{match.matchScore}점</span>
      </div>
      {match.strengths.length > 0 && (
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
          강점: {match.strengths.join(", ")}
        </p>
      )}
      {match.gaps.length > 0 && (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          보완: {match.gaps.join(", ")}
        </p>
      )}
      <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{match.recommendation}</p>
    </div>
  );
}
