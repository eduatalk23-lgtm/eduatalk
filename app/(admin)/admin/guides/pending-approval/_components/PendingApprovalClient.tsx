"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { GUIDE_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, DifficultyLevel } from "@/lib/domains/guide/types";
import type { PendingAiGuideItem } from "@/lib/domains/guide/actions/crud";
import {
  bulkUpdateGuidesStatusAction,
  approveAndPromoteGuideAction,
} from "@/lib/domains/guide/actions/crud";

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
  onAction,
}: {
  guide: PendingAiGuideItem;
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
        </div>
      </div>
    </div>
  );
}

export function PendingApprovalClient({ initialGuides }: { initialGuides: PendingAiGuideItem[] }) {
  const [guides, setGuides] = useState(initialGuides);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(id: string, action: "approve" | "reject" | "promote") {
    startTransition(async () => {
      setError(null);

      if (action === "promote") {
        const res = await approveAndPromoteGuideAction(id);
        if (res.success) {
          setGuides((prev) => prev.filter((g) => g.id !== id));
        } else {
          setError("error" in res ? res.error : "공용 승격에 실패했습니다.");
        }
        return;
      }

      const status = action === "approve" ? "approved" : "archived";
      const res = await bulkUpdateGuidesStatusAction([id], status);
      if (res.success) {
        setGuides((prev) => prev.filter((g) => g.id !== id));
      } else {
        setError("error" in res ? res.error : "상태 변경에 실패했습니다.");
      }
    });
  }

  if (guides.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-6 py-12 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-emerald-500 opacity-60" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">승인 대기 중인 AI 가이드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", isPending && "opacity-60 pointer-events-none")}>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      {guides.map((guide) => (
        <GuideRow key={guide.id} guide={guide} onAction={handleAction} />
      ))}
    </div>
  );
}
