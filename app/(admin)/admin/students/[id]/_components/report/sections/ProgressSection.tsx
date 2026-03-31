import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import type { RoadmapItem } from "@/lib/domains/student-record/types";
import type { CoursePlanWithSubject } from "@/lib/domains/student-record/course-plan/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { TYPO } from "@/lib/design-tokens/report";

interface ProgressSectionProps {
  grade: number;
  roadmapItems: RoadmapItem[];
  coursePlans: CoursePlanWithSubject[];
  setekCount: number;
  changcheCount: number;
  hasHaengteuk: boolean;
  stage?: GradeStage;
}

function ProgressBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-12 text-right font-semibold", TYPO.caption)}>
        {value}/{max}
      </span>
    </div>
  );
}

/** stage 기반 바 색상 결정 */
function getBarColor(stage: GradeStage | undefined, type: "primary" | "secondary"): string {
  if (!stage) return type === "primary" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-400 dark:bg-amber-500";
  switch (stage) {
    case "prospective":
    case "ai_draft":
      return type === "primary" ? "bg-gray-400 dark:bg-gray-500" : "bg-gray-300 dark:bg-gray-600";
    case "consultant":
      return type === "primary" ? "bg-blue-500 dark:bg-blue-400" : "bg-blue-300 dark:bg-blue-600";
    case "confirmed":
      return type === "primary" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-blue-400 dark:bg-blue-500";
    case "final":
      return type === "primary" ? "bg-emerald-600 dark:bg-emerald-500" : "bg-emerald-400 dark:bg-emerald-600";
  }
}

export function ProgressSection({
  grade,
  roadmapItems,
  coursePlans,
  setekCount,
  changcheCount,
  hasHaengteuk,
  stage,
}: ProgressSectionProps) {
  const gradeItems = roadmapItems.filter((i) => i.grade === grade);
  const completed = gradeItems.filter((i) => i.status === "completed").length;
  const inProgress = gradeItems.filter((i) => i.status === "in_progress").length;
  const total = gradeItems.length;

  const planCompleted = coursePlans.filter((p) => p.plan_status === "completed").length;
  const planConfirmed = coursePlans.filter((p) => p.plan_status === "confirmed").length;
  const planTotal = coursePlans.length;

  const recordTotal = setekCount + changcheCount + (hasHaengteuk ? 1 : 0);

  const primaryColor = getBarColor(stage, "primary");
  const secondaryColor = getBarColor(stage, "secondary");

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={TrendingUp} title={`${grade}학년 달성도`} subtitle="수강·로드맵·기록 이행 현황" />

      <div className="grid gap-4 sm:grid-cols-3">
        {/* 로드맵 실행률 */}
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
          <p className={cn("mb-1 font-semibold uppercase tracking-wider", TYPO.caption)}>로드맵 실행률</p>
          <div className="mt-2 space-y-2">
            <div>
              <div className={cn("mb-1 flex justify-between", TYPO.caption)}>
                <span>완료</span>
              </div>
              <ProgressBar value={completed} max={total} color={primaryColor} label={`로드맵 완료 ${completed}/${total}`} />
            </div>
            <div>
              <div className={cn("mb-1 flex justify-between", TYPO.caption)}>
                <span>진행중</span>
              </div>
              <ProgressBar value={inProgress} max={total} color={secondaryColor} label={`로드맵 진행중 ${inProgress}/${total}`} />
            </div>
          </div>
          {total === 0 && (
            <p className={cn("mt-2", TYPO.empty)}>로드맵 항목 없음</p>
          )}
        </div>

        {/* 수강 이행률 */}
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
          <p className={cn("mb-1 font-semibold uppercase tracking-wider", TYPO.caption)}>수강 이행률</p>
          <div className="mt-2 space-y-2">
            <div>
              <div className={cn("mb-1", TYPO.caption)}>이수</div>
              <ProgressBar value={planCompleted} max={planTotal} color={primaryColor} label={`수강 이수 ${planCompleted}/${planTotal}`} />
            </div>
            <div>
              <div className={cn("mb-1", TYPO.caption)}>확정</div>
              <ProgressBar value={planConfirmed} max={planTotal} color={secondaryColor} label={`수강 확정 ${planConfirmed}/${planTotal}`} />
            </div>
          </div>
          {planTotal === 0 && (
            <p className={cn("mt-2", TYPO.empty)}>수강 계획 없음</p>
          )}
        </div>

        {/* 기록 현황 */}
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3">
          <p className={cn("mb-1 font-semibold uppercase tracking-wider", TYPO.caption)}>기록 현황</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className={TYPO.caption}>세특</span>
              <span className={cn("font-semibold", TYPO.body)}>{setekCount}건</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={TYPO.caption}>창체</span>
              <span className={cn("font-semibold", TYPO.body)}>{changcheCount}건</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={TYPO.caption}>행특</span>
              <span className={cn("font-semibold", hasHaengteuk ? "text-emerald-600 dark:text-emerald-400" : TYPO.caption)}>
                {hasHaengteuk ? "작성됨" : "미작성"}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-[var(--border-primary)] pt-2 text-xs font-semibold">
              <span className={TYPO.body}>총 기록</span>
              <span className="text-indigo-700 dark:text-indigo-400">{recordTotal}건</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
