"use client";

import { memo, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/atoms/Skeleton";
import { EmptyState } from "@/components/molecules/EmptyState";

// ============================================
// Types
// ============================================

export type Column<T> = {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => ReactNode;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  loadingRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
  stickyHeader?: boolean;
  compact?: boolean;
};

// ============================================
// DataTable 컴포넌트
// ============================================

function DataTableComponent<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  loadingRows = 5,
  emptyTitle = "데이터가 없습니다",
  emptyDescription,
  emptyIcon,
  onRowClick,
  className,
  stickyHeader = false,
  compact = false,
}: DataTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (!isLoading && data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        variant="compact"
      />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead
            className={cn(
              "bg-gray-50",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-gray-200 font-semibold text-gray-700",
                    compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
                    alignClasses[column.align || "left"]
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {isLoading
              ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-b border-gray-100",
                          compact ? "px-3 py-2" : "px-4 py-3"
                        )}
                      >
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((item, index) => (
                  <tr
                    key={keyExtractor(item, index)}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "border-b border-gray-100 last:border-b-0",
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-gray-50"
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
                          alignClasses[column.align || "left"]
                        )}
                      >
                        {column.render
                          ? column.render(item, index)
                          : (item as Record<string, unknown>)[column.key] as ReactNode}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DataTable = memo(DataTableComponent) as <T>(
  props: DataTableProps<T>
) => JSX.Element;

export default DataTable;

