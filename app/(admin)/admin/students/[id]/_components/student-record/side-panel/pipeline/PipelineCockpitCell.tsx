"use client";

// ============================================
// 파이프라인 조종석 셀 컴포넌트
// StatusIcon, CockpitCell, CockpitRunningTimer
// ============================================

import { useState, useEffect } from "react";
import {
  Check,
  Loader2,
  AlertCircle,
  Play,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type CellStatus,
  STATUS_STYLES,
  PHASE_DESCRIPTIONS,
  formatElapsed,
} from "./pipeline-constants";

export interface CockpitCellProps {
  label: string;
  status: CellStatus;
  elapsedMs?: number;
  progressText?: string;
  runningStartMs?: number;
  tooltip?: string;
  onClick?: () => void;
  isDesignOnly?: boolean;
}

function StatusIcon({ status }: { status: CellStatus }) {
  switch (status) {
    case "completed": return <Check className="h-3.5 w-3.5" />;
    case "cached": return <Check className="h-3.5 w-3.5" />;
    case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case "failed": return <AlertCircle className="h-3.5 w-3.5" />;
    case "skipped": return <span className="text-xs font-medium">—</span>;
    case "ready": return <Play className="h-3 w-3" />;
    default: return <span className="w-3.5 h-3.5" />;
  }
}

function CockpitRunningTimer({ startMs }: { startMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-0.5 text-[9px] tabular-nums opacity-70">
      <Clock className="h-2.5 w-2.5" />
      {formatElapsed(now - startMs)}
    </span>
  );
}

export function CockpitCell({
  label,
  status,
  elapsedMs,
  progressText,
  runningStartMs,
  tooltip,
  onClick,
  isDesignOnly,
}: CockpitCellProps) {
  const s = STATUS_STYLES[status];
  const clickable =
    status === "ready" ||
    status === "completed" ||
    status === "cached" ||
    status === "failed";
  // 설계 전용 Phase에서 분석 모드(스킵)인 경우 시각적으로 구분
  const isAnalysisModeSkip = isDesignOnly && status === "skipped";
  const resolvedTooltip = tooltip ?? PHASE_DESCRIPTIONS[label];
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={resolvedTooltip}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-all min-h-[56px]",
        s.bg,
        s.text,
        isAnalysisModeSkip
          ? "border-dashed border-gray-300 dark:border-gray-600"
          : s.border,
        clickable && "cursor-pointer",
      )}
    >
      <StatusIcon status={status} />
      <span className="text-xs font-medium leading-tight text-center">{label}</span>
      {isAnalysisModeSkip && (
        <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight text-center">
          분석 모드
        </span>
      )}
      {status === "cached" && !isAnalysisModeSkip && (
        <span className="text-[9px] font-semibold text-teal-500 dark:text-teal-400">캐시</span>
      )}
      {status === "running" && progressText && (
        <span className="text-[9px] font-semibold">{progressText}</span>
      )}
      {status === "running" && runningStartMs != null && (
        <CockpitRunningTimer startMs={runningStartMs} />
      )}
      {elapsedMs != null &&
        (status === "completed" || status === "cached" || status === "failed") && (
          <span className="flex items-center gap-0.5 text-[9px] opacity-60">
            <Clock className="h-2.5 w-2.5" />
            {formatElapsed(elapsedMs)}
          </span>
        )}
    </button>
  );
}
