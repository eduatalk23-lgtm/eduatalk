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
  recentProposalJobsQueryOptions,
} from "@/lib/query-options/studentRecord";
import {
  updateProposalItemDecisionAction,
  type ProposalJobDetailDTO,
  type RecentProposalJobDTO,
} from "@/lib/domains/student-record/actions/diagnosis-helpers";
import {
  deriveConfidenceFromLlmMeta,
  type ConfidenceSelfReport,
} from "@/lib/agents/reliability/confidence-band";

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
  const { data: recentJobs } = useQuery({
    ...recentProposalJobsQueryOptions(studentId, tenantId, 5),
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

            {/* Phase 2: Blueprint tier_plan 요약 */}
            {job.stateSummary?.blueprint && (
              <BlueprintSection blueprint={job.stateSummary.blueprint} />
            )}

            {/* Phase 2: BlueprintGap 상위 3축 */}
            {job.stateSummary?.blueprintGap && (
              <BlueprintGapSection gap={job.stateSummary.blueprintGap} />
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

            {/* Phase 2: 같은 학생 과거 Job 목록 (현 job 제외, 아코디언) */}
            {recentJobs && recentJobs.length > 1 && (
              <PastJobsSection jobs={recentJobs} currentJobId={job.jobId} />
            )}

            {/* Phase 3: LLM 실행 메타데이터 아코디언 */}
            <ExecutionMetadataSection
              engine={job.engine}
              model={job.model}
              costUsd={job.costUsd}
              meta={job.executionMetadata}
            />
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
  const [localRoadmapItemId, setLocalRoadmapItemId] = useState<string | null>(
    item.roadmapItemId,
  );
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
    onSuccess: (result, args) => {
      setLocalDecision(args.decision);
      if (args.decision === "accepted" && result.roadmapItemId) {
        setLocalRoadmapItemId(result.roadmapItemId);
      }
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
        <Field label="근거">
          <div className="flex flex-wrap gap-1">
            {item.evidenceRefs.map((ref, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                title={ref}
              >
                {translateEvidenceRef(ref)}
              </span>
            ))}
          </div>
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

      {/* 로드맵 링크 (수락 시 자동 생성) */}
      {localDecision === "accepted" && localRoadmapItemId && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[var(--text-primary)]">
            로드맵 등록됨
          </span>
          <code className="font-mono text-[var(--text-tertiary)]">
            #{localRoadmapItemId.slice(0, 8)}
          </code>
          <span className="text-[var(--text-tertiary)]">
            · 설계 탭 로드맵 섹션에서 계획/실행 추적 가능
          </span>
        </div>
      )}
      {localDecision === "accepted" && !localRoadmapItemId && (
        <div className="mt-2 text-xs text-yellow-600">
          ⚠ 수락되었으나 로드맵 매핑 실패 — 재수락으로 재시도
        </div>
      )}

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

// ─── Phase 2: Blueprint tier_plan 요약 ───────────────────────

function BlueprintSection({
  blueprint,
}: {
  blueprint: NonNullable<
    NonNullable<ProposalJobDetailDTO>["stateSummary"]
  >["blueprint"];
}) {
  if (!blueprint) return null;
  const { tierThemes, targetUniversityLevel, origin } = blueprint;
  const hasAny =
    tierThemes.foundational ||
    tierThemes.development ||
    tierThemes.advanced ||
    targetUniversityLevel;
  if (!hasAny) return null;

  return (
    <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold text-[var(--text-secondary)]">
          Blueprint — 3단 탐구 계획
        </h4>
        <div className="flex gap-1 text-[10px] text-[var(--text-tertiary)]">
          {origin && (
            <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5">
              {origin}
            </span>
          )}
          {targetUniversityLevel && (
            <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5">
              {targetUniversityLevel}
            </span>
          )}
        </div>
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        <TierCell label="기초" theme={tierThemes.foundational} />
        <TierCell label="심화" theme={tierThemes.development} />
        <TierCell label="고급" theme={tierThemes.advanced} />
      </div>
    </section>
  );
}

function TierCell({
  label,
  theme,
}: {
  label: string;
  theme: string | null;
}) {
  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2">
      <div className="mb-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="text-[11px] text-[var(--text-primary)]">
        {theme ?? (
          <span className="italic text-[var(--text-tertiary)]">미설정</span>
        )}
      </div>
    </div>
  );
}

// ─── Phase 2: BlueprintGap 상위 축 ────────────────────────────

function BlueprintGapSection({
  gap,
}: {
  gap: NonNullable<
    NonNullable<ProposalJobDetailDTO>["stateSummary"]
  >["blueprintGap"];
}) {
  if (!gap) return null;
  const priorityColor =
    gap.priority === "high"
      ? "text-red-600 dark:text-red-400"
      : gap.priority === "medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-[var(--text-secondary)]";
  const PATTERN_KO: Record<
    "insufficient" | "excess" | "mismatch" | "latent",
    string
  > = {
    insufficient: "부족",
    excess: "과잉",
    mismatch: "불일치",
    latent: "잠재",
  };

  return (
    <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold text-[var(--text-secondary)]">
          청사진 GAP{" "}
          <span className={priorityColor}>priority={gap.priority}</span>
        </h4>
        <span className="text-[var(--text-tertiary)]">
          잔여 {gap.remainingSemesters}학기
        </span>
      </header>
      <p className="mb-2 text-[var(--text-primary)]">{gap.summary}</p>
      {gap.topAxisGaps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {gap.topAxisGaps.map((a, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {CODE_KO[a.code] ?? a.code}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                [{PATTERN_KO[a.pattern]}]
              </span>
              <span className="text-[var(--text-secondary)]">
                {a.currentGrade ?? "—"} → {a.targetGrade ?? "—"}
              </span>
              <span className="text-[var(--text-tertiary)]">
                (diff {a.gapSize})
              </span>
              <span className="w-full text-[10px] text-[var(--text-tertiary)]">
                {a.rationale}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Phase 2: 같은 학생 과거 Job 목록 ───────────────────────

function PastJobsSection({
  jobs,
  currentJobId,
}: {
  jobs: RecentProposalJobDTO[];
  currentJobId: string;
}) {
  const past = jobs.filter((j) => j.jobId !== currentJobId);
  if (past.length === 0) return null;

  return (
    <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs">
      <details>
        <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
          과거 제안 이력 ({past.length}건)
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {past.map((j) => {
            const decidedTotal = j.acceptedCount + j.rejectedCount;
            const pending = j.itemCount - decidedTotal;
            return (
              <li
                key={j.jobId}
                className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)]">
                    {formatDate(j.triggeredAt)}
                  </span>
                  <span className="rounded bg-[var(--bg-primary)] px-1 py-0.5 text-[10px]">
                    {j.engine}
                  </span>
                  {j.model && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {j.model}
                    </span>
                  )}
                  <span className="text-[var(--text-primary)]">
                    {j.itemCount}건
                  </span>
                  {j.acceptedCount > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      수락 {j.acceptedCount}
                    </span>
                  )}
                  {j.rejectedCount > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      거절 {j.rejectedCount}
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="text-[var(--text-tertiary)]">
                      미결 {pending}
                    </span>
                  )}
                </div>
                {j.topItemNames.length > 0 && (
                  <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                    {j.topItemNames.join(" / ")}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

// ─── Phase 3: LLM 실행 메타데이터 ─────────────────────────────

function ExecutionMetadataSection({
  engine,
  model,
  costUsd,
  meta,
}: {
  engine: "rule_v1" | "llm_v1";
  model: string | null;
  costUsd: number | null;
  meta: NonNullable<ProposalJobDetailDTO>["executionMetadata"];
}) {
  const hasFallback =
    meta.requestedEngine === "llm_v1" && engine === "rule_v1";
  const confidence = deriveConfidenceFromLlmMeta({
    engine,
    tier: meta.llmTier,
    fallbackOccurred: hasFallback,
    engineError: meta.engineError,
    outputTokens: meta.llmUsage?.outputTokens ?? null,
    elapsedMs: null,
  });
  return (
    <section className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-[var(--text-secondary)]">
          <span>실행 정보</span>
          <ConfidenceBadge report={confidence} />
          {hasFallback && (
            <span className="text-amber-600 dark:text-amber-400">
              (LLM 실패 → rule_v1 fallback)
            </span>
          )}
        </summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          <MetaCell label="실행 엔진" value={engine} />
          <MetaCell
            label="요청 엔진"
            value={meta.requestedEngine ?? "—"}
            muted={meta.requestedEngine === engine}
          />
          <MetaCell label="모델" value={model ?? "—"} />
          <MetaCell label="Tier" value={meta.llmTier ?? "—"} />
          <MetaCell
            label="비용"
            value={
              costUsd === null
                ? "—"
                : costUsd === 0
                  ? "$0"
                  : `$${costUsd.toFixed(4)}`
            }
          />
          <MetaCell
            label="입력 토큰"
            value={
              meta.llmUsage
                ? meta.llmUsage.inputTokens.toLocaleString()
                : "—"
            }
          />
          <MetaCell
            label="출력 토큰"
            value={
              meta.llmUsage
                ? meta.llmUsage.outputTokens.toLocaleString()
                : "—"
            }
          />
          <MetaCell
            label="잔여 학기"
            value={meta.remainingSemesters?.toString() ?? "—"}
          />
          <MetaCell
            label="Perception signals"
            value={meta.triggerSignals?.toString() ?? "—"}
          />
          <MetaCell
            label="Hakjong delta"
            value={
              meta.diffHakjongDelta !== null
                ? `${meta.diffHakjongDelta > 0 ? "+" : ""}${meta.diffHakjongDelta}`
                : "—"
            }
          />
          <MetaCell
            label="역량 변화 축 수"
            value={meta.diffCompetencyChanges?.toString() ?? "—"}
          />
        </dl>
        {meta.engineError && (
          <div className="mt-2 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-semibold">엔진 에러:</span> {meta.engineError}
          </div>
        )}
      </details>
    </section>
  );
}

// ─── M2 Reliability 신뢰도 뱃지 ──────────────────────────────

function ConfidenceBadge({ report }: { report: ConfidenceSelfReport }) {
  const label =
    report.band === "high" ? "신뢰도 높음" : report.band === "medium" ? "신뢰도 중간" : "신뢰도 낮음";
  const color =
    report.band === "high"
      ? "bg-green-500/10 text-green-700 dark:text-green-400"
      : report.band === "medium"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-red-500/10 text-red-700 dark:text-red-400";
  const tooltipLines = [
    `${label} (score ${report.score.toFixed(2)})`,
    report.guidance,
    ...(report.reasons.length > 0
      ? ["", "감점 신호:", ...report.reasons.map((r) => `· ${r.description}`)]
      : []),
  ].join("\n");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}
      title={tooltipLines}
    >
      {label}
    </span>
  );
}

function MetaCell({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-[10px] text-[var(--text-tertiary)]">{label}</dt>
      <dd
        className={
          muted
            ? "text-[11px] text-[var(--text-tertiary)]"
            : "text-[11px] font-medium text-[var(--text-primary)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Phase 2: evidence_refs 한글 번역 ─────────────────────────

const SIGNAL_KO: Record<string, string> = {
  stale_blueprint: "청사진 갱신 필요",
  hakjong_delta: "학종 점수 변화",
  competency_change: "역량 변화",
  new_records: "신규 기록",
  volunteer_hours: "봉사 시간",
  awards: "수상",
  integrity: "출결",
};

const GAP_PATTERN_KO: Record<string, string> = {
  insufficient: "부족",
  excess: "과잉",
  mismatch: "불일치",
  latent: "잠재",
};

function translateEvidenceRef(ref: string): string {
  // signal:<kind>
  if (ref.startsWith("signal:")) {
    const kind = ref.slice("signal:".length);
    return SIGNAL_KO[kind] ?? ref;
  }
  // gap:<axis>:<pattern>  (rule-proposal 가 생성)
  if (ref.startsWith("gap:")) {
    const parts = ref.slice("gap:".length).split(":");
    if (parts.length >= 2) {
      const [code, pattern] = parts;
      const axisKo = CODE_KO[code] ?? code;
      const patternKo = GAP_PATTERN_KO[pattern] ?? pattern;
      return `${axisKo} ${patternKo}`;
    }
  }
  // axis:<code>
  if (ref.startsWith("axis:")) {
    const code = ref.slice("axis:".length);
    return CODE_KO[code] ?? code;
  }
  // record_id 같은 32+자 UUID 는 그대로
  return ref;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
