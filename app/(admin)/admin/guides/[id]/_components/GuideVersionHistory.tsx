"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RotateCcw, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { getVersionHistoryAction } from "@/lib/domains/guide/actions/crud";
import { GUIDE_STATUS_LABELS } from "@/lib/domains/guide/types";
import type { GuideVersionItem } from "@/lib/domains/guide/types";

interface GuideVersionHistoryProps {
  guideId: string;
  currentVersion: number;
  onRevert: (versionId: string, version: number) => void;
  reverting: boolean;
}

export function GuideVersionHistory({
  guideId,
  currentVersion,
  onRevert,
  reverting,
}: GuideVersionHistoryProps) {
  const [open, setOpen] = useState(false);

  const { data: historyRes, isLoading } = useQuery({
    queryKey: ["guide-versions", guideId],
    queryFn: () => getVersionHistoryAction(guideId),
    enabled: open,
  });

  const versions: GuideVersionItem[] =
    historyRes?.success && historyRes.data ? historyRes.data : [];

  if (currentVersion <= 1 && !open) {
    return null; // 버전 1이면 히스토리 패널 불필요
  }

  return (
    <div className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-[var(--text-heading)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors rounded-lg"
      >
        <History className="w-4 h-4 text-[var(--text-secondary)]" />
        버전 히스토리
        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          v{currentVersion}
        </span>
      </button>

      {open && (
        <div className="border-t border-secondary-200 dark:border-secondary-700 px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              로딩 중...
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-2">
              버전 히스토리가 없습니다.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md text-sm",
                    v.is_latest
                      ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                      : "hover:bg-secondary-50 dark:hover:bg-secondary-800",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">v{v.version}</span>
                      {v.is_latest && (
                        <Crown className="w-3.5 h-3.5 text-primary-500" />
                      )}
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          v.status === "approved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : v.status === "draft"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400",
                        )}
                      >
                        {GUIDE_STATUS_LABELS[v.status]}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(v.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {!v.is_latest && (
                    <button
                      type="button"
                      onClick={() => onRevert(v.id, v.version)}
                      disabled={reverting}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-secondary-200 dark:border-secondary-600 text-[var(--text-secondary)] hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      되돌리기
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
