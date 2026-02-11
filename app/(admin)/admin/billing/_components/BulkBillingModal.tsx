"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { getActiveEnrollmentsForBillingAction } from "@/lib/domains/payment/actions/outstanding";
import { bulkCreateBillingAction } from "@/lib/domains/payment/actions/billing";

type EnrollmentItem = {
  id: string;
  student_id: string;
  student_name: string;
  program_name: string;
  price: number;
  billing_type: string;
};

type BulkBillingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const BILLING_GROUP_CONFIG: {
  type: string;
  label: string;
  selectable: boolean;
}[] = [
  { type: "recurring", label: "매월 자동", selectable: true },
  { type: "one_time", label: "1회", selectable: true },
  { type: "manual", label: "수동", selectable: false },
];

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function BulkBillingModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkBillingModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [billingPeriod, setBillingPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getActiveEnrollmentsForBillingAction().then((result) => {
      if (result.success && result.data) {
        setEnrollments(result.data);
        // 기본 선택: recurring + one_time만
        const selectableIds = result.data
          .filter((e) => e.billing_type !== "manual")
          .map((e) => e.id);
        setSelectedIds(new Set(selectableIds));
      }
      setLoading(false);
    });
  }, [open]);

  const grouped = useMemo(() => {
    const map: Record<string, EnrollmentItem[]> = {};
    for (const group of BILLING_GROUP_CONFIG) {
      map[group.type] = [];
    }
    for (const e of enrollments) {
      const bt = e.billing_type || "recurring";
      if (!map[bt]) map[bt] = [];
      map[bt].push(e);
    }
    return map;
  }, [enrollments]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableEnrollments = enrollments.filter(
    (e) => e.billing_type !== "manual"
  );

  const toggleAll = () => {
    if (selectedIds.size === selectableEnrollments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEnrollments.map((e) => e.id)));
    }
  };

  const totalAmount = enrollments
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + e.price, 0);

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      toast.showError("청구할 수강을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await bulkCreateBillingAction(
        Array.from(selectedIds),
        billingPeriod
      );

      if (result.success && result.data) {
        toast.showSuccess(
          `${result.data.created}건 청구 생성 완료${result.data.skipped > 0 ? ` (${result.data.skipped}건 중복 스킵)` : ""}`
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.showError(result.error ?? "청구 생성에 실패했습니다.");
      }
    });
  };

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="lg">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className={cn("text-h2", textPrimary)}>일괄 청구 생성</h2>
          <p className={cn("mt-1 text-body-2", textSecondary)}>
            선택한 수강 건에 대해 청구를 일괄 생성합니다.
          </p>
        </div>

        {/* 청구월 */}
        <div className="flex flex-col gap-2">
          <label className={cn("text-body-2 font-semibold", textPrimary)}>
            청구월
          </label>
          <input
            type="month"
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
        </div>

        {/* 수강 목록 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              수강 목록 ({selectedIds.size}/{selectableEnrollments.length})
            </label>
            <button
              type="button"
              onClick={toggleAll}
              className={cn("text-xs underline", textSecondary)}
              disabled={isPending}
            >
              {selectedIds.size === selectableEnrollments.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              {enrollments.length === 0 ? (
                <p
                  className={cn("p-4 text-center text-sm", textSecondary)}
                >
                  활성 수강이 없습니다.
                </p>
              ) : (
                BILLING_GROUP_CONFIG.map((group) => {
                  const items = grouped[group.type] ?? [];
                  if (items.length === 0) return null;

                  return (
                    <div key={group.type}>
                      {/* 그룹 헤더 */}
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            textSecondary
                          )}
                        >
                          {group.label} ({items.length}건)
                        </span>
                        {!group.selectable && (
                          <span className="text-xs text-gray-400">
                            - 개별 학생 페이지에서 청구하세요
                          </span>
                        )}
                      </div>
                      {/* 항목 */}
                      {items.map((e) => {
                        const isManual = !group.selectable;
                        return (
                          <label
                            key={e.id}
                            className={cn(
                              "flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 transition last:border-b-0 dark:border-gray-800",
                              isManual
                                ? "cursor-default opacity-50"
                                : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(e.id)}
                              onChange={() => toggleSelect(e.id)}
                              disabled={isPending || isManual}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span
                              className={cn("flex-1 text-sm", textPrimary)}
                            >
                              {e.student_name}
                            </span>
                            <span className={cn("text-xs", textSecondary)}>
                              {e.program_name}
                            </span>
                            <span
                              className={cn(
                                "text-sm tabular-nums font-medium",
                                textPrimary
                              )}
                            >
                              ₩{formatKRW(e.price)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 합계 */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
          <span className={cn("text-sm font-medium", textSecondary)}>
            총 청구 금액
          </span>
          <span className={cn("text-lg font-bold", textPrimary)}>
            ₩{formatKRW(totalAmount)}
          </span>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || selectedIds.size === 0}
            isLoading={isPending}
          >
            {isPending ? "생성 중..." : `${selectedIds.size}건 청구 생성`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
