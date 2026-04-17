"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToolCardState = "pending" | "running" | "success" | "error";

type Props = {
  name: string;
  icon?: ReactNode;
  state: ToolCardState;
  summary?: string;
  errorText?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

const STATE_CHIP: Record<
  ToolCardState,
  { label: string; className: string; icon: ReactNode }
> = {
  pending: {
    label: "대기",
    className: "bg-zinc-100 text-zinc-600",
    icon: <Loader2 size={11} className="animate-spin" />,
  },
  running: {
    label: "실행 중",
    className: "bg-blue-50 text-blue-700",
    icon: <Loader2 size={11} className="animate-spin" />,
  },
  success: {
    label: "완료",
    className: "bg-emerald-50 text-emerald-700",
    icon: <Check size={11} strokeWidth={2.5} />,
  },
  error: {
    label: "오류",
    className: "bg-rose-50 text-rose-700",
    icon: <AlertCircle size={11} />,
  },
};

export function ToolCard({
  name,
  icon,
  state,
  summary,
  errorText,
  defaultOpen,
  children,
  footer,
}: Props) {
  const hasBody = children !== undefined && children !== null;
  // pending/running 상태는 본문 없이 헤더만. success/error는 본문 기본 펼침.
  const [open, setOpen] = useState(
    defaultOpen ?? (state === "success" || state === "error"),
  );

  const canToggle = hasBody && (state === "success" || state === "error");

  const chip = STATE_CHIP[state];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => canToggle && setOpen((v) => !v)}
        disabled={!canToggle}
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2 text-left",
          canToggle
            ? "cursor-pointer hover:bg-zinc-50"
            : "cursor-default",
          open ? "border-zinc-200" : "border-transparent",
        )}
      >
        {canToggle &&
          (open ? (
            <ChevronDown size={14} className="text-zinc-400" />
          ) : (
            <ChevronRight size={14} className="text-zinc-400" />
          ))}
        {icon && <span className="text-zinc-500">{icon}</span>}
        <span className="font-mono text-[12px] font-medium text-zinc-700">
          {name}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            chip.className,
          )}
        >
          {chip.icon}
          {chip.label}
        </span>
        {summary && (
          <span className="ml-1 truncate text-xs text-zinc-500">
            {summary}
          </span>
        )}
      </button>

      {state === "error" && errorText && (
        <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorText}
        </div>
      )}

      {hasBody && open && (
        <div className="flex flex-col gap-2 p-3">{children}</div>
      )}

      {footer && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
}
