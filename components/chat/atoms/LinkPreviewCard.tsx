"use client";

/**
 * LinkPreviewCard - OG 태그 기반 링크 프리뷰 카드
 *
 * 카카오톡 스타일: 썸네일 + 제목 + 설명 + 도메인
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/cn";
import { ExternalLink } from "lucide-react";
import type { ChatLinkPreview } from "@/lib/domains/chat/types";

interface LinkPreviewCardProps {
  preview: ChatLinkPreview;
  isOwn: boolean;
}

function LinkPreviewCardComponent({ preview, isOwn }: LinkPreviewCardProps) {
  const handleClick = useCallback(() => {
    window.open(preview.url, "_blank", "noopener,noreferrer");
  }, [preview.url]);

  if (!preview.title) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex overflow-hidden rounded-lg max-w-[280px] text-left",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        isOwn
          ? "bg-white/20 hover:bg-white/30 active:bg-white/35 focus-visible:ring-white/60"
          : "bg-bg-secondary hover:bg-bg-tertiary active:bg-bg-tertiary focus-visible:ring-primary",
        // 이미지가 있으면 세로 레이아웃, 없으면 가로
        preview.image_url ? "flex-col" : "flex-row items-center gap-3 p-3"
      )}
      aria-label={`링크: ${preview.title}`}
    >
      {/* 썸네일 이미지 */}
      {preview.image_url && (
        <div className="w-full h-32 bg-bg-tertiary overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // 이미지 로드 실패 시 숨김
              (e.target as HTMLElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      )}

      {/* 텍스트 영역 */}
      <div className={cn("flex-1 min-w-0", preview.image_url ? "p-2.5" : "")}>
        <p
          className={cn(
            "text-sm font-medium line-clamp-2",
            isOwn ? "text-white" : "text-text-primary"
          )}
        >
          {preview.title}
        </p>
        {preview.description && (
          <p
            className={cn(
              "text-xs mt-0.5 line-clamp-2",
              isOwn ? "text-white/80" : "text-text-secondary"
            )}
          >
            {preview.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <ExternalLink
            className={cn(
              "w-3 h-3 flex-shrink-0",
              isOwn ? "text-white/70" : "text-text-tertiary"
            )}
          />
          <span
            className={cn(
              "text-[10px] truncate",
              isOwn ? "text-white/70" : "text-text-tertiary"
            )}
          >
            {preview.site_name ?? new URL(preview.url).hostname}
          </span>
        </div>
      </div>
    </button>
  );
}

export const LinkPreviewCard = memo(LinkPreviewCardComponent);
