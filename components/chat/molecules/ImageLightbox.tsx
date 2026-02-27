"use client";

/**
 * ImageLightbox - 전체 화면 이미지 뷰어
 *
 * 모바일: 핀치 줌, 스와이프 넘기기
 * 데스크톱: 좌우 화살표, ESC 닫기
 */

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { ChatAttachment } from "@/lib/domains/chat/types";
import { formatFileSize } from "@/lib/domains/chat/fileValidation";
import {
  getAttachmentExpiryInfo,
  shouldShowExpiryBadge,
} from "@/lib/domains/chat/attachmentExpiry";

interface ImageLightboxProps {
  images: ChatAttachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Inner viewer — isOpen=true 일 때만 마운트됩니다.
 * key={initialIndex}를 통해 열릴 때마다 state 리셋.
 */
function LightboxViewer({
  images,
  initialIndex,
  onClose,
}: Omit<ImageLightboxProps, "isOpen">) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const backdropRef = useRef<HTMLDivElement>(null);

  // ESC 키 닫기 + 스크롤 방지
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          setCurrentIndex((i) => Math.max(0, i - 1));
          break;
        case "ArrowRight":
          setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, images.length]);

  // 스와이프 제스처
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;

      // 수평 스와이프가 수직보다 큰 경우만
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0 && currentIndex > 0) {
          setCurrentIndex((i) => i - 1);
        } else if (dx < 0 && currentIndex < images.length - 1) {
          setCurrentIndex((i) => i + 1);
        }
      }
    },
    [currentIndex, images.length]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleDownload = useCallback(() => {
    const image = images[currentIndex];
    if (image) {
      window.open(image.public_url, "_blank", "noopener");
    }
  }, [images, currentIndex]);

  const current = images[currentIndex];
  if (!current) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 뷰어"
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-14 flex-shrink-0">
        <span className="text-white/60 text-sm">
          {images.length > 1 && `${currentIndex + 1} / ${images.length}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="w-11 h-11 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="다운로드"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="닫기"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div className="flex-1 flex items-center justify-center px-4 pb-[env(safe-area-inset-bottom)] touch-pinch-zoom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.public_url}
          alt={current.file_name}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>

      {/* 좌우 화살표 (데스크톱, 2장 이상) */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
              aria-label="이전 이미지"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
              aria-label="다음 이미지"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}

      {/* 하단 파일명 + 용량 + 만료 경고 */}
      <div className="text-center pb-4 pb-[env(safe-area-inset-bottom)] flex flex-col items-center gap-1">
        <p className="text-white/40 text-xs truncate px-8">
          {current.file_name}
          {" "}
          <span className="text-white/30">({formatFileSize(current.file_size)})</span>
        </p>
        {shouldShowExpiryBadge(current.created_at) && (
          <p className={`text-xs ${
            getAttachmentExpiryInfo(current.created_at).level === "critical"
              ? "text-error-400"
              : "text-warning-400"
          }`}>
            {getAttachmentExpiryInfo(current.created_at).label} 후 자동 삭제
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper: isOpen이 true일 때만 inner viewer를 마운트.
 * key를 사용하여 열릴 때마다 initialIndex로 state 리셋.
 */
function ImageLightboxComponent({
  images,
  initialIndex,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  if (!isOpen || images.length === 0) return null;

  return (
    <LightboxViewer
      key={initialIndex}
      images={images}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
}

export const ImageLightbox = memo(ImageLightboxComponent);
