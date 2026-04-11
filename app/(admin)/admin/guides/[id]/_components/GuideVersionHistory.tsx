"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { History, RotateCcw, Loader2, Crown, ExternalLink, Sparkles, Pencil, RotateCw, Upload, GitBranch, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { getVersionHistoryAction } from "@/lib/domains/guide/actions/crud";
import { GUIDE_STATUS_LABELS } from "@/lib/domains/guide/types";
import type { GuideVersionItem } from "@/lib/domains/guide/types";
import { VersionCompareModal } from "./VersionCompareModal";

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case "ai_keyword":
    case "ai_pdf_extract":
    case "ai_url_extract":
      return <Sparkles className="w-3.5 h-3.5 text-primary-500" aria-label="AI 생성" />;
    case "ai_improve":
      return <Sparkles className="w-3.5 h-3.5 text-success-500" aria-label="AI 리뷰 개선" />;
    case "ai_clone_variant":
      return <GitBranch className="w-3.5 h-3.5 text-blue-500" aria-label="클론 변형" />;
    case "manual_edit":
      return <Pencil className="w-3.5 h-3.5 text-secondary-500" aria-label="수동 편집" />;
    case "revert":
      return <RotateCw className="w-3.5 h-3.5 text-warning-500" aria-label="되돌리기" />;
    case "imported":
      return <Upload className="w-3.5 h-3.5 text-secondary-400" aria-label="Import" />;
    default:
      return <History className="w-3.5 h-3.5 text-secondary-400" />;
  }
}

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
  const [compareTarget, setCompareTarget] = useState<{ guideId: string; compareId: string } | null>(null);

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
    <>
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
                        {getSourceIcon(v.source_type)}
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
                      {v.version_message && (
                        <p className="text-xs text-[var(--text-primary)] mt-0.5 truncate">
                          {v.version_message}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {new Date(v.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {v.quality_score != null && ` · ${v.quality_score}점`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!v.is_latest && (
                        <Link
                          href={`/admin/guides/${v.id}`}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-secondary-200 dark:border-secondary-600 text-[var(--text-secondary)] hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          보기
                        </Link>
                      )}
                      {!v.is_latest && (
                        <button
                          type="button"
                          onClick={() => setCompareTarget({ guideId, compareId: v.id })}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-secondary-200 dark:border-secondary-600 text-[var(--text-secondary)] hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          비교
                        </button>
                      )}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* M2: 버전 비교 모달 */}
      {compareTarget && (
        <VersionCompareModal
          open={!!compareTarget}
          onClose={() => setCompareTarget(null)}
          currentGuideId={compareTarget.guideId}
          defaultCompareId={compareTarget.compareId}
          versions={versions}
        />
      )}
    </>
  );
}

