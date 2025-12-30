"use client";

import Link from "next/link";
import { ChevronRight, Calendar, BookOpen, Video, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BreadcrumbItem } from "@/lib/utils/breadcrumb";

export type { BreadcrumbItem };

type PlanBreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

const iconMap = {
  calendar: Calendar,
  book: BookOpen,
  lecture: Video,
  custom: FileText,
};

/**
 * 플랜 계층 구조 브레드크럼 네비게이션
 * 캘린더 > 콘텐츠 > 플랜 구조를 표시
 */
export function PlanBreadcrumb({ items, className }: PlanBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="플랜 네비게이션"
      className={cn(
        "flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400",
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon ? iconMap[item.icon] : null;

        return (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            )}

            {isLast ? (
              <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="truncate max-w-[200px]">{item.label}</span>
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="truncate max-w-[150px]">{item.label}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="truncate max-w-[150px]">{item.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
