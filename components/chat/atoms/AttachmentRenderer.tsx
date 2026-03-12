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

/** 이미지 그리드 (1장: 풀, 2장: 2열, 3+: 그리드) */
function ImageGrid({
  images,
  onImageClick,
}: {
  images: ChatAttachment[];
  onImageClick?: (attachment: ChatAttachment, index: number) => void;
}) {
  const count = images.length;

  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg overflow-hidden border border-border/30",
        count === 1 && "grid-cols-1",
        count === 2 && "grid-cols-2",
        count >= 3 && "grid-cols-2"
      )}
    >
      {images.map((img, idx) => (
        <ImageItem
          key={img.id}
          attachment={img}
          index={idx}
          count={count}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}

/** 개별 이미지 (만료 시 자동 refresh) */
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
  const [src, setSrc] = useState(attachment.thumbnail_url ?? attachment.public_url);
  const [failed, setFailed] = useState(false);
  const refreshAttempted = useRef(false);

  const handleError = useCallback(async () => {
    // 이미 refresh 시도했으면 실패 표시
    if (refreshAttempted.current) {
      setFailed(true);
      return;
    }
    refreshAttempted.current = true;

    // Signed URL 만료 → 서버에서 새 URL 가져오기
    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const refreshed = result.data[attachment.id];
      setSrc(refreshed.thumbnailUrl ?? refreshed.publicUrl);
    } else {
      setFailed(true);
    }
  }, [attachment.id]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-bg-secondary",
          count === 1 && "max-h-64 min-h-32 w-full",
          count === 2 && "aspect-square",
          count >= 3 && index === 0 && count === 3 && "row-span-2 aspect-[3/4]",
          count >= 3 && index > 0 && "aspect-square"
        )}
      >
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
        count === 1 && "max-h-64 min-h-32",
        count === 2 && "aspect-square",
        count >= 3 && index === 0 && count === 3 && "row-span-2 aspect-[3/4]",
        count >= 3 && index > 0 && "aspect-square"
      )}
      aria-label={`이미지: ${attachment.file_name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={attachment.file_name}
        className="w-full h-full object-cover"
        loading="lazy"
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

/** 비디오 인라인 플레이어 */
function VideoPlayer({
  attachment,
  isOwn,
}: {
  attachment: ChatAttachment;
  isOwn: boolean;
}) {
  const handleDownload = useCallback(() => {
    window.open(attachment.public_url, "_blank", "noopener");
  }, [attachment.public_url]);

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden max-w-full",
        isOwn ? "bg-white/20" : "bg-bg-secondary"
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={attachment.public_url}
        controls
        preload="metadata"
        playsInline
        className="w-full max-h-48 object-contain"
        controlsList="nodownload"
      />
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

/** 오디오 인라인 플레이어 */
function AudioPlayer({
  attachment,
  isOwn,
}: {
  attachment: ChatAttachment;
  isOwn: boolean;
}) {
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
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          src={attachment.public_url}
          controls
          preload="metadata"
          className="w-full h-8 mt-1"
        />
      </div>
    </div>
  );
}

/** 파일 카드 (문서 등) */
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

  const handleDownload = useCallback(() => {
    window.open(attachment.public_url, "_blank", "noopener");
  }, [attachment.public_url]);

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
