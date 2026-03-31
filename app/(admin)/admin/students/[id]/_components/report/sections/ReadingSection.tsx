import { BookMarked } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import type { RecordReading, RoadmapItem } from "@/lib/domains/student-record/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { BADGE, CARD, SPACING, TYPO } from "@/lib/design-tokens/report";

interface ReadingSectionProps {
  readings: RecordReading[];
  stage?: GradeStage;
  /** prospective 단계에서 독서 예정 항목 추출용 */
  roadmapItems?: RoadmapItem[];
}

export function ReadingSection({ readings, stage, roadmapItems }: ReadingSectionProps) {
  const isProspective = stage === "prospective" || stage === "ai_draft";

  // prospective 단계이고 실제 독서 기록이 없는 경우 → 로드맵 reading 항목을 예정 도서로 표시
  const plannedReadings = isProspective && (!readings || readings.length === 0)
    ? (roadmapItems ?? []).filter((r) => r.area === "reading")
    : [];

  if ((!readings || readings.length === 0) && plannedReadings.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={BookMarked} title="독서 활동" subtitle="독서 목록 및 활동 내용" />
        <EmptyState title="독서 기록이 없습니다" description="독서 기록을 추가하면 여기에 표시됩니다." />
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={BookMarked} title="독서 활동" subtitle="독서 목록 및 활동 내용" />

      {/* 예정 도서 (prospective 단계) */}
      {plannedReadings.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">예정 도서 (로드맵 기반)</p>
          <div className={SPACING.itemGap}>
            {plannedReadings.map((r) => (
              <div
                key={r.id}
                className={cn("px-3 py-2", CARD.violet)}
              >
                <p className={cn(TYPO.body, "text-violet-800 dark:text-violet-300")}>{r.plan_content}</p>
                {r.semester && (
                  <p className="mt-0.5 text-xs text-violet-500 dark:text-violet-400">{r.semester}학기 예정</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실제 독서 기록 */}
      {readings && readings.length > 0 && (
        <div className={SPACING.itemGap}>
          {readings.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 print-avoid-break">
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 shrink-0 font-semibold", TYPO.caption)}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={cn("font-semibold", TYPO.body)}>
                      {r.book_title}
                    </span>
                    {r.author && (
                      <span className={TYPO.caption}>{r.author}</span>
                    )}
                    {r.subject_area && (
                      <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.gray)}>
                        {r.subject_area}
                      </span>
                    )}
                    {r.is_recommended && (
                      <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.indigo)}>
                        추천도서
                      </span>
                    )}
                  </div>
                  {r.notes && (
                    <p className={cn("mt-1 line-clamp-2 leading-relaxed", TYPO.caption)}>
                      {r.notes}
                    </p>
                  )}
                  {r.post_reading_activity && (
                    <p className={cn("mt-0.5 line-clamp-1 italic", TYPO.caption)}>
                      독후 활동: {r.post_reading_activity}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
