import { EmptyState } from "../EmptyState";
import { Route } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

interface BypassCandidate {
  candidateDept: string;
  candidateUniv: string;
  compositeScore: number | null;
  rationale: string | null;
  curriculumSimilarity?: number | null;
  competencyFit?: number | null;
  competencyRationale?: string | null;
  curriculumRationale?: string | null;
  placementRationale?: string | null;
}

interface BypassMajorSummarySectionProps {
  candidates: BypassCandidate[];
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
        <p className="mb-3 text-xs text-text-tertiary">
          목표 전공 <span className="font-semibold text-text-primary">{targetMajor}</span> 대비 교차 지원 가능 학과 (상위 {candidates.length}개)
        </p>
      )}

      <div className="space-y-2">
        {candidates.map((c, idx) => {
          const score = c.compositeScore != null ? Math.round(c.compositeScore) : null;
          const hasAxisData = c.curriculumSimilarity != null || c.competencyFit != null;
          return (
            <div key={idx} className="rounded-lg border border-border px-4 py-3 print-avoid-break">
              <div className="flex items-center gap-3">
                {/* 순위 */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {idx + 1}
                </span>

                {/* 학과 정보 */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">{c.candidateUniv}</p>
                  <p className="text-xs text-text-secondary">{c.candidateDept}</p>
                </div>

                {/* 종합 점수 바 */}
                {score != null && (
                  <div className="flex w-24 items-center gap-1.5">
                    <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary">
                      <div
                        className={`h-1.5 rounded-full ${score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-text-primary">{score}%</span>
                  </div>
                )}
              </div>

              {/* 3축 점수 + rationale */}
              {hasAxisData && (
                <div className="mt-2 flex flex-wrap gap-3 text-3xs text-text-tertiary">
                  {c.curriculumSimilarity != null && (
                    <span>유사도 <span className="font-medium text-text-primary">{c.curriculumSimilarity}%</span></span>
                  )}
                  {c.competencyFit != null && (
                    <span>역량 <span className="font-medium text-text-primary">{c.competencyFit}점</span></span>
                  )}
                </div>
              )}
              {(c.competencyRationale || c.curriculumRationale || c.placementRationale) && (
                <div className="mt-1.5 space-y-0.5 text-3xs text-text-tertiary">
                  {c.curriculumRationale && <p>{c.curriculumRationale}</p>}
                  {c.competencyRationale && <p>{c.competencyRationale}</p>}
                  {c.placementRationale && <p>{c.placementRationale}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
