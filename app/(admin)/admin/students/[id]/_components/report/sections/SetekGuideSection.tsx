import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import { EmptyState } from "../EmptyState";
import { Compass } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { isStageAtLeast } from "@/lib/domains/student-record/grade-stage";
import type { RecordSetek } from "@/lib/domains/student-record/types";
import { BADGE, CARD, SPACING, TYPO, PROGRESS } from "@/lib/design-tokens/report";

interface SetekGuideItem {
  id: string;
  subject_id: string;
  subject_name?: string | null;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  overall_direction: string | null;
  created_at: string;
}

interface SetekGuideSectionProps {
  guides: SetekGuideItem[];
  stage?: GradeStage;
  seteks?: RecordSetek[];
}

function getCompetencyLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

/** 가이드의 subject_id와 일치하는 세특 레코드에서 실제 내용 추출 */
function getSetekContent(
  subjectId: string,
  seteks: RecordSetek[],
  stage: GradeStage,
): string {
  const matching = seteks.find((s) => s.subject_id === subjectId);
  if (!matching) return "";
  if (stage === "final") return matching.imported_content ?? matching.confirmed_content ?? matching.content ?? "";
  if (stage === "confirmed") return matching.confirmed_content ?? matching.content ?? "";
  return matching.content ?? matching.ai_draft_content ?? "";
}

/** 키워드 반영률 계산 (0~100) */
function calcReflectionRate(keywords: string[], text: string): number {
  if (keywords.length === 0 || !text.trim()) return 0;
  const matched = keywords.filter((kw) => matchKeywordInText(kw, text)).length;
  return Math.round((matched / keywords.length) * 100);
}

export function SetekGuideSection({ guides, stage, seteks }: SetekGuideSectionProps) {
  const showComparison = !!stage && isStageAtLeast(stage, "consultant") && !!seteks?.length;

  if (!guides || guides.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Compass} title="세특 방향 가이드" subtitle="과목별 방향 · 교사 포인트" />
        <EmptyState
          title="세특 방향 가이드가 아직 생성되지 않았습니다."
          description="AI 초기 분석 파이프라인을 실행하면 과목별 방향 가이드가 자동 생성됩니다."
        />
      </section>
    );
  }

  // overall_direction은 첫 번째 행에만 있음
  const overallDirection = guides.find((g) => g.overall_direction)?.overall_direction;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Compass} title="세특 방향 가이드" subtitle="과목별 방향 · 교사 포인트" />

      {/* 전체 방향 */}
      {overallDirection && (
        <div className={cn("mb-4", CARD.indigo)}>
          <p className={cn("font-semibold", TYPO.label, "text-indigo-700 dark:text-indigo-300")}>전체 방향</p>
          <p className={cn("mt-1 leading-relaxed", TYPO.body)}>{overallDirection}</p>
        </div>
      )}

      {/* 과목별 카드 */}
      <div className={SPACING.cardGap}>
        {guides.map((guide) => {
          const actualContent = showComparison && seteks
            ? getSetekContent(guide.subject_id, seteks, stage!)
            : "";
          const reflectionRate = showComparison && actualContent
            ? calcReflectionRate(guide.keywords, actualContent)
            : null;

          return (
            <div key={guide.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm print-avoid-break">
              {/* 과목명 + 상태 */}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={TYPO.subsectionTitle}>{guide.subject_name ?? guide.subject_id}</h3>
                <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.gray)}>
                  {guide.source === "ai" ? "AI" : "수동"}
                </span>
              </div>

              {/* 키워드 */}
              {guide.keywords.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {guide.keywords.map((kw, ki) => {
                    const isMatched =
                      showComparison && actualContent
                        ? matchKeywordInText(kw, actualContent)
                        : null;
                    return (
                      <span
                        key={ki}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs",
                          isMatched === true
                            ? BADGE.emerald
                            : isMatched === false
                              ? "bg-red-50 text-red-500 line-through dark:bg-red-950/20 dark:text-red-400"
                              : BADGE.gray,
                        )}
                      >
                        {kw}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* 방향 */}
              <ReportMarkdown className="mt-2">{guide.direction}</ReportMarkdown>

              {/* stage >= consultant: 실제 내용 비교 뷰 */}
              {showComparison && (
                <div className={cn("mt-2 rounded p-2", CARD.blue)}>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">실제 내용</p>
                  <p className={cn("line-clamp-3", TYPO.caption)}>
                    {actualContent || "작성 중..."}
                  </p>

                  {/* 키워드 반영률 바 */}
                  {reflectionRate !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className={PROGRESS.track}
                        role="progressbar"
                        aria-valuenow={reflectionRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`키워드 반영률 ${reflectionRate}%`}
                      >
                        <div
                          className={cn(PROGRESS.bar, "bg-emerald-500 dark:bg-emerald-400")}
                          style={{ width: `${reflectionRate}%` }}
                        />
                      </div>
                      <span className={cn("whitespace-nowrap font-medium", TYPO.caption)}>
                        {reflectionRate}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
