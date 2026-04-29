"use client";

/**
 * AttachmentRenderer - 채팅 첨부파일 렌더링
 *
 * 이미지: 썸네일 그리드 (클릭 시 라이트박스)
 * 비디오: 인라인 플레이어 + 다운로드
 * 오디오: 인라인 플레이어 + 파일명
 * 파일: 아이콘 + 이름 + 크기 + 다운로드
 *
 * Signed URL 만료 시 자동 refresh (onError → refreshAttachmentUrlsAction)
 */

import { memo, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FileText, Download, Film, HardDrive, Music, ImageOff } from "lucide-react";
import type { ChatAttachment } from "@/lib/domains/chat/types";
import { formatFileSize, getFileTypeLabel } from "@/lib/domains/chat/fileValidation";
import { refreshAttachmentUrlsAction } from "@/lib/domains/chat/actions/attachments";
import { saveChatAttachmentToDriveAction } from "@/lib/domains/drive/actions/chat-save";

// ============================================
// Refreshed URL 캐시 (모듈 레벨 — 컴포넌트 마운트/언마운트와 무관)
// Virtuoso 가상화로 스크롤 시 ImageItem이 반복 마운트되므로
// refresh된 URL을 캐싱하여 매번 재요청 방지
// ============================================
const refreshedUrlCache = new Map<string, string>();
const REFRESH_CACHE_MAX = 500;

function getCachedUrl(attachmentId: string, original: string): string {
  return refreshedUrlCache.get(attachmentId) ?? original;
}

function setCachedUrl(attachmentId: string, url: string): void {
  // LRU 대신 간단한 크기 제한 — 초과 시 절반 정리
  if (refreshedUrlCache.size >= REFRESH_CACHE_MAX) {
    const keys = [...refreshedUrlCache.keys()];
    for (let i = 0; i < keys.length / 2; i++) {
      refreshedUrlCache.delete(keys[i]);
    }
  }
  refreshedUrlCache.set(attachmentId, url);
}

// 성공적으로 로드된 URL 기록 (재마운트 시 스켈레톤 건너뛰기)
const loadedUrlSet = new Set<string>();

// ============================================
// 이미지 치수 인메모리 캐시 (모듈 레벨)
// DB에 width/height가 없는 이미지도 로드 후 치수를 캐싱하여
// Virtuoso 재마운트 시 정확한 aspect-ratio 제공 → CLS 제거
// ============================================
const dimensionCache = new Map<string, { width: number; height: number }>();
const DIMENSION_CACHE_MAX = 300;

function getCachedDimensions(attachmentId: string): { width: number; height: number } | undefined {
  return dimensionCache.get(attachmentId);
}

function setCachedDimensions(attachmentId: string, width: number, height: number): void {
  if (dimensionCache.size >= DIMENSION_CACHE_MAX) {
    const keys = [...dimensionCache.keys()];
    for (let i = 0; i < keys.length / 2; i++) {
      dimensionCache.delete(keys[i]);
    }
  }
  dimensionCache.set(attachmentId, { width, height });
}

interface AttachmentRendererProps {
  attachments: ChatAttachment[];
  isOwn: boolean;
  onImageClick?: (attachment: ChatAttachment, index: number) => void;
  /** Show "Save to Drive" button on file attachments */
  showSaveToDrive?: boolean;
}

function AttachmentRendererComponent({
  attachments,
  isOwn,
  onImageClick,
  showSaveToDrive,
}: AttachmentRendererProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.attachment_type === "image");
  const videos = attachments.filter((a) => a.attachment_type === "video");
  const audios = attachments.filter((a) => a.attachment_type === "audio");
  const files = attachments.filter(
    (a) =>
      a.attachment_type !== "image" &&
      a.attachment_type !== "video" &&
      a.attachment_type !== "audio"
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* 이미지 그리드 */}
      {images.length > 0 && (
        <ImageGrid images={images} onImageClick={onImageClick} />
      )}

      {/* 비디오 인라인 플레이어 */}
      {videos.map((v) => (
        <VideoPlayer key={v.id} attachment={v} isOwn={isOwn} />
      ))}

      {/* 오디오 인라인 플레이어 */}
      {audios.map((a) => (
        <AudioPlayer key={a.id} attachment={a} isOwn={isOwn} />
      ))}

      {/* 파일 목록 */}
      {files.map((file) => (
        <FileCard
          key={file.id}
          attachment={file}
          isOwn={isOwn}
          showSaveToDrive={showSaveToDrive}
        />
      ))}
    </div>
  );
}

/** 카카오톡 패턴: 격자에 표시할 최대 이미지 수 (초과분은 마지막 셀에 +N 오버레이) */
const MAX_GRID_IMAGES = 4;

/** 이미지 그리드 (1장: 풀, 2장: 2열, 3+: 그리드, 5+: 4장 + +N 오버레이) */
function ImageGrid({
  images,
  onImageClick,
}: {
  images: ChatAttachment[];
  onImageClick?: (attachment: ChatAttachment, index: number) => void;
}) {
  const totalCount = images.length;
  const overflowCount = Math.max(0, totalCount - MAX_GRID_IMAGES);
  const visibleImages = overflowCount > 0 ? images.slice(0, MAX_GRID_IMAGES) : images;
  const visibleCount = visibleImages.length;

  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg overflow-hidden border border-border/30",
        visibleCount === 1 && "grid-cols-1",
        visibleCount === 2 && "grid-cols-2",
        visibleCount >= 3 && "grid-cols-2"
      )}
    >
      {visibleImages.map((img, idx) => {
        const isLastWithOverflow = overflowCount > 0 && idx === visibleCount - 1;
        return (
          <div key={img.id} className="relative">
            <ImageItem
              attachment={img}
              index={idx}
              count={visibleCount}
              onImageClick={onImageClick}
            />
            {isLastWithOverflow && (
              <button
                type="button"
                onClick={() => onImageClick?.(img, idx)}
                className="absolute inset-0 flex items-center justify-center bg-bg-overlay text-white font-semibold text-2xl tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`이미지 ${overflowCount}개 더 보기`}
              >
                +{overflowCount}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 이미지 로딩 상태 */
type ImageLoadState = "loading" | "loaded" | "refreshing" | "failed";

/** 개별 이미지 (만료 시 자동 refresh, URL 캐싱) */
function ImageItem({
  attachment,
  index,
  count,
  onImageClick,
}: {
  attachment: ChatAttachment;
  index: number;
  count: number;
  onImageClick?: (attachment: ChatAttachment, index: number) => void;
}) {
  const originalUrl = attachment.thumbnail_url ?? attachment.public_url;
  const cachedUrl = getCachedUrl(attachment.id, originalUrl);
  const alreadyLoaded = loadedUrlSet.has(cachedUrl);

  const [src, setSrc] = useState(cachedUrl);
  const [loadState, setLoadState] = useState<ImageLoadState>(alreadyLoaded ? "loaded" : "loading");
  const refreshAttempted = useRef(cachedUrl !== originalUrl);

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    loadedUrlSet.add(src);
    setLoadState("loaded");
    // 로드 완료 시 실제 치수 캐싱 (DB에 없는 이미지용)
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setCachedDimensions(attachment.id, img.naturalWidth, img.naturalHeight);
    }
  }, [src, attachment.id]);

  const handleError = useCallback(async () => {
    // 이미 refresh 시도했으면 실패 표시
    if (refreshAttempted.current) {
      setLoadState("failed");
      return;
    }
    refreshAttempted.current = true;
    setLoadState("refreshing");

    // Signed URL 만료 → 서버에서 새 URL 가져오기
    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const refreshed = result.data[attachment.id];
      const newUrl = refreshed.thumbnailUrl ?? refreshed.publicUrl;
      setCachedUrl(attachment.id, newUrl);
      setLoadState("loading");
      setSrc(newUrl);
    } else {
      setLoadState("failed");
    }
  }, [attachment.id]);

  // 단일 이미지: 실제 치수 기반 aspect-ratio (CLS 제거), 다중 이미지: 균일 그리드
  // 우선순위: DB 치수 → 인메모리 캐시 → fallback 4:3
  const dbDims = count === 1 && attachment.width && attachment.height
    ? { width: attachment.width, height: attachment.height }
    : null;
  const cachedDims = !dbDims && count === 1 ? getCachedDimensions(attachment.id) : null;
  const knownDims = dbDims ?? cachedDims;
  const sizeStyle = knownDims
    ? { aspectRatio: `${knownDims.width} / ${knownDims.height}` } as const
    : undefined;
  const hasRealDimensions = !!knownDims;
  const sizeClass = cn(
    count === 1 && !hasRealDimensions && "aspect-[4/3]",
    count === 1 && "max-h-80 w-full",
    count === 2 && "aspect-square",
    count >= 3 && index === 0 && count === 3 && "row-span-2 aspect-[3/4]",
    count >= 3 && index > 0 && "aspect-square",
  );

  if (loadState === "failed") {
    return (
      <div className={cn("flex items-center justify-center bg-bg-secondary", sizeClass)} style={sizeStyle}>
        <ImageOff className="w-8 h-8 text-text-tertiary" />
      </div>
    );
  }

  return (
    <button
      key={attachment.id}
      type="button"
      onClick={() => onImageClick?.(attachment, index)}
      className={cn(
        "relative overflow-hidden bg-bg-secondary",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        sizeClass,
      )}
      style={sizeStyle}
      aria-label={`이미지: ${attachment.file_name}`}
    >
      {/* 로딩/리프레시 중 스켈레톤 (실제 치수 크기 유지) */}
      {loadState !== "loaded" && (
        <div className="absolute inset-0 bg-bg-secondary animate-pulse" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={attachment.file_name}
        className={cn(
          "w-full h-full object-cover",
          "transition-opacity duration-200 ease-out",
          loadState !== "loaded" ? "opacity-0" : "opacity-100",
        )}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
      {count > 4 && index === 3 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white text-lg font-medium">+{count - 4}</span>
        </div>
      )}
    </button>
  );
}

/** 미디어(비디오/오디오) 로딩 상태 */
type MediaLoadState = "ready" | "refreshing" | "failed";

/** 비디오 인라인 플레이어 (만료 시 자동 refresh) */
function VideoPlayer({
  attachment,
  isOwn,
}: {
  attachment: ChatAttachment;
  isOwn: boolean;
}) {
  const cachedUrl = getCachedUrl(attachment.id, attachment.public_url);
  const [src, setSrc] = useState(cachedUrl);
  const [loadState, setLoadState] = useState<MediaLoadState>("ready");
  const refreshAttempted = useRef(cachedUrl !== attachment.public_url);

  const handleError = useCallback(async () => {
    if (refreshAttempted.current) {
      setLoadState("failed");
      return;
    }
    refreshAttempted.current = true;
    setLoadState("refreshing");

    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const newUrl = result.data[attachment.id].publicUrl;
      setCachedUrl(attachment.id, newUrl);
      setSrc(newUrl);
      setLoadState("ready");
    } else {
      setLoadState("failed");
    }
  }, [attachment.id]);

  const handleDownload = useCallback(() => {
    window.open(src, "_blank", "noopener");
  }, [src]);

  if (loadState === "failed") {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 rounded-lg aspect-video max-h-48",
        isOwn ? "bg-white/20" : "bg-bg-secondary"
      )}>
        <Film className="w-6 h-6 text-text-tertiary" />
        <span className="text-xs text-text-tertiary">재생할 수 없는 동영상</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden max-w-full",
        isOwn ? "bg-white/20" : "bg-bg-secondary"
      )}
    >
      {loadState === "refreshing" ? (
        <div className="w-full aspect-video max-h-48 bg-bg-secondary animate-pulse flex items-center justify-center">
          <Film className="w-8 h-8 text-text-tertiary animate-pulse" />
        </div>
      ) : (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          className="w-full aspect-video max-h-48 object-contain bg-black"
          controlsList="nodownload"
          onError={handleError}
        />
      )}
      <div className="flex items-center justify-between px-2 py-1">
        <span
          className={cn(
            "text-xs truncate flex-1 min-w-0",
            isOwn ? "text-white/80" : "text-text-tertiary"
          )}
        >
          {attachment.file_name}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            isOwn
              ? "hover:bg-white/25 active:bg-white/30 focus-visible:ring-white/60"
              : "hover:bg-bg-tertiary active:bg-bg-tertiary focus-visible:ring-primary"
          )}
          aria-label="다운로드"
        >
          <Download
            className={cn(
              "w-3.5 h-3.5",
              isOwn ? "text-white/80" : "text-text-tertiary"
            )}
          />
        </button>
      </div>
    </div>
  );
}

/** 오디오 인라인 플레이어 (만료 시 자동 refresh) */
function AudioPlayer({
  attachment,
  isOwn,
}: {
  attachment: ChatAttachment;
  isOwn: boolean;
}) {
  const cachedUrl = getCachedUrl(attachment.id, attachment.public_url);
  const [src, setSrc] = useState(cachedUrl);
  const [loadState, setLoadState] = useState<MediaLoadState>("ready");
  const refreshAttempted = useRef(cachedUrl !== attachment.public_url);

  const handleError = useCallback(async () => {
    if (refreshAttempted.current) {
      setLoadState("failed");
      return;
    }
    refreshAttempted.current = true;
    setLoadState("refreshing");

    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const newUrl = result.data[attachment.id].publicUrl;
      setCachedUrl(attachment.id, newUrl);
      setSrc(newUrl);
      setLoadState("ready");
    } else {
      setLoadState("failed");
    }
  }, [attachment.id]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg max-w-full",
        isOwn ? "bg-white/20" : "bg-bg-secondary"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          isOwn ? "bg-white/25" : "bg-primary-500/10"
        )}
      >
        <Music className={cn("w-5 h-5", isOwn ? "text-white" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            isOwn ? "text-white" : "text-text-primary"
          )}
        >
          {attachment.file_name}
        </p>
        {loadState === "refreshing" ? (
          <div className="w-full h-8 mt-1 bg-bg-secondary animate-pulse rounded" />
        ) : loadState === "failed" ? (
          <p className="text-xs text-text-tertiary mt-1">재생할 수 없는 오디오</p>
        ) : (
           
          <audio
            src={src}
            controls
            preload="metadata"
            className="w-full h-8 mt-1"
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
}

/** 파일 카드 (문서 등, 만료 시 자동 refresh) */
function FileCard({
  attachment,
  isOwn,
  showSaveToDrive,
}: {
  attachment: ChatAttachment;
  isOwn: boolean;
  showSaveToDrive?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const cachedUrl = getCachedUrl(attachment.id, attachment.public_url);
  const [downloadUrl, setDownloadUrl] = useState(cachedUrl);
  const refreshAttempted = useRef(cachedUrl !== attachment.public_url);

  const handleDownload = useCallback(async () => {
    // 먼저 현재 URL로 시도
    const res = await fetch(downloadUrl, { method: "HEAD" }).catch(() => null);
    if (res && res.ok) {
      window.open(downloadUrl, "_blank", "noopener");
      return;
    }

    // 403 등 실패 → refresh 시도 (1회만)
    if (!refreshAttempted.current) {
      refreshAttempted.current = true;
      const result = await refreshAttachmentUrlsAction([attachment.id]);
      if (result.success && result.data?.[attachment.id]) {
        const newUrl = result.data[attachment.id].publicUrl;
        setCachedUrl(attachment.id, newUrl);
        setDownloadUrl(newUrl);
        window.open(newUrl, "_blank", "noopener");
        return;
      }
    }

    // fallback: 그래도 열기 시도 (브라우저가 에러 표시)
    window.open(downloadUrl, "_blank", "noopener");
  }, [downloadUrl, attachment.id]);

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (saving || saved) return;
      setSaving(true);
      try {
        const result = await saveChatAttachmentToDriveAction({
          attachmentId: attachment.id,
        });
        if (result.success) {
          setSaved(true);
        }
      } catch {
        // Silent fail — user can retry
      } finally {
        setSaving(false);
      }
    },
    [attachment.id, saving, saved]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg max-w-full",
        "transition-colors",
        isOwn
          ? "bg-white/20"
          : "bg-bg-secondary"
      )}
    >
      <button
        type="button"
        onClick={handleDownload}
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          isOwn ? "bg-white/25" : "bg-primary-500/10"
        )}
      >
        <FileText className={cn("w-5 h-5", isOwn ? "text-white" : "text-primary")} />
      </button>
      <button type="button" onClick={handleDownload} className="flex-1 min-w-0 text-left">
        <p
          className={cn(
            "text-sm truncate",
            isOwn ? "text-white" : "text-text-primary"
          )}
        >
          {attachment.file_name}
        </p>
        <p
          className={cn(
            "text-xs",
            isOwn ? "text-white/80" : "text-text-tertiary"
          )}
        >
          {getFileTypeLabel(attachment.mime_type)} · {formatFileSize(attachment.file_size)}
        </p>
      </button>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {showSaveToDrive && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-full transition-colors",
              saved
                ? ""
                : isOwn
                  ? "hover:bg-white/25"
                  : "hover:bg-bg-tertiary",
            )}
            title={saved ? "저장됨" : "드라이브에 저장"}
          >
            <HardDrive
              className={cn(
                "w-3.5 h-3.5",
                saved
                  ? "text-green-500"
                  : saving
                    ? "animate-pulse text-gray-400"
                    : isOwn
                      ? "text-white/70"
                      : "text-text-tertiary"
              )}
            />
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-full transition-colors",
            isOwn ? "hover:bg-white/25" : "hover:bg-bg-tertiary",
          )}
          aria-label="다운로드"
        >
          <Download
            className={cn(
              "w-3.5 h-3.5",
              isOwn ? "text-white/80" : "text-text-tertiary"
            )}
          />
        </button>
      </div>
    </div>
  );
}

export const AttachmentRenderer = memo(AttachmentRendererComponent);
