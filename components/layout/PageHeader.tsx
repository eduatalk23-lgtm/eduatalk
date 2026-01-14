import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { textPrimaryVar, textSecondaryVar, textTertiaryVar } from "@/lib/utils/darkMode";
import { ChevronLeft } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  level?: "h1" | "h2";
  /** 뒤로가기 링크 URL */
  backHref?: string;
  /** 뒤로가기 링크 라벨 (기본값: "뒤로 가기") */
  backLabel?: string;
};

/**
 * 페이지 헤더 컴포넌트
 * 
 * 일관된 페이지 제목 표시를 제공합니다.
 * Spacing-First 정책을 준수하며, gap을 사용하여 요소 간 간격을 관리합니다.
 * 
 * @example
 * <PageHeader 
 *   title="학생 상세" 
 *   description="학생 정보를 확인하고 관리할 수 있습니다"
 * />
 */
export function PageHeader({
  title,
  description,
  action,
  className,
  level = "h1",
  backHref,
  backLabel = "뒤로 가기",
}: PageHeaderProps) {
  const HeadingTag = level;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline w-fit",
            textTertiaryVar,
            "hover:text-[rgb(var(--color-primary-600))] dark:hover:text-[rgb(var(--color-primary-400))]"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <HeadingTag className={cn("text-h1", textPrimaryVar)}>{title}</HeadingTag>
          {description && (
            <p className={cn("text-body-2", textSecondaryVar)}>{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
