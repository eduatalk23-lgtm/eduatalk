"use client";

import { memo, useState } from "react";
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
  const [imageError, setImageError] = useState(false);
  const initials = name ? getInitials(name) : "";
  const bgColor = name ? getColorFromName(name) : "bg-gray-400";

  const showImage = src && !imageError;
  const showInitials = !showImage && initials;
  const showIcon = !showImage && !showInitials;

  return (
    <div className={cn("relative inline-flex", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden",
          "font-medium text-white",
          sizeClasses[size],
          variantClasses[variant],
          !showImage && bgColor
        )}
        role="img"
        aria-label={alt || name || "아바타"}
      >
        {showImage && (
          <img
            src={src}
            alt={alt || name || "아바타"}
            className="size-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
        {showInitials && (
          <span aria-hidden="true">{initials}</span>
        )}
        {showIcon && (
          <User className={iconSizeClasses[size]} aria-hidden="true" />
        )}
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
