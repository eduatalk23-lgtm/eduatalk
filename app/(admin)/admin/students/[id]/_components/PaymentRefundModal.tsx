"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { refundTossPaymentAction } from "@/lib/domains/payment/actions/tossPayment";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderInput,
} from "@/lib/utils/darkMode";

type PaymentRefundModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  paidAmount: number;
  programName: string;
};

export function PaymentRefundModal({
  open,
  onOpenChange,
  paymentId,
  paidAmount,
  programName,
}: PaymentRefundModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [cancelAmount, setCancelAmount] = useState<string>("");

  const handleRefund = () => {
    if (!cancelReason.trim()) {
      toast.showError("환불 사유를 입력해주세요.");
      return;
    }

    const partialAmount = isPartial ? Number(cancelAmount) : undefined;

    if (isPartial) {
      if (!cancelAmount || Number(cancelAmount) <= 0) {
        toast.showError("환불 금액을 올바르게 입력해주세요.");
        return;
      }
      if (Number(cancelAmount) > paidAmount) {
        toast.showError("환불 금액이 결제 금액을 초과할 수 없습니다.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await refundTossPaymentAction(
          paymentId,
          cancelReason,
          partialAmount
        );

        if (result.success) {
          toast.showSuccess("환불이 완료되었습니다.");
          onOpenChange(false);
          setCancelReason("");
          setCancelAmount("");
          setIsPartial(false);
          router.refresh();
        } else {
          toast.showError(result.error ?? "환불에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error ? error.message : "환불 처리 중 오류가 발생했습니다."
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="결제 환불"
      variant="destructive"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {/* 결제 정보 */}
          <div className="rounded-lg bg-secondary-50 px-4 py-3 dark:bg-secondary-700/50">
            <p className={cn("text-sm", textSecondary)}>프로그램</p>
            <p className={cn("font-medium", textPrimary)}>{programName}</p>
            <p className={cn("pt-1 text-sm", textSecondary)}>결제 금액</p>
            <p className={cn("font-medium", textPrimary)}>
              {paidAmount.toLocaleString()}원
            </p>
          </div>

          {/* 환불 사유 */}
          <div>
            <label
              htmlFor="cancel-reason"
              className={cn("pb-1 block text-sm font-medium", textPrimary)}
            >
              환불 사유 <span className="text-error-500">*</span>
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="환불 사유를 입력하세요"
              rows={3}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm",
                borderInput,
                textPrimary,
                bgSurface
              )}
            />
          </div>

          {/* 부분 환불 옵션 */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPartial}
                onChange={(e) => setIsPartial(e.target.checked)}
                className="rounded"
              />
              <span className={cn("text-sm", textPrimary)}>
                부분 환불
              </span>
            </label>

            {isPartial && (
              <div className="pt-2 flex flex-col gap-1">
                <input
                  type="number"
                  value={cancelAmount}
                  onChange={(e) => setCancelAmount(e.target.value)}
                  placeholder="환불 금액"
                  max={paidAmount}
                  min={1}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    borderInput,
                    textPrimary,
                    bgSurface
                  )}
                />
                <p className={cn("text-xs", textSecondary)}>
                  최대 {paidAmount.toLocaleString()}원
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button
          variant="destructive"
          onClick={handleRefund}
          disabled={isPending}
        >
          {isPending ? "처리 중..." : "환불하기"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
