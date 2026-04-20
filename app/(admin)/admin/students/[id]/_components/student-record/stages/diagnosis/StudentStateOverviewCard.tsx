"use client";

// ============================================
// α1-6: StudentState Overview Card
//
// 진단 탭 상단에서 학생의 현재 상태 스냅샷(α1-3~α1-5)을 한 화면에 요약.
//   - completenessRatio 배지 (0~100%)
//   - layer_flags 9 비트 비주얼 (L0/L1/L2/L3 + aux 4 + blueprint)
//   - areaCompleteness 3축 (academic/career/community) 미니 바
//   - aux 요약 (volunteer/awards/attendance/reading)
//
// 데이터 출처: student_state_snapshots (α1-3-d daily cron 또는 파이프라인 완료 훅).
// snapshot 부재 시 placeholder 렌더 (신규 학생 / 스냅샷 미빌드 상태).
// ============================================

import { useQuery } from "@tanstack/react-query";
import {
  studentStateQueryOptions,
  perceptionTriggerQueryOptions,
} from "@/lib/query-options/studentRecord";
import type { PerceptionBadgeDTO } from "@/lib/domains/student-record/actions/diagnosis-helpers";
import {
  SNAPSHOT_LAYER_FLAGS,
  type StudentState,
  type HakjongScore,
} from "@/lib/domains/student-record/types/student-state";
import type {
  BlueprintGap,
  AreaGap,
  AxisGap,
  GapPattern,
  MultiScenarioBlueprintGap,
  ScenarioType,
} from "@/lib/domains/student-record/types/blueprint-gap";

interface Props {
  studentId: string;
  tenantId: string;
}

const LAYER_FLAG_LABELS: ReadonlyArray<{
  key: keyof typeof SNAPSHOT_LAYER_FLAGS;
  short: string;
  title: string;
}> = [
  { key: "LAYER0", short: "L0", title: "프로필 카드" },
  { key: "LAYER1", short: "L1", title: "역량 축 (10축)" },
  { key: "LAYER2", short: "L2", title: "하이퍼엣지 테마" },
  { key: "LAYER3", short: "L3", title: "서사 플로우" },
  { key: "AUX_VOLUNTEER", short: "봉", title: "봉사" },
  { key: "AUX_AWARDS", short: "수", title: "수상" },
  { key: "AUX_ATTENDANCE", short: "출", title: "출결" },
  { key: "AUX_READING", short: "독", title: "독서" },
  { key: "BLUEPRINT", short: "청", title: "청사진" },
];

export function StudentStateOverviewCard({ studentId, tenantId }: Props) {
  const { data: snapshot, isLoading } = useQuery(
    studentStateQueryOptions(studentId, tenantId),
  );
  const { data: perception } = useQuery(
    perceptionTriggerQueryOptions(studentId, tenantId),
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-tertiary)]">
          학생 상태 스냅샷 불러오는 중…
        </p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <header className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            학생 상태 스냅샷
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">α1-6</span>
        </header>
        <p className="text-xs text-[var(--text-tertiary)]">
          아직 저장된 스냅샷이 없습니다. 파이프라인 실행 또는 야간 크론(03:30 KST) 이후 생성됩니다.
        </p>
      </div>
    );
  }

  const state = snapshot.snapshot_data as unknown as StudentState | null;
  const completenessPct = Math.round(snapshot.completeness_ratio * 100);

  return (
    <article className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-primary)] pb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            학생 상태 스냅샷
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {snapshot.as_of_label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state?.hakjongScore && <HakjongTotalBadge score={state.hakjongScore} />}
          {state?.hakjongScore && state?.hakjongScoreV2Pre && (
            <HakjongV2PreDeltaBadge
              v1={state.hakjongScore}
              v2Pre={state.hakjongScoreV2Pre}
            />
          )}
          {perception && <PerceptionBadge dto={perception} />}
          <CompletenessBadge pct={completenessPct} />
        </div>
      </header>

      {state?.hakjongScore && (
        <HakjongAreaRow
          score={state.hakjongScore}
          v2Pre={state.hakjongScoreV2Pre ?? null}
        />
      )}

      {state?.blueprintGap && <BlueprintGapSection gap={state.blueprintGap} />}

      {state?.multiScenarioGap && (
        <ScenarioCompareSection multi={state.multiScenarioGap} />
      )}

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LayerFlagsRow flags={snapshot.layer_flags} />
        {state && <AreaCompletenessRow state={state} />}
      </div>

      {state && <AuxSummaryGrid state={state} />}

      <footer className="mt-3 flex flex-wrap gap-3 border-t border-[var(--border-primary)] pt-2 text-xs text-[var(--text-tertiary)]">
        <span>빌드 시각 {formatBuiltAt(snapshot.built_at)}</span>
        <span>builder {snapshot.builder_version}</span>
        {snapshot.has_stale_layer && (
          <span className="text-amber-600 dark:text-amber-400">⚠ stale layer</span>
        )}
      </footer>
    </article>
  );
}

// ─── 서브 컴포넌트 ───────────────────────────────────────

function HakjongTotalBadge({ score }: { score: HakjongScore }) {
  if (score.total === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
        title="3 영역 모두 ≥ 2 축 필요"
      >
        Reward —
      </span>
    );
  }
  const pct = Math.round(score.total);
  const tone =
    pct >= 80 ? "emerald" : pct >= 65 ? "blue" : pct >= 50 ? "amber" : "red";
  const bgByTone = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bgByTone}`}
      title={`학종 Reward v1 (conf ${Math.round(score.confidence.total * 100)}%)`}
    >
      Reward {pct}
    </span>
  );
}

// α2 v2-pre (2026-04-20): aux 연속 기여 버전 total delta 배지.
// v1/v2-pre 둘 다 total 있어야 노출. 없으면 숨김.
function HakjongV2PreDeltaBadge({
  v1,
  v2Pre,
}: {
  v1: HakjongScore;
  v2Pre: HakjongScore;
}) {
  if (v1.total === null || v2Pre.total === null) return null;
  const delta = Math.round((v2Pre.total - v1.total) * 10) / 10;
  const pct = Math.round(v2Pre.total);
  const tone = delta > 0 ? "emerald" : delta < 0 ? "red" : "gray";
  const bgByTone = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    gray: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${bgByTone}`}
      title={`α2 v2-pre (aux 연속 기여): total ${pct} (v1 대비 ${delta > 0 ? "+" : ""}${delta})`}
    >
      v2-pre {pct}
      {delta !== 0 && (
        <span className="opacity-70">
          ({delta > 0 ? "+" : ""}{delta})
        </span>
      )}
    </span>
  );
}

function HakjongAreaRow({
  score,
  v2Pre,
}: {
  score: HakjongScore;
  v2Pre: HakjongScore | null;
}) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
      <HakjongAreaCell
        label="학업 30%"
        value={score.academic}
        conf={score.confidence.academic}
        v2Value={v2Pre?.academic ?? null}
      />
      <HakjongAreaCell
        label="진로 40%"
        value={score.career}
        conf={score.confidence.career}
        v2Value={v2Pre?.career ?? null}
      />
      <HakjongAreaCell
        label="공동체 30%"
        value={score.community}
        conf={score.confidence.community}
        v2Value={v2Pre?.community ?? null}
      />
    </div>
  );
}

function HakjongAreaCell({
  label,
  value,
  conf,
  v2Value,
}: {
  label: string;
  value: number | null;
  conf: number;
  v2Value: number | null;
}) {
  const v2Delta =
    value !== null && v2Value !== null
      ? Math.round((v2Value - value) * 10) / 10
      : null;
  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {value !== null ? Math.round(value) : "—"}
        {value !== null && (
          <span className="ml-1 text-[10px] font-normal text-[var(--text-tertiary)]">
            / 100 · conf {Math.round(conf * 100)}%
          </span>
        )}
      </p>
      {v2Value !== null && v2Delta !== null && (
        <p
          className="text-[10px] text-[var(--text-tertiary)] tabular-nums"
          title="α2 v2-pre: aux 연속 기여 버전 (공동체 영역에만 실효 차이)"
        >
          v2-pre {Math.round(v2Value)}
          {v2Delta !== 0 && (
            <span className={v2Delta > 0 ? "ml-1 text-emerald-600 dark:text-emerald-400" : "ml-1 text-red-600 dark:text-red-400"}>
              ({v2Delta > 0 ? "+" : ""}{v2Delta})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// α4 (2026-04-20 C): snapshot 2개 비교 기반 Perception Trigger 결과.
//   evaluated=false (snapshot < 2) → 렌더 안 함.
//   triggered=false → 조용한 회색 "변화 없음".
//   triggered=true → severity 색상 + title 에 reasons 나열.
function PerceptionBadge({ dto }: { dto: PerceptionBadgeDTO }) {
  if (!dto.evaluated) return null;
  if (!dto.triggered) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
        title="이전 snapshot 대비 유의미한 변화 없음"
      >
        Perception —
      </span>
    );
  }
  const tone =
    dto.severity === "high" ? "red" : dto.severity === "medium" ? "amber" : "blue";
  const bgByTone = {
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  }[tone];
  const severityLabel =
    dto.severity === "high" ? "HIGH" : dto.severity === "medium" ? "MED" : "LOW";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${bgByTone}`}
      title={dto.reasons.length > 0 ? dto.reasons.join("\n") : "자율 Agent 재평가 권장"}
    >
      Perception {severityLabel}
    </span>
  );
}

function CompletenessBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 80 ? "emerald" : pct >= 50 ? "blue" : pct >= 20 ? "amber" : "gray";
  const bgByTone = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    gray: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bgByTone}`}
    >
      완결성 {pct}%
    </span>
  );
}

function LayerFlagsRow({ flags }: { flags: number }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        레이어 시그널 (9축)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LAYER_FLAG_LABELS.map((item) => {
          const active = (flags & SNAPSHOT_LAYER_FLAGS[item.key]) !== 0;
          return (
            <span
              key={item.key}
              title={item.title}
              className={`inline-flex min-w-[28px] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                active
                  ? "bg-emerald-500 text-white dark:bg-emerald-600"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
              }`}
            >
              {item.short}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AreaCompletenessRow({ state }: { state: StudentState }) {
  const completeness = state.metadata?.areaCompleteness;
  const computable = state.metadata?.hakjongScoreComputable;
  if (!completeness || !computable) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        영역별 채움률 (Layer1 + aux 가중)
      </p>
      <div className="flex flex-col gap-1.5">
        <AreaBar label="학업" pct={completeness.academic} ok={computable.academic} />
        <AreaBar label="진로" pct={completeness.career} ok={computable.career} />
        <AreaBar label="공동체" pct={completeness.community} ok={computable.community} />
      </div>
    </div>
  );
}

function AreaBar({
  label,
  pct,
  ok,
}: {
  label: string;
  pct: number;
  ok: boolean;
}) {
  const displayPct = Math.round(pct * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-[var(--text-secondary)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${Math.max(2, displayPct)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right tabular-nums text-[var(--text-tertiary)]">
        {displayPct}% {ok ? "" : "·측정불가"}
      </span>
    </div>
  );
}

function AuxSummaryGrid({ state }: { state: StudentState }) {
  const aux = state.aux;
  if (!aux) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <AuxCell
        label="봉사"
        primary={aux.volunteer ? `${aux.volunteer.totalHours}시간` : "—"}
        secondary={
          aux.volunteer?.recurringThemes?.length
            ? aux.volunteer.recurringThemes.slice(0, 2).join(" · ")
            : null
        }
      />
      <AuxCell
        label="수상"
        primary={aux.awards ? `${aux.awards.items.length}건` : "—"}
        secondary={
          aux.awards?.items?.length
            ? aux.awards.items[0].name.slice(0, 16)
            : null
        }
      />
      <AuxCell
        label="출결"
        primary={
          aux.attendance?.integrityScore != null
            ? `무결성 ${aux.attendance.integrityScore}`
            : "—"
        }
        secondary={
          aux.attendance?.flags?.length
            ? aux.attendance.flags[0]
            : null
        }
        tone={
          aux.attendance?.flags?.length
            ? "warn"
            : aux.attendance?.integrityScore != null
              ? "ok"
              : "muted"
        }
      />
      <AuxCell
        label="독서"
        primary={aux.reading ? `${aux.reading.totalBooks}권` : "—"}
        secondary={
          aux.reading?.lastReadAt
            ? `최근 ${aux.reading.lastReadAt.slice(0, 10)}`
            : null
        }
      />
    </div>
  );
}

function AuxCell({
  label,
  primary,
  secondary,
  tone = "muted",
}: {
  label: string;
  primary: string;
  secondary: string | null;
  tone?: "ok" | "warn" | "muted";
}) {
  const toneClass = {
    ok: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10",
    warn: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10",
    muted: "border-[var(--border-primary)] bg-[var(--bg-primary)]",
  }[tone];

  return (
    <div className={`rounded border px-2 py-1.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {primary}
      </p>
      {secondary && (
        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-tertiary)]">
          {secondary}
        </p>
      )}
    </div>
  );
}

// ─── α3-5 (2026-04-20): BlueprintGap 섹션 ──────────────────

function BlueprintGapSection({ gap }: { gap: BlueprintGap }) {
  return (
    <section className="mt-3 flex flex-col gap-2 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
            청사진 GAP
          </h4>
          <GapPriorityBadge priority={gap.priority} />
          <span className="text-[10px] text-[var(--text-tertiary)]">
            잔여 {gap.remainingSemesters}학기 · v1 규칙
          </span>
        </div>
      </header>

      <p className="text-xs text-[var(--text-primary)]">{gap.summary}</p>

      <div className="grid grid-cols-3 gap-2">
        <GapAreaCell label="학업" area={gap.areaGaps.academic} />
        <GapAreaCell label="진로" area={gap.areaGaps.career} />
        <GapAreaCell label="공동체" area={gap.areaGaps.community} />
      </div>

      {gap.axisGaps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {gap.axisGaps.slice(0, 4).map((g) => (
            <AxisGapChip key={g.code} gap={g} />
          ))}
          {gap.axisGaps.length > 4 && (
            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              +{gap.axisGaps.length - 4}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function GapPriorityBadge({ priority }: { priority: BlueprintGap["priority"] }) {
  const tone = {
    high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    low: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700",
  }[priority];
  const label = { high: "HIGH", medium: "MED", low: "LOW" }[priority];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
      title={`GAP 우선순위: ${priority}`}
    >
      {label}
    </span>
  );
}

function GapAreaCell({ label, area }: { label: string; area: AreaGap }) {
  const hasGap = area.gapSize !== null;
  const tone =
    !hasGap
      ? "muted"
      : area.gapSize! >= 15
        ? "red"
        : area.gapSize! >= 8
          ? "amber"
          : area.gapSize! > 0
            ? "blue"
            : "emerald";
  const toneClass = {
    red: "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10",
    amber: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10",
    blue: "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10",
    emerald: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10",
    muted: "border-[var(--border-primary)] bg-[var(--bg-secondary)]",
  }[tone];

  return (
    <div className={`rounded border px-2 py-1 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {hasGap ? (area.gapSize! > 0 ? `+${area.gapSize}` : `${area.gapSize}`) : "—"}
        <span className="ml-1 text-[10px] font-normal text-[var(--text-tertiary)]">
          {area.currentScore !== null && area.targetScore !== null
            ? `${Math.round(area.currentScore)} → ${Math.round(area.targetScore)}`
            : "target 없음"}
        </span>
      </p>
    </div>
  );
}

const GAP_PATTERN_LABEL: Record<GapPattern, string> = {
  insufficient: "부족",
  excess: "과잉",
  mismatch: "불일치",
  latent: "잠재",
};

const GAP_CODE_LABEL: Record<AxisGap["code"], string> = {
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

function AxisGapChip({ gap }: { gap: AxisGap }) {
  const tone = {
    insufficient: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    excess: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
    mismatch: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    latent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  }[gap.pattern];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${tone}`}
      title={gap.rationale}
    >
      <span className="font-semibold">{GAP_PATTERN_LABEL[gap.pattern]}</span>
      <span>{GAP_CODE_LABEL[gap.code]}</span>
    </span>
  );
}

// ─── α3-3-2 (2026-04-20): 3 시나리오 비교 섹션 ──────────────

const SCENARIO_LABEL: Record<ScenarioType, string> = {
  baseline: "기본",
  stable: "보수",
  aggressive: "공격",
};

const SCENARIO_DESCRIPTION: Record<ScenarioType, string> = {
  baseline: "현 청사진 target",
  stable: "각 목표 −1등급",
  aggressive: "각 목표 +1등급",
};

function ScenarioCompareSection({
  multi,
}: {
  multi: MultiScenarioBlueprintGap;
}) {
  const entries: ReadonlyArray<[ScenarioType, BlueprintGap | null]> = [
    ["stable", multi.stable],
    ["baseline", multi.baseline],
    ["aggressive", multi.aggressive],
  ];

  return (
    <section className="mt-3 flex flex-col gap-2 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
            시나리오 브랜치 비교
          </h4>
          {multi.dominantScenario && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              우선 분기 · <strong className="text-[var(--text-secondary)]">{SCENARIO_LABEL[multi.dominantScenario]}</strong>
            </span>
          )}
          <span className="text-[10px] text-[var(--text-tertiary)]">v1 규칙</span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {entries.map(([scenario, gap]) => (
          <ScenarioCell
            key={scenario}
            scenario={scenario}
            gap={gap}
            dominant={multi.dominantScenario === scenario}
          />
        ))}
      </div>
    </section>
  );
}

function ScenarioCell({
  scenario,
  gap,
  dominant,
}: {
  scenario: ScenarioType;
  gap: BlueprintGap | null;
  dominant: boolean;
}) {
  const borderClass = dominant
    ? "border-indigo-400 ring-1 ring-indigo-300 dark:border-indigo-500 dark:ring-indigo-700"
    : "border-[var(--border-primary)]";

  if (!gap) {
    return (
      <div className={`rounded border px-2 py-1.5 ${borderClass} bg-[var(--bg-secondary)]`}>
        <p className="flex items-center justify-between text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
          <span>{SCENARIO_LABEL[scenario]}</span>
        </p>
        <p className="mt-0.5 text-sm font-semibold text-[var(--text-tertiary)]">—</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
          {SCENARIO_DESCRIPTION[scenario]}
        </p>
      </div>
    );
  }

  const maxAreaGap = Math.max(
    gap.areaGaps.academic.gapSize ?? -Infinity,
    gap.areaGaps.career.gapSize ?? -Infinity,
    gap.areaGaps.community.gapSize ?? -Infinity,
  );
  const displayGap = Number.isFinite(maxAreaGap) ? Math.round(maxAreaGap * 10) / 10 : null;
  const axisCount = gap.axisGaps.length;

  return (
    <div
      className={`rounded border px-2 py-1.5 ${borderClass} bg-[var(--bg-secondary)]`}
      title={gap.summary}
    >
      <p className="flex items-center justify-between text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
        <span>{SCENARIO_LABEL[scenario]}</span>
        <GapPriorityBadge priority={gap.priority} />
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {displayGap !== null && displayGap > 0
          ? `+${displayGap}`
          : displayGap !== null
            ? `${displayGap}`
            : "—"}
        <span className="ml-1 text-[10px] font-normal text-[var(--text-tertiary)]">
          max area · {axisCount}축
        </span>
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
        {SCENARIO_DESCRIPTION[scenario]}
      </p>
    </div>
  );
}

function formatBuiltAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
