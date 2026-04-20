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
import { studentStateQueryOptions } from "@/lib/query-options/studentRecord";
import {
  SNAPSHOT_LAYER_FLAGS,
  type StudentState,
} from "@/lib/domains/student-record/types/student-state";

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
        <CompletenessBadge pct={completenessPct} />
      </header>

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
