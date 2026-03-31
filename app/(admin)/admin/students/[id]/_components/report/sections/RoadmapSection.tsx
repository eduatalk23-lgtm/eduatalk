import { Map } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import type { RoadmapItem } from "@/lib/domains/student-record/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { isStageAtLeast } from "@/lib/domains/student-record/grade-stage";
import { BADGE, SPACING, STATUS_BADGE as TOKEN_STATUS_BADGE, TYPO } from "@/lib/design-tokens/report";

interface RoadmapSectionProps {
  items: RoadmapItem[];
  grade: number;
  stage?: GradeStage;
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

const STATUS_LABELS: Record<string, string> = {
  planning: "계획",
  confirmed: "확정",
  in_progress: "진행중",
  completed: "완료",
};

function getItemHighlightClass(
  itemStatus: string | null,
  stage: GradeStage | undefined,
): string {
  if (!stage) return "";

  const status = itemStatus ?? "planning";

  // prospective: 모든 항목 회색 처리 없음 (기본 상태 유지)
  if (stage === "prospective" || stage === "ai_draft") {
    return status === "planning" ? "opacity-70" : "";
  }

  // consultant: in_progress 항목 파란 하이라이트
  if (stage === "consultant") {
    return status === "in_progress" ? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20" : "";
  }

  // confirmed / final: completed 항목 초록 체크
  if (isStageAtLeast(stage, "confirmed")) {
    if (status === "completed") {
      return "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20";
    }
    if (status === "in_progress") {
      return "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20";
    }
  }

  return "";
}

export function RoadmapSection({ items, grade, stage }: RoadmapSectionProps) {
  const gradeItems = items
    .filter((i) => i.grade === grade)
    .sort((a, b) => {
      const sa = a.semester ?? 3;
      const sb = b.semester ?? 3;
      return sa - sb;
    });

  if (gradeItems.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Map} title={`${grade}학년 로드맵`} subtitle="학기별 활동 계획" />
        <EmptyState title="로드맵 항목이 없습니다" description="파이프라인을 실행하면 활동 로드맵이 자동 생성됩니다." />
      </section>
    );
  }

  const bySemester: Record<string, RoadmapItem[]> = {};
  for (const item of gradeItems) {
    const key = item.semester != null ? String(item.semester) : "연간";
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(item);
  }

  const semesterOrder = Object.keys(bySemester).sort((a, b) => {
    if (a === "연간") return 1;
    if (b === "연간") return -1;
    return Number(a) - Number(b);
  });

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Map} title={`${grade}학년 로드맵`} subtitle="학기별 활동 계획" />

      <div className={SPACING.sectionGap}>
        {semesterOrder.map((sem) => (
          <div key={sem}>
            <h3 className={cn("mb-2", TYPO.subsectionTitle)}>
              {sem === "연간" ? "연간 활동" : `${sem}학기`}
            </h3>
            <div className={SPACING.itemGap}>
              {bySemester[sem].map((item) => {
                const status = item.status ?? "planning";
                const highlightClass = getItemHighlightClass(status, stage);
                const isCompleted = status === "completed" && !!stage && isStageAtLeast(stage, "confirmed");

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border border-[var(--border-primary)] px-3 py-2 print-avoid-break transition-colors",
                      highlightClass,
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full px-2 py-0.5",
                        TYPO.label,
                        TOKEN_STATUS_BADGE[status] ?? BADGE.gray,
                      )}
                    >
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5", TYPO.label, BADGE.indigo)}>
                      {AREA_LABELS[item.area] ?? item.area}
                    </span>
                    <p className={cn("flex-1", TYPO.body, isCompleted && "line-through opacity-60")}>
                      {item.plan_content}
                    </p>
                    {isCompleted && (
                      <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">완료</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
