"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp, Globe, Loader2, Play, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { GUIDE_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, DifficultyLevel } from "@/lib/domains/guide/types";
import type { PendingAiGuideItem, AiGuideQueueStatus } from "@/lib/domains/guide/actions/crud";
import {
  bulkUpdateGuidesStatusAction,
  approveAndPromoteGuideAction,
} from "@/lib/domains/guide/actions/crud";

const STATUS_TABS: Array<{ key: AiGuideQueueStatus; label: string }> = [
  { key: "pending_approval", label: "승인 대기" },
  { key: "queued_generation", label: "본문 생성 대기" },
  { key: "ai_failed", label: "생성 실패" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaExpander({ meta }: { meta: PendingAiGuideItem["ai_generation_meta"] }) {
  const [open, setOpen] = useState(false);
  if (!meta) return null;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        설계 메타
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 rounded border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-2 text-[11px] text-[var(--text-secondary)]">
          {meta.subjectConnect && (
            <div><span className="font-medium text-[var(--text-primary)]">연계 교과:</span> {meta.subjectConnect}</div>
          )}
          {meta.storylineConnect && (
            <div><span className="font-medium text-[var(--text-primary)]">스토리라인:</span> {meta.storylineConnect}</div>
          )}
          {meta.keyTopics?.length ? (
            <div className="flex flex-wrap gap-1">
              <span className="font-medium text-[var(--text-primary)]">핵심 토픽:</span>
              {meta.keyTopics.map((t) => (
                <span key={t} className="rounded bg-indigo-100 px-1 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {meta.rationale && (
            <div><span className="font-medium text-[var(--text-primary)]">설계 이유:</span> {meta.rationale}</div>
          )}
          {meta.designGrade && (
            <div><span className="font-medium text-[var(--text-primary)]">설계 학년:</span> {meta.designGrade}학년</div>
          )}
          {meta.overallStrategy && (
            <div><span className="font-medium text-[var(--text-primary)]">전체 전략:</span> {meta.overallStrategy}</div>
          )}
        </div>
      )}
    </div>
  );
}

function GuideRow({
  guide,
  status,
  onAction,
}: {
  guide: PendingAiGuideItem;
  status: AiGuideQueueStatus;
  onAction: (id: string, action: "approve" | "reject" | "promote") => void;
}) {
  const router = useRouter();
  const typeLabel = GUIDE_TYPE_LABELS[guide.guide_type as GuideType] ?? guide.guide_type;
  const diffLabel = guide.difficulty_level
    ? (DIFFICULTY_LABELS[guide.difficulty_level as DifficultyLevel] ?? guide.difficulty_level)
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {typeLabel}
            </span>
            {diffLabel && (
              <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {diffLabel}
              </span>
            )}
            {guide.student_name && (
              <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {guide.student_name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)] leading-snug">
            {guide.title}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {formatDate(guide.created_at)}
          </p>
          <MetaExpander meta={guide.ai_generation_meta} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="가이드 편집"
            onClick={() => router.push(`/admin/guides/${guide.id}`)}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          {status === "pending_approval" && (
            <>
              <button
                type="button"
                title="거부 (archived)"
                onClick={() => onAction(guide.id, "reject")}
                className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="승인 (approved)"
                onClick={() => onAction(guide.id, "approve")}
                className="rounded p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="승인 + 공용 풀 승격"
                onClick={() => onAction(guide.id, "promote")}
                className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20"
              >
                <Globe className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface BulkGenerationProgress {
  total: number;
  done: number;
  failed: number;
  currentTitle: string | null;
}

export function PendingApprovalClient({
  initialGuides,
  status,
  counts,
}: {
  initialGuides: PendingAiGuideItem[];
  status: AiGuideQueueStatus;
  counts: Record<AiGuideQueueStatus, number>;
}) {
  const router = useRouter();
  const [guides, setGuides] = useState(initialGuides);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkGenerationProgress | null>(null);
  const [bulkAbort, setBulkAbort] = useState(false);

  const showBulkButton = status === "queued_generation" || status === "ai_failed";
  const bulkRunning = bulkProgress !== null && bulkProgress.done + bulkProgress.failed < bulkProgress.total;

  function handleAction(id: string, action: "approve" | "reject" | "promote") {
    startTransition(async () => {
      setError(null);

      if (action === "promote") {
        const res = await approveAndPromoteGuideAction(id);
        if (res.success) {
          setGuides((prev) => prev.filter((g) => g.id !== id));
        } else {
          setError(("error" in res ? res.error : null) ?? "공용 승격에 실패했습니다.");
        }
        return;
      }

      const newStatus = action === "approve" ? "approved" : "archived";
      const res = await bulkUpdateGuidesStatusAction([id], newStatus);
      if (res.success) {
        setGuides((prev) => prev.filter((g) => g.id !== id));
      } else {
        setError(("error" in res ? res.error : null) ?? "상태 변경에 실패했습니다.");
      }
    });
  }

  async function runBulkGeneration() {
    if (guides.length === 0 || bulkRunning) return;
    setError(null);
    setBulkAbort(false);
    const targets = [...guides];
    setBulkProgress({ total: targets.length, done: 0, failed: 0, currentTitle: null });

    let done = 0;
    let failed = 0;

    for (const g of targets) {
      if (bulkAbort) break;
      setBulkProgress({ total: targets.length, done, failed, currentTitle: g.title });
      try {
        const res = await fetch("/api/admin/pipeline/ai-guide-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guideId: g.id }),
        });
        if (res.ok) {
          done += 1;
          setGuides((prev) => prev.filter((x) => x.id !== g.id));
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setBulkProgress({ total: targets.length, done, failed, currentTitle: null });
    }

    // 최종 상태 유지 (사용자가 결과 확인 가능)
    setBulkProgress({ total: targets.length, done, failed, currentTitle: null });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-[var(--border-secondary)]">
        {STATUS_TABS.map((tab) => {
          const active = tab.key === status;
          const count = counts[tab.key] ?? 0;
          return (
            <Link
              key={tab.key}
              href={
                tab.key === "pending_approval"
                  ? "/admin/guides/pending-approval"
                  : `/admin/guides/pending-approval?status=${tab.key}`
              }
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-indigo-500 text-[var(--text-primary)] font-medium"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  active
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 일괄 본문 생성 버튼 (queued/ai_failed 탭) */}
      {showBulkButton && guides.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
          <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
            <div>
              일괄 본문 생성은 한 건씩 순차 호출됩니다. 1건당 1~3분 소요되며, 창을 닫으면 중단됩니다.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {bulkRunning && (
              <button
                type="button"
                onClick={() => setBulkAbort(true)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              >
                중단
              </button>
            )}
            <button
              type="button"
              onClick={runBulkGeneration}
              disabled={bulkRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {bulkRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {bulkRunning ? "실행 중..." : `${guides.length}건 일괄 본문 생성`}
            </button>
          </div>
        </div>
      )}

      {bulkProgress && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center justify-between">
            <span>
              진행 {bulkProgress.done + bulkProgress.failed} / {bulkProgress.total}
              {bulkProgress.failed > 0 && ` (실패 ${bulkProgress.failed})`}
            </span>
            {bulkRunning && bulkProgress.currentTitle && (
              <span className="text-amber-700 dark:text-amber-300 truncate max-w-[50%]">
                처리 중: {bulkProgress.currentTitle}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={cn("flex flex-col gap-3", isPending && "opacity-60 pointer-events-none")}>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        {guides.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-6 py-12 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-500 opacity-60" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {status === "pending_approval"
                ? "승인 대기 중인 AI 가이드가 없습니다."
                : status === "queued_generation"
                  ? "본문 생성 대기 중인 셸 가이드가 없습니다."
                  : "생성에 실패한 가이드가 없습니다."}
            </p>
          </div>
        ) : (
          guides.map((guide) => (
            <GuideRow key={guide.id} guide={guide} status={status} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
