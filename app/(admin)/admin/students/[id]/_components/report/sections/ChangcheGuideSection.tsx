import { Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import { ReportMarkdown } from "../ReportMarkdown";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { isStageAtLeast } from "@/lib/domains/student-record/grade-stage";
import type { RecordChangche } from "@/lib/domains/student-record/types";
import { BADGE, CARD, SPACING, TYPO, PROGRESS } from "@/lib/design-tokens/report";

interface ChangcheGuideItem {
  activity_type: string;
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
}

interface ChangcheGuideSectionProps {
  guides: ChangcheGuideItem[];
  stage?: GradeStage;
  changche?: RecordChangche[];
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
};

function getCompetencyLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

function getChangcheContent(
  activityType: string,
  changche: RecordChangche[],
  stage: GradeStage,
): string {
  const matching = changche.find((c) => c.activity_type === activityType);
  if (!matching) return "";
  if (stage === "final") return matching.imported_content ?? matching.confirmed_content ?? matching.content ?? "";
  if (stage === "confirmed") return matching.confirmed_content ?? matching.content ?? "";
  return matching.content ?? matching.ai_draft_content ?? "";
}

function calcReflectionRate(keywords: string[], text: string): number {
  if (keywords.length === 0 || !text.trim()) return 0;
  const matched = keywords.filter((kw) => matchKeywordInText(kw, text)).length;
  return Math.round((matched / keywords.length) * 100);
}

export function ChangcheGuideSection({ guides, stage, changche }: ChangcheGuideSectionProps) {
  const showComparison = !!stage && isStageAtLeast(stage, "consultant") && !!changche?.length;

  if (!guides || guides.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Users} title="창체 방향 가이드" subtitle="활동유형별 방향 · 교사 포인트" />
        <EmptyState
          title="창체 방향 가이드를 생성하면 표시됩니다"
          description="AI 파이프라인을 실행하면 자율/동아리/진로 활동별 방향 가이드가 자동 생성됩니다."
        />
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Users} title="창체 방향 가이드" subtitle="활동유형별 방향 · 교사 포인트" />

      <div className={SPACING.cardGap}>
        {guides.map((guide, idx) => {
          const actualContent = showComparison && changche
            ? getChangcheContent(guide.activity_type, changche, stage!)
            : "";
          const reflectionRate = showComparison && actualContent
            ? calcReflectionRate(guide.keywords, actualContent)
            : null;

          return (
            <div key={idx} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm print-avoid-break">
              {/* 활동 유형 + 역량 배지 */}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={TYPO.subsectionTitle}>
                  {ACTIVITY_TYPE_LABELS[guide.activity_type] ?? guide.activity_type}
                </h3>
                {guide.competency_focus.map((code) => (
                  <span
                    key={code}
                    className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.indigo)}
                  >
                    {getCompetencyLabel(code)}
                  </span>
                ))}
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

              {/* 주의사항 */}
              {guide.cautions && (
                <div className={cn("mt-2 rounded px-2 py-1.5 text-xs border", CARD.amber)}>
                  <span className="font-semibold">주의: </span>{guide.cautions}
                </div>
              )}

              {/* 교사 포인트 */}
              {guide.teacher_points.length > 0 && (
                <div className="mt-2">
                  <p className={cn("font-semibold", TYPO.caption)}>교사 관찰 포인트</p>
                  <ul className="mt-1 space-y-0.5">
                    {guide.teacher_points.map((pt, pi) => (
                      <li key={pi} className={cn("flex items-start gap-1.5", TYPO.caption)}>
                        <span className="mt-0.5 shrink-0 text-indigo-400 dark:text-indigo-500">·</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* stage >= consultant: 실제 내용 비교 뷰 */}
              {showComparison && (
                <div className={cn("mt-2 rounded p-2", CARD.blue)}>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">실제 내용</p>
                  <p className={cn("line-clamp-3", TYPO.caption)}>
                    {actualContent || "작성 중..."}
                  </p>
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
