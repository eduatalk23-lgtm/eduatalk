"use client";

import { FileText } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import type { ExecutiveSummary } from "@/lib/domains/student-record/eval/executive-summary";

interface Props {
  summary: ExecutiveSummary;
}

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  S: { text: "text-emerald-700", bg: "bg-emerald-50" },
  A: { text: "text-emerald-600", bg: "bg-emerald-50" },
  B: { text: "text-blue-700", bg: "bg-blue-50" },
  C: { text: "text-amber-700", bg: "bg-amber-50" },
  D: { text: "text-red-700", bg: "bg-red-50" },
};

export function PipelineExecutiveSummarySection({ summary }: Props) {
  const gc = GRADE_COLORS[summary.overallGrade] ?? GRADE_COLORS.C;

  return (
    <div>
      <ReportSectionHeader
        icon={FileText}
        title="AI 종합 분석"
        subtitle="파이프라인 역량 종합 평가"
      />

      {/* 종합 점수 */}
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 p-4">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold", gc.bg, gc.text)}>
          {summary.overallGrade}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{summary.overallScore}점</p>
          {summary.growthTrend && (
            <p className="text-sm text-gray-500">
              성장 추세: {summary.growthTrend === "rising" ? "상승" : summary.growthTrend === "falling" ? "하락" : summary.growthTrend === "stable" ? "안정" : "변동"}
            </p>
          )}
        </div>
      </div>

      {/* 강점/약점 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {summary.topStrengths.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-sm font-semibold text-emerald-700">강점 역량</p>
            <ul className="mt-1 space-y-1">
              {summary.topStrengths.map((s) => (
                <li key={s.competencyId} className="text-xs text-emerald-600">
                  {s.competencyName} ({s.score}점)
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.topWeaknesses.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-sm font-semibold text-amber-700">보완 역량</p>
            <ul className="mt-1 space-y-1">
              {summary.topWeaknesses.map((s) => (
                <li key={s.competencyId} className="text-xs text-amber-600">
                  {s.competencyName} ({s.score}점)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 대학 매칭 Top3 (있으면) */}
      {summary.topUniversityMatches && summary.topUniversityMatches.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">계열 적합도 상위</p>
          <div className="flex flex-wrap gap-2">
            {summary.topUniversityMatches.map((m) => (
              <span key={m.label} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {m.label} {m.grade} ({m.score}점)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 섹션별 서술 */}
      <div className="space-y-4">
        {summary.sections.keyMetrics && (
          <Paragraph title="핵심 지표" content={summary.sections.keyMetrics} />
        )}
        {summary.sections.competencyProfile && (
          <Paragraph title="역량 프로필" content={summary.sections.competencyProfile} />
        )}
        {summary.sections.growthTrend && (
          <Paragraph title="성장 추세" content={summary.sections.growthTrend} />
        )}
        {summary.sections.universityFit && (
          <Paragraph title="대학 적합도" content={summary.sections.universityFit} />
        )}
        {summary.sections.opinion && (
          <Paragraph title="종합 의견" content={summary.sections.opinion} />
        )}
      </div>
    </div>
  );
}

function Paragraph({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">{content}</p>
    </div>
  );
}
