"use client";

// ============================================
// α4 Proposal Job Drawer (Sprint 3, 2026-04-20)
//
// OverviewCard 배너 클릭 시 열리는 상세 Dialog. 3~5 item 전체 표시.
//   - rank, name, summary, targetArea/Axes, roadmapArea, horizon
//   - rationale, expectedImpact(axisMovements), prerequisite, risks, evidenceRefs
//   - 학생 결정 mutation: accepted / rejected / deferred (Sprint 4 수락률 측정 기반)
//
// admin/consultant 가 컨설팅 대리 기록 용. 실제 학생 UI 는 Chat-First Shell 이후.
// ============================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { proposalJobDetailQueryOptions } from "@/lib/query-options/studentRecord";
import { updateProposalItemDecisionAction } from "@/lib/domains/student-record/actions/diagnosis-helpers";

interface Props {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AREA_KO = {
  academic: "학업",
  career: "진로",
  community: "공동체",
} as const;

const HORIZON_KO = {
  immediate: "즉시",
  this_semester: "이번 학기",
  next_semester: "다음 학기",
  long_term: "장기",
} as const;

const DECISION_KO = {
  pending: "보류",
  accepted: "수락",
  rejected: "거절",
  executed: "실행 완료",
  deferred: "연기",
} as const;

export function ProposalJobDrawer({ jobId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: job, isLoading } = useQuery({
    ...proposalJobDetailQueryOptions(jobId),
    enabled: !!jobId && open,
  });

  const title =
    job && job.items.length > 0
      ? `활동 제안 ${job.items.length}건 (${job.engine})`
      : "활동 제안";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        job
          ? `${formatDate(job.triggeredAt)} · severity=${job.severity} · gap=${job.gapPriority ?? "—"}${job.costUsd !== null && job.costUsd > 0 ? ` · 비용 $${job.costUsd.toFixed(4)}` : ""}`
          : "상세 정보 불러오는 중"
      }
      size="3xl"
    >
      <DialogContent>
        {isLoading && (
          <p className="text-sm text-[var(--text-tertiary)]">
            상세 정보 불러오는 중…
          </p>
        )}
        {!isLoading && !job && (
          <p className="text-sm text-[var(--text-tertiary)]">
            상세 정보를 불러오지 못했습니다.
          </p>
        )}
        {job && (
          <div className="flex flex-col gap-3">
            {job.perceptionReasons.length > 0 && (
              <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs">
                <h4 className="mb-1 font-semibold text-[var(--text-secondary)]">
                  Perception 판정 근거
                </h4>
                <ul className="list-disc pl-5 text-[var(--text-primary)]">
                  {job.perceptionReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>
            )}

            <ol className="flex flex-col gap-3">
              {job.items.map((it) => (
                <ProposalItemCard
                  key={it.id}
                  item={it}
                  onDecisionChanged={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["studentRecord"],
                    });
                  }}
                />
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          닫기
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── 개별 아이템 카드 ─────────────────────────────────────────

function ProposalItemCard({
  item,
  onDecisionChanged,
}: {
  item: NonNullable<
    Awaited<
      ReturnType<
        typeof import("@/lib/domains/student-record/actions/diagnosis-helpers").fetchProposalJobDetail
      >
    >
  >["items"][number];
  onDecisionChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [localDecision, setLocalDecision] = useState(item.studentDecision);

  const mutation = useMutation({
    mutationFn: async (decision: typeof item.studentDecision) => {
      const result = await updateProposalItemDecisionAction(item.id, decision);
      if (!result.success) throw new Error(result.error ?? "업데이트 실패");
      return result;
    },
    onSuccess: (_, decision) => {
      setLocalDecision(decision);
      startTransition(() => {
        onDecisionChanged();
      });
    },
  });

  const decide = (d: typeof item.studentDecision) => {
    if (mutation.isPending || localDecision === d) return;
    mutation.mutate(d);
  };

  return (
    <li className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-primary)] pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-[var(--text-tertiary)]">
            #{item.rank}
          </span>
          <h5 className="font-semibold text-[var(--text-primary)]">
            {item.name}
          </h5>
        </div>
        <div className="flex flex-wrap gap-1">
          <TagChip>{AREA_KO[item.targetArea]}</TagChip>
          <TagChip>{HORIZON_KO[item.horizon]}</TagChip>
          <TagChip>{item.roadmapArea}</TagChip>
          <TagChip tone={localDecision === "pending" ? "muted" : "primary"}>
            {DECISION_KO[localDecision]}
          </TagChip>
        </div>
      </header>

      <p className="mt-2 text-[var(--text-primary)]">{item.summary}</p>

      <Field label="근거">{item.rationale}</Field>

      {item.expectedImpact.axisMovements.length > 0 && (
        <Field label="기대 영향">
          <ul className="list-disc pl-5">
            {item.expectedImpact.axisMovements.map((m, i) => (
              <li key={i}>
                <code className="text-xs">{m.code}</code>: {m.fromGrade ?? "—"}{" "}
                → <strong>{m.toGrade}</strong>
              </li>
            ))}
            {item.expectedImpact.hakjongScoreDelta !== null && (
              <li>
                학종 Reward {item.expectedImpact.hakjongScoreDelta > 0 ? "+" : ""}
                {item.expectedImpact.hakjongScoreDelta}점 추정
              </li>
            )}
          </ul>
        </Field>
      )}

      {item.prerequisite.length > 0 && (
        <Field label="선행 조건">
          <ul className="list-disc pl-5">
            {item.prerequisite.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Field>
      )}

      {item.risks.length > 0 && (
        <Field label="위험">
          <ul className="list-disc pl-5 text-amber-600 dark:text-amber-400">
            {item.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Field>
      )}

      {item.evidenceRefs.length > 0 && (
        <Field label="근거 ref">
          <code className="block text-xs text-[var(--text-tertiary)]">
            {item.evidenceRefs.join(", ")}
          </code>
        </Field>
      )}

      {/* 학생 결정 (admin 대리) */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] pt-2">
        <span className="text-xs text-[var(--text-tertiary)]">컨설턴트 판정:</span>
        <DecisionButton
          active={localDecision === "accepted"}
          disabled={isPending || mutation.isPending}
          onClick={() => decide("accepted")}
        >
          수락
        </DecisionButton>
        <DecisionButton
          active={localDecision === "deferred"}
          disabled={isPending || mutation.isPending}
          onClick={() => decide("deferred")}
        >
          보류
        </DecisionButton>
        <DecisionButton
          active={localDecision === "rejected"}
          disabled={isPending || mutation.isPending}
          onClick={() => decide("rejected")}
        >
          거절
        </DecisionButton>
        {mutation.isError && (
          <span className="text-xs text-red-500">
            {(mutation.error as Error).message}
          </span>
        )}
      </div>
    </li>
  );
}

// ─── 보조 UI 원소 ─────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 text-sm">
      <div className="mb-0.5 text-xs font-semibold text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

function TagChip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "primary" | "muted";
}) {
  const toneCls =
    tone === "primary"
      ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200"
      : tone === "muted"
        ? "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-tertiary)]"
        : "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${toneCls}`}
    >
      {children}
    </span>
  );
}

function DecisionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-0.5 text-xs transition-colors ${
        active
          ? "border-primary-500 bg-primary-500 text-white"
          : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

// ─── 헬퍼 ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
