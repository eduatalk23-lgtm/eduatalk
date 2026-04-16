"use client";

// ============================================
// Phase δ-4 — 메인 탐구 카테고리 점수 편집 (컨설턴트용)
// 10 카테고리 슬라이더 + classifier v0 초안 표시 + 저장
// ============================================

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

interface InquiryCategoryEditorProps {
  /** student_main_explorations.id */
  mainExplorationId: string;
}

interface ActiveMainExplorationResponse {
  success: boolean;
  data?: {
    id: string;
    direction: string;
    themeLabel: string;
    themeKeywords: string[] | null;
    careerField: string | null;
  };
  error?: { code: string; message: string };
}

async function fetchActiveMainExploration(
  studentId: string,
): Promise<{ id: string; direction: string } | null> {
  const res = await fetch(
    `/api/admin/students/${studentId}/active-main-exploration?direction=design`,
  );
  const json = (await res.json()) as ActiveMainExplorationResponse;
  if (!json.success || !json.data) {
    if (res.status === 404) return null;
    throw new Error(json.error?.message ?? "활성 메인 탐구 조회 실패");
  }
  return { id: json.data.id, direction: json.data.direction };
}

/**
 * studentId → active main_exploration → editor 자동 연결 래퍼.
 * 활성 메인 탐구가 없으면 빈 안내 메시지를 표시.
 */
export function InquiryCategoryEditorSection({
  studentId,
}: {
  studentId: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["active-main-exploration", studentId],
    queryFn: () => fetchActiveMainExploration(studentId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] p-4 text-sm text-[var(--text-tertiary)]">
        활성 메인 탐구 조회 중…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4 text-sm text-[var(--text-tertiary)]">
        활성 메인 탐구가 없습니다. 컨설턴트 패널에서 메인 탐구를 먼저 생성하세요.
      </div>
    );
  }

  return <InquiryCategoryEditor mainExplorationId={data.id} />;
}

const CATEGORY_LABELS: Record<string, string> = {
  natural_science: "자연과학",
  life_medical: "생명·의학",
  engineering: "공학",
  it_software: "IT·소프트웨어",
  social_science: "사회과학",
  humanities: "인문학",
  law_policy: "법·정책",
  business_economy: "경영·경제",
  education: "교육",
  arts_sports: "예술·체육",
};

const CATEGORY_ORDER = [
  "natural_science",
  "life_medical",
  "engineering",
  "it_software",
  "social_science",
  "humanities",
  "law_policy",
  "business_economy",
  "education",
  "arts_sports",
] as const;

interface ApiResponse {
  success: boolean;
  data?: {
    mainExplorationId: string;
    themeKeywords: string[] | null;
    careerField: string | null;
    stored: {
      scores: Record<string, number>;
      source: string;
      classifierVersion?: string | null;
      updatedBy?: string | null;
      updatedAt?: string;
    } | null;
    classifierPreview: {
      scores: Record<string, number>;
      reasons: Array<{
        category: string;
        source: string;
        matched: string;
        delta: number;
      }>;
    };
  };
  error?: { code: string; message: string };
}

async function fetchScores(id: string): Promise<ApiResponse["data"]> {
  const res = await fetch(`/api/admin/main-exploration/${id}/inquiry-categories`);
  const json = (await res.json()) as ApiResponse;
  if (!json.success || !json.data) {
    throw new Error(json.error?.message ?? "조회 실패");
  }
  return json.data;
}

async function saveScores(
  id: string,
  scores: Record<string, number>,
): Promise<void> {
  const res = await fetch(`/api/admin/main-exploration/${id}/inquiry-categories`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scores, source: "consultant_override" }),
  });
  const json = (await res.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(json.error?.message ?? "저장 실패");
  }
}

export function InquiryCategoryEditor({ mainExplorationId }: InquiryCategoryEditorProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const queryKey = ["inquiry-categories", mainExplorationId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchScores(mainExplorationId),
    enabled: !!mainExplorationId,
  });

  const initial = useMemo(() => {
    if (!data) return null;
    return data.stored?.scores ?? data.classifierPreview.scores;
  }, [data]);

  const [draft, setDraft] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initial) setDraft({ ...initial });
  }, [initial]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return CATEGORY_ORDER.some(
      (cat) => Math.abs((draft[cat] ?? 0) - (initial[cat] ?? 0)) > 0.001,
    );
  }, [draft, initial]);

  const mutation = useMutation({
    mutationFn: () => saveScores(mainExplorationId, draft),
    onSuccess: () => {
      showSuccess("카테고리 점수 저장 완료");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      showError(err instanceof Error ? err.message : "저장 실패");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] p-4 text-sm text-[var(--text-tertiary)]">
        카테고리 점수 로딩 중…
      </div>
    );
  }

  const sourceLabel = data.stored
    ? data.stored.source === "consultant_override"
      ? "컨설턴트 수동 입력"
      : "AI 자동 분류"
    : "초안 (저장 전)";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            메인 탐구 카테고리 점수 (5축 진단 입력)
          </h4>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            테마: {data.themeKeywords?.join(", ") || "(없음)"} ·
            진로: {data.careerField || "(없음)"}
          </p>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          source: <strong className="text-[var(--text-secondary)]">{sourceLabel}</strong>
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CATEGORY_ORDER.map((cat) => {
          const value = draft[cat] ?? 0;
          const previewValue = data.classifierPreview.scores[cat] ?? 0;
          const isOverride = Math.abs(value - previewValue) > 0.001;
          return (
            <div
              key={cat}
              className="flex items-center gap-3 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] p-2"
            >
              <label className="w-24 shrink-0 text-sm text-[var(--text-secondary)]">
                {CATEGORY_LABELS[cat]}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={value}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [cat]: parseFloat(e.target.value),
                  }))
                }
                className="flex-1"
              />
              <span
                className={cn(
                  "w-12 text-right text-sm tabular-nums",
                  isOverride
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "text-[var(--text-tertiary)]",
                )}
              >
                {value.toFixed(2)}
              </span>
              <span className="w-10 text-right text-xs text-[var(--text-tertiary)]">
                AI {previewValue.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => initial && setDraft({ ...initial })}
          className="rounded border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:opacity-50"
        >
          되돌리기
        </button>
        <button
          type="button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
