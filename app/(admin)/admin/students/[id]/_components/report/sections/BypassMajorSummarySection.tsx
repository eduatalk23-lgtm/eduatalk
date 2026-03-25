import { EmptyState } from "../EmptyState";
import { Route } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

interface BypassMajorSummarySectionProps {
  candidates: Array<{
    candidateDept: string;
    candidateUniv: string;
    compositeScore: number | null;
    rationale: string | null;
  }>;
  targetMajor: string | null;
}

export function BypassMajorSummarySection({ candidates, targetMajor }: BypassMajorSummarySectionProps) {
  if (candidates.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Route} title="우회학과 분석" subtitle="교차지원 후보" />
        <EmptyState
          title="우회학과 분석이 아직 실행되지 않았습니다."
          description="목표 전공 설정 후 우회학과 분석을 실행하면 교차지원 가능한 학과가 표시됩니다."
        />
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Route} title="우회학과 분석" subtitle="교차지원 후보" />
      {targetMajor && (
        <p className="mb-3 text-xs text-gray-500">
          목표 전공 <span className="font-semibold text-gray-700">{targetMajor}</span> 대비 교차 지원 가능 학과 (상위 {candidates.length}개)
        </p>
      )}

      <div className="space-y-2">
        {candidates.map((c, idx) => {
          const score = c.compositeScore != null ? Math.round(c.compositeScore) : null;
          return (
            <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 print-avoid-break">
              {/* 순위 */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {idx + 1}
              </span>

              {/* 학과 정보 */}
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{c.candidateUniv}</p>
                <p className="text-xs text-gray-600">{c.candidateDept}</p>
                {c.rationale && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {c.rationale.length > 60 ? c.rationale.slice(0, 60) + "…" : c.rationale}
                  </p>
                )}
              </div>

              {/* 매칭 점수 바 */}
              {score != null && (
                <div className="flex w-24 items-center gap-1.5">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                    <div
                      className={`h-1.5 rounded-full ${score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${Math.min(score, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{score}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
