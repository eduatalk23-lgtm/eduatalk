"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import Button from "@/components/atoms/Button";
import {
  getPaymentLinkStatsAction,
  getPaymentLinksAction,
  type PaymentLinkStats,
  type PaymentLinkListItem,
  type PaymentLinkFilters,
} from "@/lib/domains/payment/paymentLink/queries";
import { PaymentLinksTable } from "./PaymentLinksTable";
import { BulkPaymentLinkModal } from "./BulkPaymentLinkModal";
import type { PaymentLinkStatus } from "@/lib/domains/payment/paymentLink/types";

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function PaymentLinkDashboardClient() {
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<PaymentLinkStats | null>(null);
  const [links, setLinks] = useState<PaymentLinkListItem[]>([]);
  const [filters, setFilters] = useState<PaymentLinkFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [statsResult, linksResult] = await Promise.all([
        getPaymentLinkStatsAction(),
        getPaymentLinksAction(filters),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      if (linksResult.success && linksResult.data) {
        setLinks(linksResult.data);
      }
    });
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statCards = stats
    ? [
        {
          label: "전체 링크",
          value: `${stats.total}건`,
          color: textPrimary,
        },
        {
          label: "활성 (발송됨)",
          value: `${stats.active}건`,
          color: "text-blue-600 dark:text-blue-400",
        },
        {
          label: "결제 완료",
          value: `${stats.completed}건`,
          sub: `₩${formatKRW(stats.paidAmount)}`,
          color: "text-green-600 dark:text-green-400",
        },
        {
          label: "전환율",
          value: `${stats.conversionRate}%`,
          color:
            stats.conversionRate >= 50
              ? "text-green-600 dark:text-green-400"
              : "text-orange-600 dark:text-orange-400",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Cards */}
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
                {"sub" in card && card.sub && (
                  <p className={cn("mt-0.5 text-xs", textSecondary)}>
                    {card.sub}
                  </p>
                )}
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

      {/* Actions + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* 상태 필터 */}
          <select
            value={filters.status ?? "all"}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value as PaymentLinkStatus | "all",
              }))
            }
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              borderDefault,
              bgSurface,
              textPrimary
            )}
          >
            <option value="all">전체 상태</option>
            <option value="active">활성</option>
            <option value="completed">결제완료</option>
            <option value="expired">만료</option>
            <option value="cancelled">취소</option>
          </select>

          {/* 검색 */}
          <input
            type="text"
            placeholder="학생명, 프로그램명, 전화번호"
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                setFilters((f) => ({
                  ...f,
                  search: val || undefined,
                }));
              }, 300);
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              borderDefault,
              bgSurface,
              textPrimary,
              "w-60"
            )}
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowBulkModal(true)}
        >
          일괄 링크 발송
        </Button>
      </div>

      {/* Table */}
      <PaymentLinksTable
        links={links}
        isLoading={isPending}
        onRefresh={loadData}
      />

      {/* Bulk Modal */}
      <BulkPaymentLinkModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        onSuccess={loadData}
      />
    </div>
  );
}
