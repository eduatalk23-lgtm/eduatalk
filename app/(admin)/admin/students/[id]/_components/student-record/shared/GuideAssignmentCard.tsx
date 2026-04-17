"use client";

import { cn } from "@/lib/cn";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide";
import type { GuideType } from "@/lib/domains/guide/types";
import { Sparkles, User, BookOpen } from "lucide-react";

// ─── 타입 ─────────────────────────────────────────

/**
 * exploration_guide_assignments row(+ exploration_guides join) 의
 * UI 표시용 최소 shape. 기존 Editor 들이 쓰던 느슨한 shape와 호환된다.
 */
export interface GuideAssignmentLike {
  id: string;
  guide_id?: string;
  status: string;
  ai_recommendation_reason?: string | null;
  student_notes?: string | null;
  target_subject_id?: string | null;
  target_activity_type?: string | null;
  school_year?: number;
  exploration_guides?: {
    id: string;
    title: string;
    guide_type?: string;
    /** 셸(queued_generation) 여부 확인용 */
    status?: string;
  };
}

// ─── 파싱 헬퍼 ────────────────────────────────────

/**
 * student_notes 에서 `sim=N.NN` 을 추출한다.
 * phase-s2-edges.ts 포맷: `[AI] 파이프라인 자동 배정 (${match_reason}, sim=${finalScore.toFixed(2)})`.
 * 구조가 없으면 null.
 */
export function parseSimScore(notes?: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/sim=(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const val = Number(m[1]);
  return Number.isFinite(val) ? val : null;
}

/**
 * finalScore(=baseScore×continuityScore) 기반 임계.
 * - baseScore: 1~3 (매칭 축 수)
 * - continuityScore: 0.5~1.0 (12계열 연속성)
 * - finalScore 범위: 0.5~3.0
 *
 * 녹(≥1.8) — 2축+ 매칭이면서 연속성 양호 / 황(≥0.9) — 중립 / 적(<0.9) — 약매칭 or 연속성 경고.
 */
export function simScoreTier(sim: number): "strong" | "medium" | "weak" {
  if (sim >= 1.8) return "strong";
  if (sim >= 0.9) return "medium";
  return "weak";
}

// ─── 상태 도트 색상 ───────────────────────────────

function statusDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500";
    case "submitted":
      return "bg-blue-500";
    case "in_progress":
      return "bg-amber-500";
    case "cancelled":
      return "bg-gray-300";
    default:
      return "bg-indigo-400";
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────

type Variant = "default" | "compact";

export function GuideAssignmentCard({
  assignment,
  variant = "default",
  showSimBadge = false,
  onClick,
}: {
  assignment: GuideAssignmentLike;
  variant?: Variant;
  /** 12계열 연속성 배지(=sim 점수) 표시 여부. 세특/동아리 셀에서 true. */
  showSimBadge?: boolean;
  onClick?: () => void;
}) {
  const guide = assignment.exploration_guides;
  const guideTypeLabel = guide?.guide_type
    ? (GUIDE_TYPE_LABELS[guide.guide_type as GuideType] ?? guide.guide_type)
    : null;
  // 폴백 계층: title(비어있지 않음) → guide_type 라벨 → "(제목 없음)"
  //   이전: `guide?.title ?? "가이드"` — 빈 제목/JOIN 누락 시 "가이드"만 표시되어
  //   어떤 가이드인지 식별 불가 (사용자 피드백 2026-04-17).
  const titleFallback = guideTypeLabel ?? "(제목 없음)";
  const titleText = guide?.title && guide.title.trim().length > 0 ? guide.title : titleFallback;
  const isAi = !!assignment.ai_recommendation_reason;
  const sim = parseSimScore(assignment.student_notes);
  const tier = sim !== null ? simScoreTier(sim) : null;

  // 기본 클릭 — 가이드 상세 새 탭으로 열기 (onClick prop이 없을 때만).
  //   이전: onClick 미제공 시 카드 클릭이 noop → "가이드 열람 플로우 없음" 이슈.
  //   queued_generation 상태 가이드는 본문 없음 → 배지로 안내, 상세 페이지는 접근 허용.
  const guideIdForLink = guide?.id ?? assignment.guide_id ?? null;
  const isQueued = guide?.status === "queued_generation";
  const isAiFailed = guide?.status === "ai_failed";
  const effectiveOnClick =
    onClick ??
    (guideIdForLink
      ? () => window.open(`/admin/guides/${guideIdForLink}`, "_blank", "noopener")
      : undefined);

  const simClass =
    tier === "strong"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : tier === "medium"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={effectiveOnClick}
        disabled={!effectiveOnClick}
        title={effectiveOnClick ? "가이드 상세 열기" : undefined}
        className={cn(
          "flex w-full items-center gap-1.5 rounded border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1 text-left",
          effectiveOnClick && "hover:bg-[var(--bg-tertiary)]",
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(assignment.status))} />
        <span className="truncate text-xs text-[var(--text-primary)]">{titleText}</span>
        {isQueued && (
          <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="본문 생성 대기 중">
            대기
          </span>
        )}
        {isAiFailed && (
          <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300" title="본문 생성 실패 (수동 재시도 필요)">
            실패
          </span>
        )}
        {guideTypeLabel && (
          <span className="ml-auto shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {guideTypeLabel}
          </span>
        )}
        {showSimBadge && sim !== null && (
          <span className={cn("shrink-0 rounded px-1 py-0.5 text-[10px] font-medium", simClass)}>
            {sim.toFixed(2)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-2.5",
        effectiveOnClick && "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/10",
      )}
      onClick={effectiveOnClick}
      role={effectiveOnClick ? "button" : undefined}
      title={effectiveOnClick && !onClick ? "가이드 상세 새 탭으로 열기" : undefined}
    >
      {/* 상단: 배지 열 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(assignment.status))} />
        {guideTypeLabel && (
          <span className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            <BookOpen className="h-2.5 w-2.5" />
            {guideTypeLabel}
          </span>
        )}
        {isQueued && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            title="AI가 메타 설계만 완료한 상태. 본문은 생성 대기 중"
          >
            본문 대기
          </span>
        )}
        {isAiFailed && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
            title="본문 생성 실패 — 상세 페이지에서 수동 재시도"
          >
            본문 실패
          </span>
        )}
        {isAi ? (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            title="AI 파이프라인 배정"
          >
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            title="컨설턴트 수동 배정"
          >
            <User className="h-2.5 w-2.5" />
            수동
          </span>
        )}
        {showSimBadge && sim !== null && (
          <span
            className={cn("ml-auto inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", simClass)}
            title="12계열 연속성 반영 최종 매칭 점수 (baseScore × continuityScore, 범위 0.5~3.0)"
          >
            sim {sim.toFixed(2)}
          </span>
        )}
      </div>
      {/* 제목 */}
      <p className="line-clamp-2 text-xs text-[var(--text-primary)]">{titleText}</p>
    </div>
  );
}
