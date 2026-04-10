"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { GuideAssignmentCard } from "./GuideAssignmentCard";
import type { HaengteukGuideLinkRow } from "@/lib/domains/student-record/actions/haengteuk-guide-links";

/**
 * 행특 평가항목 1개에 매칭된 탐구 가이드 링크 N개를 토글 드롭다운으로 표시.
 *
 * Phase 2 Decision #3 옵션 B 의 UI 사이드:
 * - 행특 가이드는 학년도별로 1개씩 존재, 각 가이드에 8 평가항목이 있음.
 * - 탐구 가이드 배정은 창체/세특 활동마다 존재.
 * - Gemini Flash 매칭으로 각 평가항목이 어떤 탐구 가이드 활동에 의해 뒷받침되는지 기록.
 * - 이 컴포넌트는 "근거 가이드 N개" 토글 + 드롭다운으로 해당 링크들을 노출한다.
 */
export function HaengteukGuideLinkDropdown({
  links,
  className,
}: {
  /** 이 한 행(=한 평가항목) 에 해당하는 링크만 전달. 부모에서 미리 필터 */
  links: HaengteukGuideLinkRow[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (links.length === 0) {
    return (
      <span className={cn("text-[11px] text-[var(--text-placeholder)]", className)}>
        근거 가이드 없음
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100",
          "dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50",
          open && "bg-indigo-100 dark:bg-indigo-900/50",
        )}
        aria-expanded={open}
      >
        <Link2 className="h-3 w-3" />
        <span>근거 가이드 {links.length}개</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 rounded border border-indigo-100 bg-indigo-50/30 p-1.5 dark:border-indigo-900 dark:bg-indigo-950/20">
          {links.map((link) => {
            const a = link.assignment;
            if (!a) {
              return (
                <div
                  key={`${link.haengteuk_guide_id}:${link.evaluation_item}:${link.exploration_guide_assignment_id}`}
                  className="rounded border border-dashed border-gray-300 bg-white/60 p-1.5 text-[11px] text-[var(--text-tertiary)]"
                >
                  링크된 배정이 조회되지 않음 (assignmentId={link.exploration_guide_assignment_id.slice(0, 8)}…)
                </div>
              );
            }
            const cardAssignment = {
              id: a.id,
              status: a.status,
              ai_recommendation_reason: a.ai_recommendation_reason,
              student_notes: a.student_notes,
              target_activity_type: a.target_activity_type,
              exploration_guides: a.exploration_guides
                ? {
                    id: a.exploration_guides.id,
                    title: a.exploration_guides.title,
                    guide_type: a.exploration_guides.guide_type ?? undefined,
                  }
                : undefined,
            };
            return (
              <div
                key={`${link.haengteuk_guide_id}:${link.evaluation_item}:${link.exploration_guide_assignment_id}`}
                className="flex flex-col gap-1"
              >
                <GuideAssignmentCard assignment={cardAssignment} variant="compact" />
                <div className="flex items-center gap-1.5 px-1">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-0 text-[10px] font-semibold",
                      link.relevance_score >= 0.85
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : link.relevance_score >= 0.7
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                    )}
                    title="LLM 매칭 relevance (0~1)"
                  >
                    r {link.relevance_score.toFixed(2)}
                  </span>
                  {link.reasoning && (
                    <span className="line-clamp-2 text-[10px] italic text-[var(--text-tertiary)]">
                      {link.reasoning}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
