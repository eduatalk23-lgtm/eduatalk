"use client";

import { GraduationCap } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import type { UniversityMatchAnalysis, ProfileMatchResult } from "@/lib/domains/record-analysis/eval/university-profile-matcher";

interface Props {
  analysis: UniversityMatchAnalysis;
}

const GRADE_COLORS: Record<string, string> = {
  S: "bg-emerald-50 text-emerald-700 border-emerald-200",
  A: "bg-emerald-50 text-emerald-600 border-emerald-200",
  B: "bg-blue-50 text-blue-700 border-blue-200",
  C: "bg-amber-50 text-amber-700 border-amber-200",
  D: "bg-red-50 text-red-700 border-red-200",
};

function MatchCard({ match, rank }: { match: ProfileMatchResult; rank: number }) {
  const gradeClass = GRADE_COLORS[match.grade] ?? GRADE_COLORS.C;

  return (
    <div className={cn(
      "rounded-lg border p-4",
      rank === 0 ? "border-indigo-200 bg-indigo-50/30" : "border-border",
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{match.label}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", gradeClass)}>
            {match.grade}
          </span>
        </div>
        <span className="text-lg font-bold text-indigo-600">{match.matchScore}점</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {match.strengths.length > 0 && (
          <div>
            <span className="font-medium text-emerald-600">강점:</span>{" "}
            <span className="text-text-secondary">{match.strengths.join(", ")}</span>
          </div>
        )}
        {match.gaps.length > 0 && (
          <div>
            <span className="font-medium text-amber-600">보완:</span>{" "}
            <span className="text-text-secondary">{match.gaps.join(", ")}</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-text-tertiary">{match.recommendation}</p>
    </div>
  );
}

export function UniversityMatchSection({ analysis }: Props) {
  if (analysis.matches.length === 0) return null;

  return (
    <div>
      <ReportSectionHeader
        icon={GraduationCap}
        title="계열별 적합도"
        subtitle={analysis.summary}
      />

      <div className="space-y-3">
        {analysis.matches.slice(0, 5).map((m, i) => (
          <MatchCard key={m.track} match={m} rank={i} />
        ))}
      </div>
    </div>
  );
}
