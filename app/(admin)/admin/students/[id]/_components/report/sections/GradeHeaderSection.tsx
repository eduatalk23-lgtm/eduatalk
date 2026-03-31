import { GraduationCap, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { GRADE_STAGE_CONFIG, STAGE_ORDER, type GradeStage } from "@/lib/domains/student-record/grade-stage";
import { TYPO } from "@/lib/design-tokens/report";

interface GradeHeaderSectionProps {
  grade: number;
  schoolYear: number;
  stage: GradeStage;
  /** 접기/펼치기 제어 (optional) */
  expanded?: boolean;
  onToggle?: () => void;
}

export function GradeHeaderSection({
  grade,
  schoolYear,
  stage,
  expanded,
  onToggle,
}: GradeHeaderSectionProps) {
  const config = GRADE_STAGE_CONFIG[stage];
  const stageIndex = STAGE_ORDER.indexOf(stage);

  // 색상 맵: tailwind 동적 클래스 — 빌드 시 purge 방지를 위해 완전한 클래스명 사용
  const activeBarClass: Record<string, string> = {
    violet: "bg-violet-500",
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    gray: "bg-gray-500",
  };
  const activeBar = activeBarClass[config.color] ?? "bg-gray-500";

  const isProspective = stage === "prospective";
  const showToggle = onToggle !== undefined && expanded !== undefined;

  return (
    <div className={cn(
      "flex items-start gap-4 border-b-2 pb-4",
      isProspective
        ? "border-violet-200 dark:border-violet-800"
        : "border-indigo-200 dark:border-indigo-800",
    )}>
      <div className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
        isProspective ? "bg-violet-500 dark:bg-violet-700" : "bg-indigo-600 dark:bg-indigo-700",
      )}>
        <GraduationCap className="h-6 w-6 text-white" />
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {/* 학년 + 배지 + 접기 버튼 */}
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {grade}학년
          </h2>
          <span className={cn("text-lg font-medium", TYPO.caption)}>({schoolYear}학년도)</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              config.bgClass,
              config.textClass,
            )}
          >
            {config.label}
          </span>
          {showToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? "학년 섹션 접기" : "학년 섹션 펼치기"}
              className={cn(
                "ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
                isProspective
                  ? "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
              )}
            >
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
              {expanded ? "접기" : "펼치기"}
            </button>
          )}
        </div>

        {/* 5단계 프로그레스 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= stageIndex ? activeBar : "bg-gray-200 dark:bg-gray-700",
              )}
            />
          ))}
          <span className={cn("ml-1 whitespace-nowrap", TYPO.caption)}>
            {config.description}
          </span>
        </div>
      </div>
    </div>
  );
}
