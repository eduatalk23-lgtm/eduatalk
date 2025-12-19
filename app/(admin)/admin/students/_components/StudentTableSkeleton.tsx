"use client";

import { cn } from "@/lib/cn";
import {
  bgSurface,
  divideDefaultVar,
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
} from "@/lib/utils/darkMode";
import { Skeleton } from "@/components/atoms/Skeleton";

type StudentTableSkeletonProps = {
  rows?: number;
};

export function StudentTableSkeleton({ rows = 5 }: StudentTableSkeletonProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg shadow-sm", "bg-white dark:bg-gray-900")}>
      <table className="w-full">
        <thead className={cn(getGrayBgClasses("tableHeader"))}>
          <tr>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-4 rounded" variant="rectangular" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-12" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-10" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-12" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-16" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-12" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-16" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-16" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-16" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-32" variant="text" />
            </th>
            <th className={tableHeaderBase}>
              <Skeleton className="h-4 w-12" variant="text" />
            </th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className={tableRowBase}>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-4 rounded" variant="rectangular" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-20" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-8" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-5 w-16 rounded-full" variant="rectangular" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-24" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-8" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-28" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-28" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-28" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-4 w-32" variant="text" />
              </td>
              <td className={tableCellBase}>
                <Skeleton className="h-5 w-16 rounded-full" variant="rectangular" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

