"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Loader2, ArrowRight, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  studentTopicTrajectoriesQueryOptions,
  gapGuideSuggestionsQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import type { GapSuggestion } from "@/lib/domains/guide/actions/suggest-gap-guides";

const DIFF_COLORS: Record<string, string> = {
  basic: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const DIFF_LABELS: Record<string, string> = {
  basic: "기초",
  intermediate: "발전",
  advanced: "심화",
};

const REASON_LABELS: Record<string, string> = {
  next_step: "다음 단계",
  gap_fill: "난이도 보완",
};

const REASON_COLORS: Record<string, string> = {
  next_step: "text-primary-600 dark:text-primary-400",
  gap_fill: "text-amber-600 dark:text-amber-400",
};

interface GapGuidePanelProps {
  studentId: string;
  studentGrade: number;
  schoolYear: number;
}

export function GapGuidePanel({
  studentId,
  studentGrade,
  schoolYear,
}: GapGuidePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const { data: trajectories } = useQuery(
    studentTopicTrajectoriesQueryOptions(studentId),
  );
  const hasTrajectories = (trajectories ?? []).length > 0;

  const { data: suggestionsRes, isLoading: loadingSuggestions } = useQuery({
    ...gapGuideSuggestionsQueryOptions(studentId),
    enabled: hasTrajectories,
  });
  const suggestions: GapSuggestion[] =
    suggestionsRes?.success ? suggestionsRes.data ?? [] : [];

  const handleExtract = async () => {
    setExtracting(true);
    try {
      // Server Action: 인증 + 할당량 검증
      const { extractTrajectoriesAction } = await import(
        "@/lib/domains/guide/actions/extract-trajectories"
      );
      const authResult = await extractTrajectoriesAction(studentId);
      if (!authResult.success) {
        toast.showError(authResult.error ?? "추출 요청 실패");
        return;
      }

      // API Route: 실제 임베딩 + 추출 (maxDuration=300)
      const res = await fetch("/api/admin/guides/extract-trajectories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.trajectories?.length ?? 0;
        toast.showSuccess(
          `${count}개 클러스터 궤적을 추출했습니다.`,
        );
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all.concat("trajectories", studentId),
        });
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all.concat("gap-suggestions", studentId),
        });
      } else {
        toast.showError("궤적 추출에 실패했습니다.");
      }
    } catch {
      toast.showError("궤적 추출 중 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  const handleAssign = async (suggestion: GapSuggestion) => {
    setAssigningId(suggestion.guideId);
    try {
      const { assignGuideAction } = await import(
        "@/lib/domains/guide/actions/assignment"
      );
      const result = await assignGuideAction({
        studentId,
        guideId: suggestion.guideId,
        schoolYear,
        grade: studentGrade,
      });
      if (result.success) {
        toast.showSuccess(`"${suggestion.title}" 가이드가 배정되었습니다.`);
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all.concat(
            "gap-suggestions",
            studentId,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all.concat("trajectories", studentId),
        });
      } else {
        toast.showError(
          !result.success ? result.error ?? "배정 실패" : "배정 실패",
        );
      }
    } catch {
      toast.showError("가이드 배정 중 오류가 발생했습니다.");
    } finally {
      setAssigningId(null);
    }
  };

  // 궤적도 없고 추천도 없으면 추출 안내만 표시
  if (!hasTrajectories) {
    return (
      <div className="rounded-xl border border-dashed border-secondary-300 dark:border-secondary-600 p-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Compass className="w-6 h-6 text-[var(--text-secondary)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              탐구 궤적이 없습니다
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              생기부 세특에서 탐구 주제를 자동 분석하여 보완 가이드를 추천받을 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {extracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                생기부에서 궤적 분석
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            보완 가이드 추천
          </h3>
          {suggestions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-3xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              {suggestions.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleExtract}
          disabled={extracting}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          {extracting ? "분석 중..." : "궤적 재분석"}
        </button>
      </div>

      {loadingSuggestions && (
        <div className="text-center py-4 text-xs text-[var(--text-secondary)]">
          추천 분석 중...
        </div>
      )}

      {!loadingSuggestions && suggestions.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)] py-2">
          현재 궤적에서 추천할 보완 가이드가 없습니다.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.guideId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary-50 dark:bg-secondary-800/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-3xs font-medium",
                      DIFF_COLORS[s.difficultyLevel] ?? "bg-secondary-200",
                    )}
                  >
                    {DIFF_LABELS[s.difficultyLevel] ?? s.difficultyLevel}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">
                    {s.clusterName}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)] truncate">
                  {s.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={cn(
                      "text-3xs font-medium",
                      REASON_COLORS[s.reason],
                    )}
                  >
                    {REASON_LABELS[s.reason]}
                  </span>
                  {s.sourceTrajectory && (
                    <>
                      <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
                      <span className="text-3xs text-[var(--text-secondary)]">
                        {s.sourceTrajectory.grade}학년{" "}
                        {DIFF_LABELS[s.sourceTrajectory.difficulty]} 기반
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAssign(s)}
                disabled={assigningId === s.guideId}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {assigningId === s.guideId ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                배정
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
