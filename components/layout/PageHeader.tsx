import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  level?: "h1" | "h2";
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
}: PageHeaderProps) {
  const HeadingTag = level;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <HeadingTag className="text-h1 text-gray-900 dark:text-gray-100">{title}</HeadingTag>
          {description && (
            <p className="text-body-2 text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
