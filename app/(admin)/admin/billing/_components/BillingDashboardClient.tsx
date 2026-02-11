"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import Button from "@/components/atoms/Button";
import {
  getOutstandingStatsAction,
  getOutstandingPaymentsAction,
  type OutstandingStats,
  type OutstandingPayment,
  type OutstandingFilters,
} from "@/lib/domains/payment/actions/outstanding";
import { OutstandingPaymentsTable } from "./OutstandingPaymentsTable";
import { BulkBillingModal } from "./BulkBillingModal";
import { BillingSettingsPanel } from "./BillingSettingsPanel";

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function BillingDashboardClient() {
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<OutstandingStats | null>(null);
  const [payments, setPayments] = useState<OutstandingPayment[]>([]);
  const [filters, setFilters] = useState<OutstandingFilters>({});
  const [showBulkModal, setShowBulkModal] = useState(false);

  const loadData = () => {
    startTransition(async () => {
      const [statsResult, paymentsResult] = await Promise.all([
        getOutstandingStatsAction(),
        getOutstandingPaymentsAction(filters),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      if (paymentsResult.success && paymentsResult.data) {
        setPayments(paymentsResult.data);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const statCards = stats
    ? [
        {
          label: "총 미수금",
          value: `₩${formatKRW(stats.total_outstanding)}`,
          color: "text-red-600 dark:text-red-400",
        },
        {
          label: "이번달 청구",
          value: `₩${formatKRW(stats.this_month_billed)}`,
          color: textPrimary,
        },
        {
          label: "이번달 수납",
          value: `₩${formatKRW(stats.this_month_paid)}`,
          color: "text-green-600 dark:text-green-400",
        },
        {
          label: "수납률",
          value: `${stats.collection_rate}%`,
          color:
            stats.collection_rate >= 80
              ? "text-green-600 dark:text-green-400"
              : stats.collection_rate >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats
          ? statCards.map((card) => (
              <div
                key={card.label}
                className={cn(
                  "rounded-lg border p-4",
                  borderDefault,
                  bgSurface
                )}
              >
                <p className={cn("text-xs", textSecondary)}>{card.label}</p>
                <p className={cn("mt-1 text-xl font-bold", card.color)}>
                  {card.value}
                </p>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4",
                  borderDefault,
                  bgSurface
                )}
              >
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-2 h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
      </div>

      {/* 자동 청구 설정 */}
      <BillingSettingsPanel />

      {/* 액션 버튼 */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowBulkModal(true)}
        >
          일괄 청구 생성
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.overdueLevel ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              overdueLevel: e.target.value as OutstandingFilters["overdueLevel"],
            }))
          }
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm",
            borderDefault,
            bgSurface,
            textPrimary
          )}
        >
          <option value="all">전체</option>
          <option value="upcoming">납부 예정</option>
          <option value="overdue_7">1~7일 연체</option>
          <option value="overdue_14">8~14일 연체</option>
          <option value="overdue_30">14일+ 연체</option>
        </select>

        <input
          type="month"
          value={filters.billingPeriod ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              billingPeriod: e.target.value || undefined,
            }))
          }
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm",
            borderDefault,
            bgSurface,
            textPrimary
          )}
          placeholder="청구월"
        />
      </div>

      {/* 미수금 테이블 */}
      <OutstandingPaymentsTable
        payments={payments}
        isLoading={isPending}
        onRefresh={loadData}
      />

      {/* 일괄 청구 모달 */}
      <BulkBillingModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        onSuccess={loadData}
      />
    </div>
  );
}
