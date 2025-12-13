"use client";

import { memo, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

function PageHeaderComponent({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 text-gray-900">{title}</h1>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </div>
  );
}

export const PageHeader = memo(PageHeaderComponent);
export default PageHeader;

