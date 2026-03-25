"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Trash2, RefreshCw, Link2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  listSharesAction,
  revokeShareAction,
} from "@/lib/domains/guide/actions/share";
import { explorationGuideKeys } from "@/lib/query-options/explorationGuide";

interface GuideSharePanelProps {
  guideId: string;
  onCreateNew: () => void;
}

export function GuideSharePanel({ guideId, onCreateNew }: GuideSharePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: sharesRes, isLoading } = useQuery({
    queryKey: [...explorationGuideKeys.all, "shares", guideId],
    queryFn: () => listSharesAction(guideId),
    staleTime: 30_000,
  });

  const shares = sharesRes?.success ? sharesRes.data ?? [] : [];

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const buildShareUrl = useCallback((token: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/shared/guide/${token}`;
  }, []);

  const handleCopy = useCallback(
    async (token: string, id: string) => {
      const url = buildShareUrl(token);
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.showSuccess("링크가 복사되었습니다.");
      setTimeout(() => setCopiedId(null), 2000);
    },
    [buildShareUrl, toast],
  );

  const handleRevoke = useCallback(
    async (shareId: string) => {
      setRevoking(shareId);
      try {
        const result = await revokeShareAction(shareId);
        if (result.success) {
          toast.showSuccess("공유 링크가 폐기되었습니다.");
          queryClient.invalidateQueries({
            queryKey: [...explorationGuideKeys.all, "shares", guideId],
          });
        } else if (!result.success) {
          toast.showError(result.error ?? "폐기에 실패했습니다.");
        }
      } catch {
        toast.showError("오류가 발생했습니다.");
      } finally {
        setRevoking(null);
      }
    },
    [guideId, toast, queryClient],
  );

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-1.5">
          <Link2 className="w-4 h-4" />
          공유 링크
        </h3>
        <button
          type="button"
          onClick={onCreateNew}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          + 새 링크 생성
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--text-secondary)]">불러오는 중...</p>
      ) : shares.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          아직 생성된 공유 링크가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/30 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-primary)] font-mono truncate">
                  {buildShareUrl(share.share_token)}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {new Date(share.created_at).toLocaleDateString("ko-KR")} ·{" "}
                  섹션 {share.visible_sections.length}개
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={buildShareUrl(share.share_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                  title="새 탭에서 열기"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(share.share_token, share.id)}
                  className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                  title="링크 복사"
                >
                  {copiedId === share.id ? (
                    <Check className="w-3.5 h-3.5 text-success-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(share.id)}
                  disabled={revoking === share.id}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title="폐기"
                >
                  {revoking === share.id ? (
                    <RefreshCw className="w-3.5 h-3.5 text-red-400 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
