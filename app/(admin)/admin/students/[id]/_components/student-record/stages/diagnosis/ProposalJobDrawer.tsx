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
import {
  proposalJobDetailQueryOptions,
  perceptionTriggerQueryOptions,
} from "@/lib/query-options/studentRecord";
import {
  updateProposalItemDecisionAction,
  type ProposalJobDetailDTO,
} from "@/lib/domains/student-record/actions/diagnosis-helpers";

interface Props {
  jobId: string | null;
  studentId: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CODE_KO: Record<string, string> = {
  academic_achievement: "학업성취도",
  academic_attitude: "학업태도",
  academic_inquiry: "탐구력",
  career_course_effort: "진로교과 이수노력",
  career_course_achievement: "진로교과 성취도",
  career_exploration: "진로탐색",
  community_collaboration: "협업/소통",
  community_caring: "나눔/배려",
  community_integrity: "성실/규칙준수",
  community_leadership: "리더십",
};

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

export function ProposalJobDrawer({
  jobId,
  studentId,
  tenantId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const { data: job, isLoading } = useQuery({
    ...proposalJobDetailQueryOptions(jobId),
    enabled: !!jobId && open,
  });
  const { data: perception } = useQuery({
    ...perceptionTriggerQueryOptions(studentId, tenantId),
    enabled: open,
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
            {/* Phase 1: 학생 identity + Reward 위치 헤더 */}
            {job.studentInfo && (
              <StudentContextHeader
                info={job.studentInfo}
                state={job.stateSummary}
              />
            )}

            {/* Phase 1: 직전 변화 요약 (OverviewCard 의 delta row 재활용) */}
            {perception?.evaluated && perception.delta && (
              <DeltaSummary delta={perception.delta} />
            )}

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
                  axesMap={job.stateSummary?.competencyAxes ?? {}}
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
  axesMap,
  onDecisionChanged,
}: {
  item: NonNullable<ProposalJobDetailDTO>["items"][number];
  axesMap: Record<string, string | null>;
  onDecisionChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [localDecision, setLocalDecision] = useState(item.studentDecision);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const mutation = useMutation({
    mutationFn: async (args: {
      decision: typeof item.studentDecision;
      feedback?: string | null;
    }) => {
      const result = await updateProposalItemDecisionAction(
        item.id,
        args.decision,
        args.feedback ?? null,
      );
      if (!result.success) throw new Error(result.error ?? "업데이트 실패");
      return result;
    },
    onSuccess: (_, args) => {
      setLocalDecision(args.decision);
      setRejectDialogOpen(false);
      setRejectFeedback("");
      startTransition(() => {
        onDecisionChanged();
      });
    },
  });

  const decide = (d: typeof item.studentDecision) => {
    if (mutation.isPending || localDecision === d) return;
    if (d === "rejected") {
      // Phase 1: 거절 시 이유 필수 입력
      setRejectDialogOpen(true);
      return;
    }
    mutation.mutate({ decision: d });
  };

  const confirmReject = () => {
    const feedback = rejectFeedback.trim();
    if (!feedback) return;
    mutation.mutate({ decision: "rejected", feedback });
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

      {/* Phase 1: 대상 축의 현재 grade 즉시 표시 */}
      <div className="mt-2 flex flex-wrap gap-1">
        {item.targetAxes.map((code) => {
          const grade = axesMap[code] ?? null;
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px]"
            >
              <span className="text-[var(--text-secondary)]">
                {CODE_KO[code] ?? code}
              </span>
              <span
                className={
                  grade
                    ? "font-semibold text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)]"
                }
              >
                {grade ?? "미측정"}
              </span>
            </span>
          );
        })}
      </div>

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

      {/* 기존에 기록된 피드백 표시 (있을 때) */}
      {item.studentFeedback && (
        <Field label="기록된 피드백">
          <span className="italic text-[var(--text-secondary)]">
            {item.studentFeedback}
          </span>
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

      {/* Phase 1: 거절 사유 입력 Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(v) => {
          if (!mutation.isPending) setRejectDialogOpen(v);
        }}
        title="거절 사유"
        description="학습 데이터로 남습니다. 간단히라도 이유를 적어주세요 (필수)"
        size="md"
      >
        <DialogContent>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">
              왜 이 제안이 부적절한가요?
            </span>
            <textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              rows={4}
              placeholder="예: 이미 유사 세특 2건 존재, 진로 도배 우려, 학생 역량 대비 무리한 주제…"
              className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
              autoFocus
              disabled={mutation.isPending}
            />
          </label>
          {mutation.isError && (
            <p className="mt-2 text-xs text-red-500">
              {(mutation.error as Error).message}
            </p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setRejectDialogOpen(false)}
            disabled={mutation.isPending}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={confirmReject}
            disabled={mutation.isPending || rejectFeedback.trim().length === 0}
          >
            {mutation.isPending ? "저장 중…" : "거절 확정"}
          </Button>
        </DialogFooter>
      </Dialog>
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

// ─── Phase 1: 학생 identity + Reward 위치 헤더 ────────────────

function StudentContextHeader({
  info,
  state,
}: {
  info: NonNullable<ProposalJobDetailDTO>["studentInfo"];
  state: NonNullable<ProposalJobDetailDTO>["stateSummary"];
}) {
  if (!info) return null;
  const lineBits: string[] = [];
  if (info.grade !== null) lineBits.push(`${info.grade}학년`);
  if (info.schoolName) lineBits.push(info.schoolName);
  if (info.targetMajor) lineBits.push(`목표: ${info.targetMajor}`);
  if (info.targetSchoolTier) lineBits.push(info.targetSchoolTier);

  return (
    <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {info.name}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">
          {lineBits.join(" · ")}
        </span>
      </div>
      {state?.hakjongScore && (
        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
          <RewardCell label="총점" value={state.hakjongScore.total} big />
          <RewardCell label="학업" value={state.hakjongScore.academic} />
          <RewardCell label="진로" value={state.hakjongScore.career} />
          <RewardCell label="공동체" value={state.hakjongScore.community} />
        </div>
      )}
      {state && (
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          기준: {state.asOfLabel} · 데이터 완결성{" "}
          {Math.round(state.completenessRatio * 100)}%
        </p>
      )}
    </section>
  );
}

function RewardCell({
  label,
  value,
  big,
}: {
  label: string;
  value: number | null;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1">
      <span className="text-[10px] text-[var(--text-tertiary)]">{label}</span>
      <span
        className={`font-semibold text-[var(--text-primary)] ${big ? "text-base" : "text-sm"}`}
      >
        {value === null ? "—" : value.toFixed(0)}
      </span>
    </div>
  );
}

// ─── Phase 1: 직전 변화 summary ─────────────────────────────

function DeltaSummary({
  delta,
}: {
  delta: NonNullable<
    NonNullable<
      Awaited<
        ReturnType<
          typeof import("@/lib/domains/student-record/actions/diagnosis-helpers").fetchPerceptionTriggerResult
        >
      >
    >["delta"]
  >;
}) {
  const chips: string[] = [];
  if (delta.hakjongScoreDelta !== null && delta.hakjongScoreDelta !== 0) {
    const s = delta.hakjongScoreDelta > 0 ? "+" : "";
    chips.push(`학종 ${s}${delta.hakjongScoreDelta}`);
  }
  if (delta.competencyChangeCount > 0)
    chips.push(`역량 ${delta.competencyChangeCount}축`);
  if (delta.newRecordCount > 0) chips.push(`신규 ${delta.newRecordCount}건`);
  if (delta.volunteerHoursDelta > 0)
    chips.push(`봉사 +${delta.volunteerHoursDelta}h`);
  if (delta.awardsAdded > 0) chips.push(`수상 +${delta.awardsAdded}`);
  if (delta.integrityChanged) chips.push("출결 변화");
  if (delta.staleBlueprint) chips.push("⚠ 청사진 stale");
  if (chips.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs">
      <span className="font-semibold text-[var(--text-secondary)]">
        직전 대비
      </span>
      <span className="text-[var(--text-tertiary)]">
        {delta.fromLabel} → {delta.toLabel}
      </span>
      <span className="text-[var(--text-tertiary)]">·</span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[11px] text-[var(--text-primary)]"
          >
            {c}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── 헬퍼 ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
