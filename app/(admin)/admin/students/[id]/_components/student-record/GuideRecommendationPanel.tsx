"use client";

// ============================================
// 가이드 추천 패널 — 논의(채팅)에서 가이드 배정으로 연결
// 채팅방의 관심사 태그를 수집 → 가이드 벡터 검색 → 1클릭 배정
// ============================================

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search, Plus, Check, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStudentRecordContext } from "./StudentRecordContext";

interface GuideRecommendationPanelProps {
  roomId: string;
  subjectId: string;
  subjectName: string;
  onClose?: () => void;
}

interface GuideResult {
  guide_id: string;
  title: string;
  guide_type: string;
  book_title: string | null;
  motivation: string | null;
  score: number;
}

export function GuideRecommendationPanel({
  roomId,
  subjectId,
  subjectName,
  onClose,
}: GuideRecommendationPanelProps) {
  const { studentId } = useStudentRecordContext();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  // 채팅방 메시지에서 관심사 태그 수집 (서버 액션 경유)
  const { data: interestKeywords } = useQuery({
    queryKey: ["chat-interest-tags", roomId],
    queryFn: async () => {
      const { fetchChatInterestTagsAction } = await import("@/lib/domains/guide/actions/crud");
      const result = await fetchChatInterestTagsAction(roomId, subjectName);
      return result.success ? result.data : [];
    },
    staleTime: 30_000,
  });

  // 키워드 기반 가이드 텍스트 검색 (서버 액션 경유)
  const effectiveQuery = searchQuery.trim() || (interestKeywords?.join(" ") ?? subjectName);

  const { data: textGuides, isLoading: isSearching } = useQuery({
    queryKey: ["guide-text-search", effectiveQuery],
    queryFn: async () => {
      const { searchGuidesForRecommendationAction } = await import("@/lib/domains/guide/actions/crud");
      const result = await searchGuidesForRecommendationAction(effectiveQuery);
      if (!result.success) return [];
      return result.data.map((g) => ({
        ...g,
        motivation: null,
        score: 0,
      })) as GuideResult[];
    },
    enabled: effectiveQuery.length >= 2,
    staleTime: 30_000,
  });

  const displayGuides = textGuides ?? [];

  // 가이드 배정 mutation
  const assignMutation = useMutation({
    mutationFn: async (guideId: string) => {
      const { assignGuideAction } = await import("@/lib/domains/guide/actions/assignment");
      return assignGuideAction({
        studentId,
        guideId,
        schoolYear: new Date().getFullYear(),
        grade: 0, // StudentRecordContext에서 가져올 수 있음
        targetSubjectId: subjectId,
        notes: `논의에서 추천: ${effectiveQuery}`,
      });
    },
    onSuccess: (_, guideId) => {
      setAssignedIds((prev) => new Set(prev).add(guideId));
      // 가이드 배정 목록 갱신
      queryClient.invalidateQueries({ queryKey: ["guide-assignments"] });
    },
  });

  const guideTypeLabel: Record<string, string> = {
    reading: "독서",
    topic_exploration: "주제탐구",
    subject_performance: "교과",
    experiment: "실험",
    program: "프로그램",
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/20">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">가이드 추천</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30">
            <X className="h-3 w-3 text-indigo-400" />
          </button>
        )}
      </div>

      {/* 관심사 태그 */}
      {interestKeywords && interestKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {interestKeywords.slice(0, 5).map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-indigo-100 px-2 py-0.5 text-3xs font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-indigo-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="관심 주제로 가이드 검색..."
          className="w-full rounded border border-indigo-200 bg-white py-1 pl-7 pr-2 text-xs text-[var(--color-text-primary)] placeholder:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-indigo-700 dark:bg-indigo-950/30"
        />
      </div>

      {/* 결과 */}
      <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          </div>
        ) : displayGuides.length === 0 ? (
          <p className="py-2 text-center text-xs text-indigo-400">
            {effectiveQuery.length < 2 ? "주제를 입력하세요" : "검색 결과 없음"}
          </p>
        ) : (
          displayGuides.map((g) => {
            const isAssigned = assignedIds.has(g.guide_id);
            return (
              <div
                key={g.guide_id}
                className="flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-2 py-1.5 dark:border-indigo-800 dark:bg-indigo-950/30"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{g.title}</p>
                  <p className="text-3xs text-[var(--color-text-tertiary)]">
                    {guideTypeLabel[g.guide_type] ?? g.guide_type}
                    {g.book_title ? ` · ${g.book_title}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isAssigned || assignMutation.isPending}
                  onClick={() => assignMutation.mutate(g.guide_id)}
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-3xs font-medium transition-colors",
                    isAssigned
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-indigo-600 text-white hover:bg-indigo-700",
                  )}
                >
                  {isAssigned ? (
                    <span className="flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> 배정됨</span>
                  ) : assignMutation.isPending ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-0.5"><Plus className="h-2.5 w-2.5" /> 배정</span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
