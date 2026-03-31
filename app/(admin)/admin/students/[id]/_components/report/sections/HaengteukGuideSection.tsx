import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import { ReportMarkdown } from "../ReportMarkdown";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { isStageAtLeast } from "@/lib/domains/student-record/grade-stage";
import type { RecordHaengteuk } from "@/lib/domains/student-record/types";
import { BADGE, CARD, TABLE, TYPO, PROGRESS } from "@/lib/design-tokens/report";

interface EvaluationItem {
  item: string;
  score: string;
  reasoning: string;
}

interface HaengteukGuideProps {
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  evaluation_items?: EvaluationItem[];
}

interface HaengteukGuideSectionProps {
  guide: HaengteukGuideProps | null;
  stage?: GradeStage;
  haengteuk?: RecordHaengteuk | null;
}

const SCORE_BADGE: Record<string, string> = {
  우수: BADGE.emerald,
  양호: BADGE.blue,
  보통: BADGE.amber,
};

function getCompetencyLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

function getHaengteukContent(record: RecordHaengteuk, stage: GradeStage): string {
  if (stage === "final") return record.imported_content ?? record.confirmed_content ?? record.content ?? "";
  if (stage === "confirmed") return record.confirmed_content ?? record.content ?? "";
  return record.content ?? record.ai_draft_content ?? "";
}

function calcReflectionRate(keywords: string[], text: string): number {
  if (keywords.length === 0 || !text.trim()) return 0;
  const matched = keywords.filter((kw) => matchKeywordInText(kw, text)).length;
  return Math.round((matched / keywords.length) * 100);
}

export function HaengteukGuideSection({ guide, stage, haengteuk }: HaengteukGuideSectionProps) {
  const showComparison = !!stage && isStageAtLeast(stage, "consultant") && !!haengteuk;

  if (!guide) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Star} title="행특 방향 가이드" subtitle="행동특성 및 종합의견 · 평가항목" />
        <EmptyState
          title="행특 방향 가이드를 생성하면 표시됩니다"
          description="AI 파이프라인을 실행하면 행동특성 방향 가이드가 자동 생성됩니다."
        />
      </section>
    );
  }

  const evalItems: EvaluationItem[] = Array.isArray(guide.evaluation_items)
    ? (guide.evaluation_items as EvaluationItem[])
    : [];

  const actualContent =
    showComparison && haengteuk ? getHaengteukContent(haengteuk, stage!) : "";
  const reflectionRate =
    showComparison && actualContent ? calcReflectionRate(guide.keywords, actualContent) : null;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Star} title="행특 방향 가이드" subtitle="행동특성 및 종합의견 · 평가항목" />

      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm print-avoid-break">
        {/* 역량 배지 */}
        {guide.competency_focus.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {guide.competency_focus.map((code) => (
              <span
                key={code}
                className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.indigo)}
              >
                {getCompetencyLabel(code)}
              </span>
            ))}
          </div>
        )}

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

      {/* 평가항목 테이블 */}
      {evalItems.length > 0 && (
        <div className="mt-4">
          <h3 className={cn("mb-2", TYPO.subsectionTitle)}>평가항목별 분석</h3>
          <table className={TABLE.wrapper}>
            <caption className="sr-only">행동특성 평가항목</caption>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>항목</th>
                <th className={cn(TABLE.th, "text-center")}>평가</th>
                <th className={TABLE.th}>근거</th>
              </tr>
            </thead>
            <tbody>
              {evalItems.map((ei, i) => (
                <tr key={i} className={TABLE.tr}>
                  <td className={cn(TABLE.td, "font-medium")}>{ei.item}</td>
                  <td className={cn(TABLE.td, "text-center")}>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5",
                        TYPO.label,
                        SCORE_BADGE[ei.score] ?? BADGE.gray,
                      )}
                    >
                      {ei.score}
                    </span>
                  </td>
                  <td className={cn(TABLE.td, "text-xs")}>{ei.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
