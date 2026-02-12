"use client";

import { cn } from "@/lib/cn";
import type { AuthProvider } from "@/lib/utils/authProvider";
export { toAuthProvider, extractPrimaryProvider, formatRelativeTime } from "@/lib/utils/authProvider";
export type { AuthProvider } from "@/lib/utils/authProvider";

type ProviderBadgeProps = {
  provider: AuthProvider;
  size?: "sm" | "md";
  className?: string;
};

const PROVIDER_CONFIG: Record<
  AuthProvider,
  { label: string; bgClass: string; textClass: string }
> = {
  email: {
    label: "이메일",
    bgClass: "bg-gray-100 dark:bg-gray-700",
    textClass: "text-gray-700 dark:text-gray-300",
  },
  google: {
    label: "Google",
    bgClass: "bg-blue-50 dark:bg-blue-900/30",
    textClass: "text-blue-700 dark:text-blue-300",
  },
  kakao: {
    label: "카카오",
    bgClass: "bg-yellow-50 dark:bg-yellow-900/30",
    textClass: "text-yellow-800 dark:text-yellow-300",
  },
  phone: {
    label: "전화번호",
    bgClass: "bg-green-50 dark:bg-green-900/30",
    textClass: "text-green-700 dark:text-green-300",
  },
};

function ProviderIcon({
  provider,
  size,
}: {
  provider: AuthProvider;
  size: "sm" | "md";
}) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  if (provider === "google") {
    return (
      <svg className={iconSize} viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  if (provider === "kakao") {
    return (
      <svg className={iconSize} viewBox="0 0 24 24">
        <path
          d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.86 5.27 4.66 6.67-.15.56-.96 3.6-.99 3.83 0 0-.02.17.09.23.11.07.24.01.24.01.32-.04 3.7-2.44 4.28-2.86.56.08 1.14.12 1.72.12 5.52 0 10-3.58 10-7.94S17.52 3 12 3z"
          fill="#3C1E1E"
        />
      </svg>
    );
  }

  if (provider === "email") {
    return (
      <svg
        className={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    );
  }

  // phone
  return (
    <svg
      className={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export default function ProviderBadge({
  provider,
  size = "md",
  className,
}: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[provider];
  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-sm gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgClass,
        config.textClass,
        sizeClasses,
        className
      )}
    >
      <ProviderIcon provider={provider} size={size} />
      {config.label}
    </span>
  );
}
