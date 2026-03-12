"use client";

import { memo, useState, useEffect, useLayoutEffect, useCallback } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarVariant = "circle" | "rounded" | "square";

export type AvatarProps = {
  /** 이미지 URL */
  src?: string | null;
  /** 대체 텍스트 */
  alt?: string;
  /** 이름 (이니셜 폴백에 사용) */
  name?: string;
  /** 크기 */
  size?: AvatarSize;
  /** 모양 */
  variant?: AvatarVariant;
  /** 추가 클래스 */
  className?: string;
  /** 온라인 상태 표시 */
  showStatus?: boolean;
  /** 온라인 여부 */
  isOnline?: boolean;
};

const sizeClasses: Record<AvatarSize, string> = {
  xs: "size-6 text-xs",
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
  xl: "size-16 text-xl",
};

/** Next.js Image 최적화를 위한 픽셀 크기 매핑 */
const sizePixels: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const iconSizeClasses: Record<AvatarSize, string> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
};

const statusSizeClasses: Record<AvatarSize, string> = {
  xs: "size-1.5 border",
  sm: "size-2 border",
  md: "size-2.5 border-2",
  lg: "size-3 border-2",
  xl: "size-4 border-2",
};

const variantClasses: Record<AvatarVariant, string> = {
  circle: "rounded-full",
  rounded: "rounded-lg",
  square: "rounded-none",
};

/** 모듈 레벨 이미지 로드 캐시 — 같은 URL은 어디서든 즉시 렌더링 */
const imageStatusCache = new Map<string, "loaded" | "error">();

type ImageStatus = "idle" | "loading" | "loaded" | "error";

/**
 * 이미지 로딩 상태 훅 (Radix UI Avatar 패턴)
 * - SSR 안전: 초기값은 항상 loading → hydration mismatch 방지
 * - useLayoutEffect에서 캐시 동기 체크 → paint 전 업데이트로 깜빡임 없음
 * - 모듈 레벨 Map 캐시로 동일 URL 재사용 시 즉시 표시
 */
function useImageLoadingStatus(src: string | null | undefined): ImageStatus {
  const [status, setStatus] = useState<ImageStatus>(src ? "loading" : "idle");

  // paint 전에 캐시된 이미지를 동기적으로 감지 (hydration 직후, paint 전)
  useLayoutEffect(() => {
    if (!src) {
      setStatus("idle");
      return;
    }
    // 앱 내 캐시 확인
    const cached = imageStatusCache.get(src);
    if (cached) {
      setStatus(cached);
      return;
    }
    // 브라우저 캐시 확인 (동기적 — cached image는 complete=true)
    const img = new window.Image();
    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      imageStatusCache.set(src, "loaded");
      setStatus("loaded");
    }
  }, [src]);

  // 캐시 미스 시 비동기 로드
  useEffect(() => {
    if (!src || imageStatusCache.has(src)) return;

    const img = new window.Image();
    img.onload = () => {
      imageStatusCache.set(src, "loaded");
      setStatus("loaded");
    };
    img.onerror = () => {
      imageStatusCache.set(src, "error");
      setStatus("error");
    };
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return status;
}

/** Fallback 지연 표시 — 빠른 네트워크에서는 fallback을 아예 안 보여줌 */
const FALLBACK_DELAY_MS = 400;

function useFallbackDelay(status: ImageStatus): boolean {
  const [show, setShow] = useState(() => status !== "loading");

  useEffect(() => {
    if (status !== "loading") {
      setShow(true);
      return;
    }
    setShow(false);
    const timer = setTimeout(() => setShow(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return show;
}

/**
 * 이름에서 이니셜 추출
 * 한글: 첫 글자, 영어: 첫 두 글자 (성+이름)
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  // 한글 이름인 경우 첫 글자만
  if (/^[가-힣]/.test(trimmed)) {
    return trimmed.charAt(0);
  }

  // 영어 이름인 경우 첫 두 단어의 첫 글자
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

/**
 * 이름 기반 배경색 생성
 * 일관된 색상을 위해 이름의 해시값 사용
 */
function getColorFromName(name: string): string {
  const colors = [
    "bg-indigo-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-orange-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Next.js Image 최적화 가능한 호스트네임 (환경변수 기반) */
const optimizableHostname = (() => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return supabaseUrl ? new URL(supabaseUrl).hostname : null;
  } catch {
    return null;
  }
})();

/** 외부 URL 여부 판별 (Next.js Image 사용 가능 여부) */
function isOptimizableUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  if (!optimizableHostname) return false;
  try {
    return new URL(url).hostname === optimizableHostname;
  } catch {
    return false;
  }
}

function AvatarComponent({
  src,
  alt,
  name,
  size = "md",
  variant = "circle",
  className,
  showStatus = false,
  isOnline = false,
}: AvatarProps) {
  const imageStatus = useImageLoadingStatus(src);
  const showFallback = useFallbackDelay(imageStatus);

  const isLoaded = imageStatus === "loaded";
  const isError = imageStatus === "error";
  const hasSrc = !!src && !isError;

  const initials = name ? getInitials(name) : "";
  const bgColor = name ? getColorFromName(name) : "bg-gray-400";
  const useNextImage = hasSrc && isOptimizableUrl(src);
  const pixels = sizePixels[size];

  const handleImageError = useCallback(() => {
    if (src) imageStatusCache.set(src, "error");
  }, [src]);

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden isolate",
          "font-medium text-white",
          sizeClasses[size],
          variantClasses[variant],
          bgColor
        )}
        role="img"
        aria-label={alt || name || "아바타"}
      >
        {/* 이니셜/아이콘 폴백 — 이미지 로드 전까지 지연 표시 */}
        {!isLoaded && showFallback && (
          initials ? (
            <span aria-hidden="true">{initials}</span>
          ) : (
            <User className={iconSizeClasses[size]} aria-hidden="true" />
          )
        )}

        {/* 이미지 오버레이 — 로드 완료 시 즉시 또는 fade-in */}
        {hasSrc &&
          (useNextImage ? (
            <Image
              src={src}
              alt={alt || name || "아바타"}
              width={pixels}
              height={pixels}
              draggable={false}
              className={cn(
                "absolute inset-0 size-full object-cover",
                isLoaded
                  ? "opacity-100"
                  : "opacity-0 transition-opacity duration-200"
              )}
              onError={handleImageError}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || name || "아바타"}
              draggable={false}
              className={cn(
                "absolute inset-0 size-full object-cover",
                isLoaded
                  ? "opacity-100"
                  : "opacity-0 transition-opacity duration-200"
              )}
              onError={handleImageError}
            />
          ))}
      </div>

      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block border-white",
            statusSizeClasses[size],
            variantClasses[variant],
            isOnline ? "bg-emerald-500" : "bg-gray-400"
          )}
          aria-label={isOnline ? "온라인" : "오프라인"}
        />
      )}
    </div>
  );
}

export const Avatar = memo(AvatarComponent);
Avatar.displayName = "Avatar";
export default Avatar;
