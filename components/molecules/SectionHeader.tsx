"use client";

import { memo, ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/cn";

import { textPrimaryVar, textSecondaryVar } from "@/lib/utils/darkMode";

export type SectionHeaderProps = {
  title: string;
  description?: string;
  /* Action Area */
  action?: ReactNode;      // 커스텀 컴포넌트 (버튼 등)
  actionLabel?: string;    // 링크 텍스트
  actionHref?: string;     // 링크 주소
  /* Style */
  className?: string;
  size?: "sm" | "md" | "lg";
  level?: "h1" | "h2";     // 시멘틱 태그 레벨
};

const sizeClasses = {
  sm: {
    title: "text-body-2-bold",
    description: "text-body-2",
  },
  md: {
    title: "text-h2",
    description: "text-body-2",
  },
  lg: {
    title: "text-h1",
    description: "text-body-1",
  },
};

function SectionHeaderComponent({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  className,
  size,
  level = "h2",
}: SectionHeaderProps) {
  // size가 없으면 level에 따라 기본값 설정 (h1->lg, h2->md)
  const effectiveSize = size ?? (level === "h1" ? "lg" : "md");
  const HeadingTag = level;



  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <HeadingTag
          className={cn(
            sizeClasses[effectiveSize].title,
            textPrimaryVar
          )}
        >
          {title}
        </HeadingTag>
        {description && (
          <p className={cn(sizeClasses[effectiveSize].description, textSecondaryVar)}>
            {description}
          </p>
        )}
      </div>
      
      {/* Action Area: Link 또는 Custom Component */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="text-body-2 font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            {actionLabel} →
          </Link>
        )}
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export const SectionHeader = memo(SectionHeaderComponent);
export default SectionHeader;

