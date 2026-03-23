"use client";

// ============================================
// AI vs 컨설턴트 역량 등급 비교 테이블
// DiagnosisComparisonView에서 분리
// ============================================

import { useState, useMemo, Fragment } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag, CompetencyArea } from "@/lib/domains/student-record";

// ─── GradeSummaryTable ─────────────────────────

export function GradeSummaryTable({ aiScores, consultantScores, activityTags }: {
  aiScores: CompetencyScore[];
  consultantScores: CompetencyScore[];
  activityTags: ActivityTag[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const findScore = (scores: CompetencyScore[], code: string): CompetencyScore | undefined =>
    scores.find((s) => s.competency_item === code && s.scope === "yearly");

  const tagsByItem = useMemo(() => {
    const map = new Map<string, { positive: ActivityTag[]; negative: ActivityTag[]; needs_review: ActivityTag[] }>();
    for (const tag of activityTags) {
      const key = tag.competency_item;
      const entry = map.get(key) ?? { positive: [], negative: [], needs_review: [] };
      if (tag.evaluation === "positive") entry.positive.push(tag);
      else if (tag.evaluation === "negative") entry.negative.push(tag);
      else entry.needs_review.push(tag);
      map.set(key, entry);
    }
    return map;
  }, [activityTags]);

  const areas: CompetencyArea[] = ["academic", "career", "community"];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="px-3 py-1.5 text-left font-medium text-[var(--text-secondary)]">역량 항목</th>
            <th className="w-16 px-2 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">AI</th>
            <th className="w-16 px-2 py-1.5 text-center font-medium text-[var(--text-secondary)]">컨설턴트</th>
            <th className="w-14 px-2 py-1.5 text-center font-medium text-[var(--text-tertiary)]">근거</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return items.map((item, idx) => {
              const aiScore = findScore(aiScores, item.code);
              const conScore = findScore(consultantScores, item.code);
              const aiGrade = aiScore?.grade_value;
              const conGrade = conScore?.grade_value;
              const match = aiGrade && conGrade && aiGrade === conGrade;
              const differs = aiGrade && conGrade && aiGrade !== conGrade;
              const isExpanded = expanded === item.code;
              const tags = tagsByItem.get(item.code);
              const tagCount = tags ? tags.positive.length + tags.negative.length + tags.needs_review.length : 0;
              const aiNarrative = aiScore?.narrative;
              const conNarrative = conScore?.narrative;
              const hasDetail = aiNarrative || conNarrative || tagCount > 0;

              return (
                <Fragment key={item.code}>
                  <tr
                    onClick={() => hasDetail && setExpanded(isExpanded ? null : item.code)}
                    onKeyDown={(e) => {
                      if (hasDetail && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setExpanded(isExpanded ? null : item.code);
                      }
                    }}
                    tabIndex={hasDetail ? 0 : undefined}
                    role={hasDetail ? "button" : undefined}
                    aria-expanded={hasDetail ? isExpanded : undefined}
                    aria-label={hasDetail ? `${item.label} 상세 ${isExpanded ? "닫기" : "열기"}` : undefined}
                    className={cn(
                      "border-t border-gray-100 dark:border-gray-800",
                      idx === 0 && "border-t-gray-300 dark:border-t-gray-600",
                      hasDetail && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      {idx === 0 && (
                        <span className="mr-1.5 text-[9px] font-semibold text-[var(--text-tertiary)]">
                          {COMPETENCY_AREA_LABELS[area]}
                        </span>
                      )}
                      <span className="text-[var(--text-primary)]">{item.label}</span>
                      {hasDetail && (
                        <span className="ml-1 text-[9px] text-[var(--text-tertiary)]">{isExpanded ? "▲" : "▼"}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <GradeBadge grade={aiGrade} variant={match ? "match" : differs ? "diff" : "default"} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <GradeBadge grade={conGrade} variant={match ? "match" : differs ? "diff" : "default"} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {tagCount > 0 && (
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                          {tags!.positive.length > 0 && <span className="text-green-600">+{tags!.positive.length}</span>}
                          {tags!.needs_review.length > 0 && <span className="ml-0.5 text-amber-500">?{tags!.needs_review.length}</span>}
                          {tags!.negative.length > 0 && <span className="ml-0.5 text-red-500">-{tags!.negative.length}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50/50 px-3 py-2 dark:bg-gray-800/30">
                        <GradeDetail
                          aiNarrative={aiNarrative ?? null}
                          conNarrative={conNarrative ?? null}
                          tags={tags}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── GradeDetail ────────────────────────────────

function GradeDetail({ aiNarrative, conNarrative, tags }: {
  aiNarrative: string | null;
  conNarrative: string | null;
  tags?: { positive: ActivityTag[]; negative: ActivityTag[]; needs_review: ActivityTag[] };
}) {
  const allTags = tags ? [...tags.positive, ...tags.needs_review, ...tags.negative] : [];

  return (
    <div className="flex flex-col gap-2">
      {(aiNarrative || conNarrative) && (
        <div className="flex flex-col gap-1.5">
          {aiNarrative && (
            <div className="flex gap-1.5">
              <span className="shrink-0 text-[9px] font-medium text-blue-600 dark:text-blue-400">AI</span>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{aiNarrative}</p>
            </div>
          )}
          {conNarrative && (
            <div className="flex gap-1.5">
              <span className="shrink-0 text-[9px] font-medium text-[var(--text-secondary)]">컨설턴트</span>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{conNarrative}</p>
            </div>
          )}
        </div>
      )}

      {allTags.length > 0 && (
        <div>
          <span className="text-[9px] font-medium text-[var(--text-tertiary)]">근거 활동 ({allTags.length}건)</span>
          <div className="mt-1 flex flex-col gap-0.5">
            {allTags.slice(0, 5).map((tag) => (
              <div key={tag.id} className="flex items-start gap-1.5 text-[10px]">
                <span className={cn(
                  "mt-0.5 shrink-0 rounded px-1 py-px text-[8px] font-medium",
                  tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                  tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                  tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                )}>
                  {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}
                </span>
                <span className="text-[var(--text-secondary)] line-clamp-1">
                  {tag.evidence_summary?.replace(/^\[AI\]\s*/, "").split("\n")[0] ?? tag.record_type}
                </span>
              </div>
            ))}
            {allTags.length > 5 && (
              <span className="text-[9px] text-[var(--text-tertiary)]">외 {allTags.length - 5}건</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GradeBadge ─────────────────────────────────

function GradeBadge({ grade, variant }: { grade?: string; variant: "match" | "diff" | "default" }) {
  if (!grade) return <span className="text-[var(--text-tertiary)]">-</span>;
  return (
    <span className={cn(
      "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
      variant === "match" && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      variant === "diff" && "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      variant === "default" && "text-[var(--text-primary)]",
    )}>
      {variant === "match" && "✓ "}{grade}
    </span>
  );
}

// ─── RecommendedCourses ─────────────────────────

export function RecommendedCourses({ majors }: { majors: string[] }) {
  if (majors.length === 0) return null;

  return (
    <div className="ml-16 flex flex-col gap-2">
      {majors.map((major) => {
        const courses = MAJOR_RECOMMENDED_COURSES[major];
        if (!courses) return null;
        return (
          <div key={major} className="rounded border border-gray-100 bg-gray-50/50 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{major}</span>
            {courses.general.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">일반</span>
                {courses.general.map((c) => (
                  <span key={c} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">{c}</span>
                ))}
              </div>
            )}
            {courses.career.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">진로</span>
                {courses.career.map((c) => (
                  <span key={c} className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">{c}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
