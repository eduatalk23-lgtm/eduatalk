"use client";

/**
 * Phase D-2: Agent Status Bar.
 *
 * D-1 의 ToolLoopAgent 가 3 entry point(chat/route, agent/route, subagentRunner)
 * 에서 stepTrace 를 수집 중이지만 클라이언트는 UIMessage.parts 로 tool part
 * state 전환을 이미 수신 중. 이 컴포넌트는 `extractAgentStatus` 로 현재
 * 진행 단계를 한 줄 표시 — D-1 작업의 실 가치 가시화.
 *
 * 사용 예:
 *   <AgentStatusBar messages={messages} status={status} />
 *
 * 표시 규칙:
 *  - idle: 렌더하지 않음 (null)
 *  - thinking/generating: 펄스 3점 + 라벨
 *  - tool (실행 중): 펄스 점 + tool 라벨 + elapsed 초
 *  - tool (HITL 승인 대기): awaitingApproval 톤 (노란) + elapsed 시간 없음
 *  - error: 빨간 톤
 */

import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/cn";
import {
  extractAgentStatus,
  type AgentStatus,
  type UseChatStatus,
} from "@/lib/agents/tool-loop-agent/ui/status-extractor";

type Variant = "shell" | "agent";

type Props = {
  messages: readonly UIMessage[];
  status: UseChatStatus;
  /**
   * shell: /ai-chat 전용 zinc 톤.
   * agent: /admin/agent 전용 design-token 톤 (color-primary/secondary).
   * default='shell'.
   */
  variant?: Variant;
  className?: string;
};

export function AgentStatusBar({
  messages,
  status,
  variant = "shell",
  className,
}: Props) {
  const s = extractAgentStatus(messages, status);
  const elapsedSec = useElapsedSeconds(s);

  if (s.phase === "idle") {
    return (
      <div role="status" aria-live="polite" className="sr-only">
        대기 중
      </div>
    );
  }

  const tone = resolveTone(s, variant);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-2 py-1 text-xs",
        tone.container,
        className,
      )}
    >
      <StatusIndicator phase={s.phase} tone={tone} />
      <span className={cn("font-medium", tone.label)}>{s.label}</span>
      {s.phase === "tool" && !s.awaitingApproval && elapsedSec != null && (
        <span className={tone.meta}>· {elapsedSec}s</span>
      )}
      {s.completedToolCount > 0 && s.phase !== "error" && (
        <span className={tone.meta}>
          · 완료 {s.completedToolCount}
        </span>
      )}
    </div>
  );
}

/**
 * 같은 tool 호출이 지속되는 동안 elapsed 를 보여주기 위한 훅.
 * toolCallId 가 바뀔 때마다 startedAt 리셋.
 * 500ms 틱으로 부드럽게 갱신.
 */
function useElapsedSeconds(s: AgentStatus): number | null {
  const key = s.phase === "tool" ? (s.toolCallId ?? "anon") : null;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (key === null) {
      setStartedAt(null);
      return;
    }
    setStartedAt(Date.now());
    setNow(Date.now());
  }, [key]);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  if (startedAt === null) return null;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

type Tone = {
  container: string;
  dot: string;
  label: string;
  meta: string;
};

function resolveTone(s: AgentStatus, variant: Variant): Tone {
  if (s.phase === "error") {
    return {
      container: "",
      dot: "bg-red-500",
      label: "text-red-600 dark:text-red-400",
      meta: "text-red-500/70 dark:text-red-400/70",
    };
  }

  if (s.awaitingApproval) {
    return {
      container: "",
      dot: "bg-amber-500",
      label: "text-amber-700 dark:text-amber-400",
      meta: "text-amber-600/70 dark:text-amber-500/70",
    };
  }

  if (variant === "agent") {
    return {
      container: "",
      dot: "bg-[rgb(var(--color-primary-500))]",
      label: "text-[var(--color-text-secondary)]",
      meta: "text-[var(--color-text-tertiary)]",
    };
  }

  return {
    container: "",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    label: "text-zinc-600 dark:text-zinc-300",
    meta: "text-zinc-400 dark:text-zinc-500",
  };
}

function StatusIndicator({
  phase,
  tone,
}: {
  phase: AgentStatus["phase"];
  tone: Tone;
}) {
  // tool 실행 중 / 승인 대기 → 단일 점 고속 pulse
  // thinking / generating → 3점 위상차 pulse (기존 ChatShell 패턴과 동일)
  if (phase === "tool" || phase === "error") {
    return (
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 animate-pulse rounded-full", tone.dot)}
      />
    );
  }

  return (
    <span className="flex gap-1" aria-hidden="true">
      <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", tone.dot)} />
      <span
        className={cn(
          "h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]",
          tone.dot,
        )}
      />
      <span
        className={cn(
          "h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]",
          tone.dot,
        )}
      />
    </span>
  );
}
