"use client";

// ============================================
// 학생 AI 에이전트 접근 권한 Admin Panel (M0, 2026-04-20)
//
// feedback_student-agent-opt-in-gate.md — 전체 학생 개방 금지. 학생별 3-state.
// active 승격은 M0.5 의 ai_consent_grants 3자 서명 필수 (경고 노출).
// ============================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import {
  fetchStudentAiAccessAction,
  updateStudentAiAccessAction,
} from "@/lib/domains/student-record/actions/student-ai-access-action";
import type { AiAccessLevel } from "@/lib/domains/student-record/types/ai-access";

const LEVEL_LABEL: Record<AiAccessLevel, string> = {
  disabled: "차단",
  observer: "관찰자",
  active: "자율 대화",
};

const LEVEL_DESC: Record<AiAccessLevel, string> = {
  disabled: "AI 기능 전면 차단",
  observer: "AI 분석 허용 · 학생 직접 대화 X",
  active: "AI 와 자율 대화 (M0.5 3자 동의 필수)",
};

const LEVELS: readonly AiAccessLevel[] = ["disabled", "observer", "active"];

export function AiAccessPanel({ studentId }: { studentId: string }) {
  const queryKey = ["student-ai-access", studentId];
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const [revokeReason, setRevokeReason] = useState("");

  const accessQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetchStudentAiAccessAction(studentId);
      if (!r.success) throw new Error(r.error);
      return r.access;
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
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
      queryClient.setQueryData(queryKey, next);
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey });
      });
      setRevokeReason("");
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
          AI 접근 권한 조회 실패:
          {accessQuery.error instanceof Error
            ? ` ${accessQuery.error.message}`
            : ""}
        </p>
      </section>
    );
  }

  const current = accessQuery.data.accessLevel;
  const isDowngrade = (next: AiAccessLevel) =>
    (current === "active" && next !== "active") ||
    (current === "observer" && next === "disabled");

  const onClick = (next: AiAccessLevel) => {
    if (mutation.isPending || next === current) return;
    if (isDowngrade(next) && !revokeReason.trim()) {
      const reason = window.prompt(
        "다운그레이드 사유를 입력해 주세요 (기록용)",
        "",
      );
      if (!reason || !reason.trim()) return;
      mutation.mutate({ nextLevel: next, revokeReason: reason.trim() });
      return;
    }
    if (next === "active") {
      const ok = window.confirm(
        "active 승격 — M0.5 의 3자 동의 스키마가 미배포 상태입니다.\n" +
          "내부 Tier 1 수동 승인에 한해 진행하세요. 계속하시겠습니까?",
      );
      if (!ok) return;
    }
    mutation.mutate({ nextLevel: next });
  };

  return (
    <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
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
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onClick(lv)}
              disabled={mutation.isPending || active}
              className={[
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                  : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                mutation.isPending ? "opacity-50" : "",
              ].join(" ")}
            >
              {LEVEL_LABEL[lv]}
            </button>
          );
        })}
        {mutation.isError && (
          <span className="text-xs text-red-500">
            {(mutation.error as Error).message}
          </span>
        )}
      </div>

      {accessQuery.data.lastRevokedAt && (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          마지막 철회:{" "}
          {new Date(accessQuery.data.lastRevokedAt).toLocaleString("ko-KR")}
          {accessQuery.data.revokeReason
            ? ` · 사유: ${accessQuery.data.revokeReason}`
            : ""}
        </p>
      )}

      {current === "active" && (
        <p className="mt-2 rounded bg-[var(--bg-tertiary)] p-2 text-xs text-[var(--text-secondary)]">
          ⚠ 현재 M0.5 의 3자 동의 스키마 미배포. 내부 Tier 1 수동 승인 전제.
          문제 발생 시 즉시 관찰자 또는 차단으로 강등하세요.
        </p>
      )}
    </section>
  );
}
