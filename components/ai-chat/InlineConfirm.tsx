"use client";

/**
 * Phase B-4: HITL (Human-in-the-Loop) 표준 승인 컴포넌트
 *
 * 대화 흐름 중 파괴적·비가역적·비용 발생 액션 전에 사용자 확인을 받는 카드.
 *
 * ## 사용 패턴
 *
 * ### 1) 클라이언트 전용 (예: `/clear` 슬래시)
 * ChatShell 내에서 pendingAction state 로 관리하고, 메시지 리스트 아래
 * InlineConfirm 을 렌더. confirm 시 실제 네비게이션 수행.
 *
 * ### 2) 서버 도구 승인 (Phase C 배선 예정)
 * AI SDK 패턴:
 * - 도구가 { requiresApproval: true, action, payload, summary } 반환
 * - ToolCard 가 InlineConfirm 을 footer 로 렌더
 * - confirm 시 client 가 addToolResult({ toolCallId, result: APPROVED }) 호출
 * - 서버는 승인 결과를 받아 실제 실행
 *
 * ## 톤
 * - neutral: 단순 확인 (새 대화 이동 등)
 * - destructive: 데이터 소실 경고 (삭제, 초기화)
 */

import { cn } from "@/lib/cn";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

type Tone = "neutral" | "destructive";

type Props = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function InlineConfirm({
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  tone = "neutral",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const Icon = tone === "destructive" ? AlertTriangle : Info;

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={title}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm",
        tone === "destructive"
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          size={16}
          className={cn(
            "shrink-0 translate-y-0.5",
            tone === "destructive"
              ? "text-red-500 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <p
            className={cn(
              "text-sm font-medium",
              tone === "destructive"
                ? "text-red-900 dark:text-red-100"
                : "text-zinc-900 dark:text-zinc-100",
            )}
          >
            {title}
          </p>
          {description && (
            <p
              className={cn(
                "text-xs",
                tone === "destructive"
                  ? "text-red-700 dark:text-red-300"
                  : "text-zinc-600 dark:text-zinc-400",
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          autoFocus
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50",
            tone === "destructive"
              ? "bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500"
              : "bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
          )}
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
