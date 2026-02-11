"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import type { OutstandingPayment } from "@/lib/domains/payment/actions/outstanding";

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function getOverdueBadge(days: number) {
  if (days < 0) {
    return {
      label: `D${days}`,
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    };
  }
  if (days === 0) {
    return {
      label: "오늘",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    };
  }
  if (days <= 7) {
    return {
      label: `+${days}일`,
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    };
  }
  return {
    label: `+${days}일`,
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
}

type OutstandingPaymentsTableProps = {
  payments: OutstandingPayment[];
  isLoading: boolean;
  onRefresh: () => void;
};

export function OutstandingPaymentsTable({
  payments,
  isLoading,
  onRefresh,
}: OutstandingPaymentsTableProps) {
  if (isLoading && payments.length === 0) {
    return (
      <div
        className={cn("rounded-lg border p-6", borderDefault, bgSurface)}
      >
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border p-8 text-center",
          borderDefault,
          bgSurface
        )}
      >
        <p className={cn("text-sm", textSecondary)}>미수금 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        borderDefault,
        bgSurface
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium",
                  textSecondary
                )}
              >
                학생
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium",
                  textSecondary
                )}
              >
                프로그램
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-right text-xs font-medium",
                  textSecondary
                )}
              >
                청구액
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-right text-xs font-medium",
                  textSecondary
                )}
              >
                미수금
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-center text-xs font-medium",
                  textSecondary
                )}
              >
                납부기한
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-center text-xs font-medium",
                  textSecondary
                )}
              >
                연체
              </th>
              <th
                className={cn(
                  "px-4 py-3 text-center text-xs font-medium",
                  textSecondary
                )}
              >
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {payments.map((p) => {
              const outstanding = p.amount - p.paid_amount;
              const badge = p.due_date
                ? getOverdueBadge(p.days_overdue)
                : null;

              return (
                <tr
                  key={p.id}
                  className="transition hover:bg-gray-50 dark:hover:bg-gray-800/30"
                >
                  <td className={cn("px-4 py-3 font-medium", textPrimary)}>
                    {p.student_name}
                  </td>
                  <td className={cn("px-4 py-3", textSecondary)}>
                    {p.program_name}
                  </td>
                  <td
                    className={cn("px-4 py-3 text-right tabular-nums", textPrimary)}
                  >
                    ₩{formatKRW(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                    ₩{formatKRW(outstanding)}
                  </td>
                  <td className={cn("px-4 py-3 text-center text-xs", textSecondary)}>
                    {p.due_date
                      ? new Date(p.due_date + "T00:00:00").toLocaleDateString(
                          "ko-KR",
                          { month: "2-digit", day: "2-digit" }
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {badge && (
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/students/${p.student_id}?tab=enrollment`}
                      className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
