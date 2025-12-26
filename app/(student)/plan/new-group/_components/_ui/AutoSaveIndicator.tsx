/**
 * AutoSaveIndicator - 오토세이브 상태 표시 컴포넌트
 *
 * 오토세이브 상태를 시각적으로 표시합니다.
 * - idle: 표시 없음
 * - saving: 저장 중 스피너
 * - saved: 저장 완료 체크마크
 * - error: 저장 실패 경고
 */

import { cn } from "@/lib/cn";
import { Loader2, Check, AlertCircle, Cloud } from "lucide-react";
import type { AutoSaveStatus } from "../hooks/usePlanSubmission";

type AutoSaveIndicatorProps = {
  status: AutoSaveStatus;
  lastSavedAt?: Date | null;
  className?: string;
};

export function AutoSaveIndicator({
  status,
  lastSavedAt,
  className,
}: AutoSaveIndicatorProps) {
  // idle 상태에서는 아무것도 표시하지 않음
  if (status === "idle") {
    return null;
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-200",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">저장 중...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Cloud className="h-3.5 w-3.5 text-green-600" />
          <Check className="h-3 w-3 text-green-600 -ml-2.5" />
          <span className="text-green-600">
            저장됨{lastSavedAt ? ` (${formatTime(lastSavedAt)})` : ""}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">저장 실패</span>
        </>
      )}
    </div>
  );
}
