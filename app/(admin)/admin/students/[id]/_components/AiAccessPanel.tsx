"use client";

// ============================================
// 학생 AI 에이전트 접근 권한 Admin Panel (M0 + M0.5, 2026-04-20)
//
// - M0: 3-state 토글 (disabled/observer/active)
// - M0.5: active 승격 시 ai_consent_grants 3자 서명 gate (서버에서 검증)
//   + admin 이 기존 paper-based 동의를 기록하는 폼 (경량)
// ============================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import {
  fetchStudentAiAccessAction,
  fetchStudentGrantsAction,
  recordConsentGrantAction,
  revokeConsentGrantAction,
  updateStudentAiAccessAction,
} from "@/lib/domains/student-record/actions/student-ai-access-action";
import type {
  AiAccessLevel,
  AiConsentGrant,
} from "@/lib/domains/student-record/types/ai-access";

const LEVEL_LABEL: Record<AiAccessLevel, string> = {
  disabled: "차단",
  observer: "관찰자",
  active: "자율 대화",
};

const LEVEL_DESC: Record<AiAccessLevel, string> = {
  disabled: "AI 기능 전면 차단",
  observer: "AI 분석 허용 · 학생 직접 대화 X",
  active: "AI 와 자율 대화 (3자 동의 필수)",
};

const LEVELS: readonly AiAccessLevel[] = ["disabled", "observer", "active"];

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16); // datetime-local
}

function fromDateInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function AiAccessPanel({ studentId }: { studentId: string }) {
  const accessQueryKey = ["student-ai-access", studentId];
  const grantQueryKey = ["student-ai-consent-grants", studentId];
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  const accessQuery = useQuery({
    queryKey: accessQueryKey,
    queryFn: async () => {
      const r = await fetchStudentAiAccessAction(studentId);
      if (!r.success) throw new Error(r.error);
      return r.access;
    },
    staleTime: 30_000,
  });

  const grantsQuery = useQuery({
    queryKey: grantQueryKey,
    queryFn: async () => {
      const r = await fetchStudentGrantsAction(studentId);
      if (!r.success) throw new Error(r.error);
      return { active: r.active, history: r.history };
    },
    staleTime: 30_000,
  });

  const accessMutation = useMutation({
    mutationFn: async (args: {
      nextLevel: AiAccessLevel;
      revokeReason?: string | null;
    }) => {
      const r = await updateStudentAiAccessAction({
        studentId,
        nextLevel: args.nextLevel,
        revokeReason: args.revokeReason ?? null,
      });
      if (!r.success) throw new Error(r.error);
      return r.access;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(accessQueryKey, next);
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: accessQueryKey });
      });
    },
  });

  if (accessQuery.isLoading) {
    return (
      <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <p className="text-sm text-[var(--text-secondary)]">AI 접근 권한 로딩…</p>
      </section>
    );
  }
  if (accessQuery.isError || !accessQuery.data) {
    return (
      <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <p className="text-sm text-red-500">
          AI 접근 권한 조회 실패
          {accessQuery.error instanceof Error
            ? ` — ${accessQuery.error.message}`
            : ""}
        </p>
      </section>
    );
  }

  const current = accessQuery.data.accessLevel;
  const isDowngrade = (next: AiAccessLevel) =>
    (current === "active" && next !== "active") ||
    (current === "observer" && next === "disabled");

  const activeGrant = grantsQuery.data?.active ?? null;
  const canPromoteActive = Boolean(activeGrant);

  const onLevelClick = (next: AiAccessLevel) => {
    if (accessMutation.isPending || next === current) return;
    if (next === "active" && !canPromoteActive) {
      window.alert(
        "active 승격 전 먼저 '3자 동의 기록' 섹션에서 학생·학부모·컨설턴트 서명 timestamp 를 기록하세요.",
      );
      return;
    }
    if (isDowngrade(next)) {
      const reason = window.prompt("다운그레이드 사유를 입력해 주세요 (기록용)", "");
      if (!reason || !reason.trim()) return;
      accessMutation.mutate({ nextLevel: next, revokeReason: reason.trim() });
      return;
    }
    accessMutation.mutate({ nextLevel: next });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      {/* 1. 권한 레벨 */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            학생 AI 에이전트 권한
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            현재: <strong>{LEVEL_LABEL[current]}</strong> ·{" "}
            {LEVEL_DESC[current]}
          </span>
        </div>
        {accessQuery.data.grantedAt && (
          <span className="text-xs text-[var(--text-tertiary)]">
            부여 {new Date(accessQuery.data.grantedAt).toLocaleDateString("ko-KR")}
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {LEVELS.map((lv) => {
          const active = lv === current;
          const disabled =
            accessMutation.isPending ||
            active ||
            (lv === "active" && !canPromoteActive);
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onLevelClick(lv)}
              disabled={disabled}
              className={[
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                  : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                disabled ? "opacity-50" : "",
              ].join(" ")}
              title={
                lv === "active" && !canPromoteActive
                  ? "3자 동의 레코드 필요"
                  : undefined
              }
            >
              {LEVEL_LABEL[lv]}
            </button>
          );
        })}
        {accessMutation.isError && (
          <span className="text-xs text-red-500">
            {(accessMutation.error as Error).message}
          </span>
        )}
      </div>

      {accessQuery.data.lastRevokedAt && (
        <p className="text-xs text-[var(--text-tertiary)]">
          마지막 철회:{" "}
          {new Date(accessQuery.data.lastRevokedAt).toLocaleString("ko-KR")}
          {accessQuery.data.revokeReason
            ? ` · 사유: ${accessQuery.data.revokeReason}`
            : ""}
        </p>
      )}

      {/* 2. Consent Grants 섹션 */}
      <ConsentGrantSection
        studentId={studentId}
        active={activeGrant}
        history={grantsQuery.data?.history ?? []}
        loading={grantsQuery.isLoading}
      />
    </section>
  );
}

// ─── Consent Grant 관리 ──────────────────────────────────

function ConsentGrantSection({
  studentId,
  active,
  history,
  loading,
}: {
  studentId: string;
  active: AiConsentGrant | null;
  history: readonly AiConsentGrant[];
  loading: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            3자 동의 기록
          </h4>
          <span className="text-xs text-[var(--text-tertiary)]">
            active 승격에 필수. Tier 1 은 admin 이 paper-based 동의를 기록.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="text-xs text-[var(--accent-primary)] hover:underline"
        >
          {formOpen ? "폼 닫기" : "새 동의 기록"}
        </button>
      </div>

      {loading && (
        <p className="text-xs text-[var(--text-tertiary)]">로딩…</p>
      )}

      {active && <ActiveGrantRow grant={active} studentId={studentId} />}
      {!loading && !active && (
        <p className="text-xs text-[var(--text-tertiary)]">
          현재 유효한 active grant 없음 — 필요 시 아래 폼에서 기록.
        </p>
      )}

      {formOpen && <RecordGrantForm studentId={studentId} onDone={() => setFormOpen(false)} />}

      {history.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
            이전 grant 이력 ({history.length}건)
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {history.map((g) => (
              <li
                key={g.id}
                className="rounded bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-secondary)]"
              >
                <code className="font-mono text-[var(--text-tertiary)]">
                  #{g.id.slice(0, 8)}
                </code>{" "}
                · {g.grantedLevel} · v{g.consentVersion}
                {g.revokedAt
                  ? ` · 철회 ${new Date(g.revokedAt).toLocaleDateString("ko-KR")}`
                  : ` · 활성 (부여 ${new Date(g.effectiveAt).toLocaleDateString("ko-KR")})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ActiveGrantRow({
  grant,
  studentId,
}: {
  grant: AiConsentGrant;
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const revokeMutation = useMutation({
    mutationFn: async (reason: string) => {
      const r = await revokeConsentGrantAction(grant.id, studentId, reason);
      if (!r.success) throw new Error(r.error ?? "철회 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-ai-consent-grants", studentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["student-ai-access", studentId],
      });
    },
  });

  const onRevoke = () => {
    const reason = window.prompt("동의 철회 사유 (기록용)", "");
    if (!reason || !reason.trim()) return;
    revokeMutation.mutate(reason.trim());
  };

  return (
    <div className="flex flex-wrap items-start gap-3 rounded bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
      <div className="flex-1">
        <div>
          <span className="rounded bg-[var(--accent-primary)]/10 px-1.5 py-0.5 font-semibold text-[var(--accent-primary)]">
            유효
          </span>{" "}
          · {grant.grantedLevel} · v{grant.consentVersion}
        </div>
        <div className="mt-1 text-[var(--text-tertiary)]">
          학생 {grant.studentSignedAt ? "✓" : "–"} / 학부모{" "}
          {grant.parentSignedAt ? "✓" : "–"} / 컨설턴트{" "}
          {grant.consultantSignedAt ? "✓" : "–"}
          {grant.expiresAt
            ? ` · 만료 ${new Date(grant.expiresAt).toLocaleDateString("ko-KR")}`
            : ""}
        </div>
        {grant.consentNotes && (
          <div className="mt-1 italic text-[var(--text-tertiary)]">
            {grant.consentNotes}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={revokeMutation.isPending}
        className="text-xs text-red-500 hover:underline disabled:opacity-50"
      >
        철회
      </button>
    </div>
  );
}

function RecordGrantForm({
  studentId,
  onDone,
}: {
  studentId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [grantedLevel, setGrantedLevel] = useState<"observer" | "active">(
    "active",
  );
  const [consentVersion, setConsentVersion] = useState("ko-2026-07-v1");
  const [studentSigned, setStudentSigned] = useState(toDateInput(new Date().toISOString()));
  const [parentSigned, setParentSigned] = useState(toDateInput(new Date().toISOString()));
  const [consultantSigned, setConsultantSigned] = useState(
    toDateInput(new Date().toISOString()),
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await recordConsentGrantAction({
        studentId,
        grantedLevel,
        consentVersion,
        studentSignedAt: fromDateInput(studentSigned),
        parentSignedAt: fromDateInput(parentSigned),
        consultantSignedAt: fromDateInput(consultantSigned),
        expiresAt: fromDateInput(expiresAt),
        consentNotes: notes.trim() || null,
      });
      if (!r.success) throw new Error(r.error);
      return r.grant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-ai-consent-grants", studentId],
      });
      onDone();
    },
  });

  const activeRequiresAll =
    grantedLevel === "active" &&
    (!studentSigned || !parentSigned || !consultantSigned);

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (mutation.isPending) return;
        if (activeRequiresAll) {
          window.alert("active 는 3 signed_at 모두 필수");
          return;
        }
        mutation.mutate();
      }}
    >
      <div className="flex items-center gap-2">
        <label className="text-[var(--text-secondary)]">레벨:</label>
        <select
          value={grantedLevel}
          onChange={(e) =>
            setGrantedLevel(e.target.value as "observer" | "active")
          }
          className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
        >
          <option value="observer">observer</option>
          <option value="active">active (3자 서명 필수)</option>
        </select>
        <label className="ml-2 text-[var(--text-secondary)]">버전:</label>
        <input
          type="text"
          value={consentVersion}
          onChange={(e) => setConsentVersion(e.target.value)}
          className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
          placeholder="ko-2026-07-v1"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[var(--text-tertiary)]">학생 서명 시각</span>
          <input
            type="datetime-local"
            value={studentSigned}
            onChange={(e) => setStudentSigned(e.target.value)}
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[var(--text-tertiary)]">학부모 서명 시각</span>
          <input
            type="datetime-local"
            value={parentSigned}
            onChange={(e) => setParentSigned(e.target.value)}
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[var(--text-tertiary)]">컨설턴트 서명 시각</span>
          <input
            type="datetime-local"
            value={consultantSigned}
            onChange={(e) => setConsultantSigned(e.target.value)}
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[var(--text-tertiary)]">만료 시각 (선택)</span>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[var(--text-tertiary)]">메모</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="예: 동의서 pdf S3 key, 서면 확인자, 기타 참고"
          className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-primary)]"
        />
      </label>

      {mutation.isError && (
        <p className="text-red-500">
          기록 실패: {(mutation.error as Error).message}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={mutation.isPending || activeRequiresAll || !consentVersion.trim()}
          className="rounded bg-[var(--accent-primary)] px-3 py-1 text-white disabled:opacity-50"
        >
          {mutation.isPending ? "저장…" : "기록"}
        </button>
      </div>
    </form>
  );
}
