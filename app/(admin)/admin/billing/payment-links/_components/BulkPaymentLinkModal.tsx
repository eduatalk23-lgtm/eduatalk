"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderDefault } from "@/lib/utils/darkMode";
import { getUnpaidRecordsForBulkAction } from "@/lib/domains/payment/paymentLink/queries";
import { createPaymentLinkAction } from "@/lib/domains/payment/paymentLink/actions";
import type { DeliveryMethod } from "@/lib/domains/payment/paymentLink/types";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

type UnpaidRecord = {
  id: string;
  student_name: string;
  program_name: string;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  billing_period: string | null;
  has_active_link: boolean;
};

type BulkPaymentLinkModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function BulkPaymentLinkModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkPaymentLinkModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [records, setRecords] = useState<UnpaidRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("sms");
  const [phone, setPhone] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(72);

  // 진행 상태
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setIsSending(false);
      setProgress({ done: 0, total: 0, failed: 0 });
      cancelRef.current = false;
      return;
    }

    setIsLoading(true);
    startTransition(async () => {
      const result = await getUnpaidRecordsForBulkAction();
      if (result.success && result.data) {
        setRecords(result.data);
      }
      setIsLoading(false);
    });
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const handleBulkSend = async () => {
    const selected = records.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;

    cancelRef.current = false;
    setIsSending(true);
    setProgress({ done: 0, total: selected.length, failed: 0 });

    let failed = 0;
    let processed = 0;
    for (let i = 0; i < selected.length; i++) {
      if (cancelRef.current) break;

      const record = selected[i];
      const result = await createPaymentLinkAction({
        paymentRecordId: record.id,
        recipientPhone: deliveryMethod !== "manual" ? phone : undefined,
        deliveryMethod,
        expiresInHours,
      });

      if (!result.success) {
        failed++;
      }
      processed = i + 1;

      setProgress({ done: processed, total: selected.length, failed });

      // Rate limit 방지
      if (i < selected.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (cancelRef.current) {
      toast.showSuccess(
        `${processed - failed}건 발송 완료 (${selected.length - processed}건 취소됨)`
      );
    } else if (failed === 0) {
      toast.showSuccess(`${selected.length}건의 결제 링크가 생성되었습니다.`);
    } else {
      toast.showError(
        `${selected.length - failed}건 성공, ${failed}건 실패`
      );
    }

    onSuccess();
    onOpenChange(false);
  };

  const handleCancelSend = () => {
    cancelRef.current = true;
  };

  const selectableRecords = records.filter((r) => !r.has_active_link);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="일괄 결제 링크 발송"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 p-4">
        {isSending ? (
          // 진행 상태
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className={cn("text-sm", textPrimary)}>
              {progress.done} / {progress.total}건 처리 중...
              {progress.failed > 0 && (
                <span className="ml-2 text-red-500">
                  ({progress.failed}건 실패)
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handleCancelSend}
              disabled={cancelRef.current}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {cancelRef.current ? "중단 중..." : "중단"}
            </button>
          </div>
        ) : (
          <>
            {/* 발송 설정 */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  발송 방법
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) =>
                    setDeliveryMethod(e.target.value as DeliveryMethod)
                  }
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    borderDefault,
                    textPrimary,
                    "bg-white dark:bg-gray-700"
                  )}
                >
                  <option value="sms">SMS</option>
                  <option value="alimtalk">알림톡</option>
                  <option value="manual">링크만 생성</option>
                </select>
              </div>

              {deliveryMethod !== "manual" && (
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", textSecondary)}>
                    수신 전화번호 (공통)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="010-0000-0000"
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      borderDefault,
                      textPrimary,
                      "bg-white dark:bg-gray-700",
                      phone && !isValidPhone(phone) && "border-red-400"
                    )}
                  />
                  {phone && !isValidPhone(phone) && (
                    <p className="text-xs text-red-500">
                      올바른 휴대폰 번호를 입력해 주세요
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  유효기간
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    borderDefault,
                    textPrimary,
                    "bg-white dark:bg-gray-700"
                  )}
                >
                  <option value={72}>72시간</option>
                  <option value={168}>7일</option>
                  <option value={720}>30일</option>
                </select>
              </div>
            </div>

            {/* 미결제 목록 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className={cn("text-sm", textSecondary)}>
                  미결제 내역을 불러오는 중...
                </p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className={cn("text-sm", textSecondary)}>
                  미결제 내역이 없습니다.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectableRecords.length > 0 &&
                            selectableRecords.every((r) =>
                              selectedIds.has(r.id)
                            )
                          }
                          onChange={toggleAll}
                          className="rounded"
                        />
                      </th>
                      <th
                        className={cn(
                          "px-3 py-2 text-left text-xs font-medium",
                          textSecondary
                        )}
                      >
                        학생
                      </th>
                      <th
                        className={cn(
                          "px-3 py-2 text-left text-xs font-medium",
                          textSecondary
                        )}
                      >
                        프로그램
                      </th>
                      <th
                        className={cn(
                          "px-3 py-2 text-right text-xs font-medium",
                          textSecondary
                        )}
                      >
                        잔액
                      </th>
                      <th
                        className={cn(
                          "px-3 py-2 text-left text-xs font-medium",
                          textSecondary
                        )}
                      >
                        기한
                      </th>
                      <th
                        className={cn(
                          "px-3 py-2 text-center text-xs font-medium",
                          textSecondary
                        )}
                      >
                        링크
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {records.map((record) => {
                      const remaining = record.amount - record.paid_amount;
                      return (
                        <tr
                          key={record.id}
                          className={cn(
                            record.has_active_link && "opacity-50"
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id)}
                              onChange={() => toggleSelect(record.id)}
                              disabled={record.has_active_link}
                              className="rounded"
                            />
                          </td>
                          <td className={cn("px-3 py-2 text-xs", textPrimary)}>
                            {record.student_name}
                          </td>
                          <td className={cn("px-3 py-2 text-xs", textPrimary)}>
                            {record.program_name}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right text-xs font-medium",
                              textPrimary
                            )}
                          >
                            {remaining.toLocaleString()}원
                          </td>
                          <td className={cn("px-3 py-2 text-xs", textSecondary)}>
                            {record.due_date ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-center text-xs">
                            {record.has_active_link ? (
                              <span className="text-blue-500">발송됨</span>
                            ) : (
                              <span className={textSecondary}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <p className={cn("text-xs", textSecondary)}>
                {selectedIds.size}건 선택됨
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleBulkSend}
                  disabled={
                    selectedIds.size === 0 ||
                    isPending ||
                    (deliveryMethod !== "manual" && !isValidPhone(phone))
                  }
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                    selectedIds.size === 0 ||
                      isPending ||
                      (deliveryMethod !== "manual" && !isValidPhone(phone))
                      ? "cursor-not-allowed bg-gray-300"
                      : "bg-blue-500 hover:bg-blue-600"
                  )}
                >
                  {selectedIds.size}건 발송
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
