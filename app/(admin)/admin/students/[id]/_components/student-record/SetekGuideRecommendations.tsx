"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { autoRecommendGuidesAction } from "@/lib/domains/guide/actions/auto-recommend";
import { assignGuideAction } from "@/lib/domains/guide/actions/assignment";
import { explorationGuideKeys } from "@/lib/query-options/explorationGuide";
import type { RecommendedGuide } from "@/lib/domains/guide/actions/auto-recommend";

interface SetekGuideRecommendationsProps {
  studentId: string;
  schoolYear: number;
  studentGrade: number;
  schoolName?: string;
  classificationId?: number | null;
  subjectName?: string | null;
  assignedGuideIds: Set<string>;
  onAssigned: () => void;
}

const REASON_LABELS: Record<string, string> = {
  both: "분류+과목",
  classification: "분류",
  subject: "과목",
};

export function SetekGuideRecommendations({
  studentId,
  schoolYear,
  studentGrade,
  schoolName,
  classificationId,
  subjectName,
  assignedGuideIds,
  onAssigned,
}: SetekGuideRecommendationsProps) {
  const queryClient = useQueryClient();
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const { data: result, isLoading } = useQuery({
    queryKey: [...explorationGuideKeys.all, "autoRecommend", studentId, classificationId, subjectName],
    queryFn: () => autoRecommendGuidesAction({ studentId, classificationId, subjectName }),
    staleTime: 5 * 60_000,
    enabled: !!studentId && (!!classificationId || !!subjectName),
  });

  const guides = result?.success && result.data
    ? result.data.filter((g) => !assignedGuideIds.has(g.id))
    : [];

  async function handleAssign(guide: RecommendedGuide) {
    setAssigningId(guide.id);
    try {
      const res = await assignGuideAction({
        studentId,
        guideId: guide.id,
        schoolYear,
        grade: studentGrade,
        schoolName,
      });
      if (res.success) {
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.assignments(studentId, schoolYear),
        });
        queryClient.invalidateQueries({
          queryKey: [...explorationGuideKeys.all, "autoRecommend", studentId],
        });
        onAssigned();
      }
    } finally {
      setAssigningId(null);
    }
  }

  if (!classificationId && !subjectName) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--border-secondary)] p-3">
        <p className="text-center text-xs text-[var(--text-tertiary)]">
          진로 방향을 설정하면 맞춤 가이드를 추천합니다
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-tertiary)]" />
        <span className="text-xs text-[var(--text-tertiary)]">추천 가이드 검색 중...</span>
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--border-secondary)] p-3">
        <p className="text-center text-xs text-[var(--text-tertiary)]">
          이 분류에 해당하는 추천 가이드가 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          추천 가이드 ({guides.length})
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {guides.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-950/20"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{g.title}</p>
              <div className="flex items-center gap-1.5">
                {g.guide_type && (
                  <span className="text-3xs text-[var(--text-tertiary)]">{g.guide_type}</span>
                )}
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {REASON_LABELS[g.match_reason] ?? g.match_reason}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleAssign(g)}
              disabled={assigningId === g.id}
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-3xs font-medium",
                assigningId === g.id
                  ? "bg-bg-tertiary text-text-tertiary"
                  : "bg-indigo-500 text-white hover:bg-indigo-600",
              )}
            >
              {assigningId === g.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "배정"
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
