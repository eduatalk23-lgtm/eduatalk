import { Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import type { RoadmapItem, Strategy } from "@/lib/domains/student-record/types";
import { BADGE, AREA_BADGE, SPACING, TYPO } from "@/lib/design-tokens/report";

// 로드맵 영역 → 전략 target_area 역방향 매핑
const ROADMAP_AREA_TO_STRATEGY: Record<string, string[]> = {
  setek: ["setek", "personal_setek"],
  personal_setek: ["setek", "personal_setek"],
  autonomy: ["changche", "community"],
  club: ["changche", "community"],
  career: ["career"],
  reading: ["reading"],
  course_selection: ["score"],
  volunteer: ["community"],
};

interface ActionItemsSectionProps {
  roadmapItems: RoadmapItem[];
  studentGrade: number;
  strategies?: Strategy[];
}

const AREA_LABELS: Record<string, string> = {
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
  setek: "세특",
  personal_setek: "개인세특",
  reading: "독서",
  course_selection: "교과선택",
  competition: "대회",
  external: "외부활동",
  volunteer: "봉사",
  general: "기타",
};

export function ActionItemsSection({ roadmapItems, studentGrade, strategies = [] }: ActionItemsSectionProps) {
  const currentMonth = new Date().getMonth() + 1;
  const currentSemester = currentMonth >= 3 && currentMonth <= 8 ? 1 : 2;
  const nextSemester = currentSemester === 1 ? 2 : 1;

  const thisTermItems = roadmapItems.filter(
    (item) =>
      item.grade === studentGrade &&
      (item.semester === currentSemester || item.semester === null) &&
      item.status !== "completed",
  );

  const nextTermItems = roadmapItems.filter(
    (item) =>
      item.grade === studentGrade &&
      item.semester === nextSemester &&
      item.status === "planning",
  );

  const inProgress = thisTermItems.filter((i) => i.status === "in_progress");
  const upcoming = thisTermItems.filter(
    (i) => i.status === "confirmed" || i.status === "planning",
  );

  const hasAny = inProgress.length > 0 || upcoming.length > 0 || nextTermItems.length > 0;

  if (!hasAny) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Zap} title="이번 달 액션 아이템" subtitle="현재 학기 실행 계획" />
        <EmptyState
          title="현재 학기 액션 아이템이 없습니다"
          description="로드맵 항목이 추가되면 이번 학기 실행 계획이 자동으로 표시됩니다."
        />
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader
        icon={Zap}
        title="이번 달 액션 아이템"
        subtitle={`${studentGrade}학년 ${currentSemester}학기 실행 계획`}
      />

      <div className={SPACING.sectionGap}>
        {inProgress.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
              지금 진행 중
            </h3>
            <div className={SPACING.itemGap}>
              {inProgress.map((item) => {
                const relatedStrategyAreas = ROADMAP_AREA_TO_STRATEGY[item.area] ?? [];
                const relatedStrategy = strategies.find(
                  (s) => relatedStrategyAreas.includes(s.target_area) && s.status !== "done",
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 print-avoid-break dark:border-amber-800 dark:bg-amber-950/20"
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5",
                        TYPO.label,
                        AREA_BADGE[item.area] ?? BADGE.gray,
                      )}
                    >
                      {AREA_LABELS[item.area] ?? item.area}
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className={TYPO.body}>{item.plan_content}</p>
                      {relatedStrategy && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          관련 전략: {relatedStrategy.strategy_content.slice(0, 50)}
                          {relatedStrategy.strategy_content.length > 50 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400" />
              이번 학기 예정
            </h3>
            <div className={SPACING.itemGap}>
              {upcoming.map((item) => {
                const relatedStrategyAreas = ROADMAP_AREA_TO_STRATEGY[item.area] ?? [];
                const relatedStrategy = strategies.find(
                  (s) => relatedStrategyAreas.includes(s.target_area) && s.status !== "done",
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 print-avoid-break dark:border-blue-800 dark:bg-blue-950/20"
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5",
                        TYPO.label,
                        AREA_BADGE[item.area] ?? BADGE.gray,
                      )}
                    >
                      {AREA_LABELS[item.area] ?? item.area}
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className={TYPO.body}>{item.plan_content}</p>
                      {relatedStrategy && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          관련 전략: {relatedStrategy.strategy_content.slice(0, 50)}
                          {relatedStrategy.strategy_content.length > 50 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nextTermItems.length > 0 && (
          <div>
            <h3 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", "text-[var(--text-secondary)]")}>
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400 dark:bg-bg-secondary0" />
              다음 학기 준비 ({nextSemester}학기)
            </h3>
            <div className={SPACING.itemGap}>
              {nextTermItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-3 py-2 print-avoid-break"
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1.5 py-0.5",
                      TYPO.label,
                      AREA_BADGE[item.area] ?? BADGE.gray,
                    )}
                  >
                    {AREA_LABELS[item.area] ?? item.area}
                  </span>
                  <p className={cn("flex-1", TYPO.body)}>{item.plan_content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
