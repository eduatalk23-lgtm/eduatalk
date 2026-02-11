"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { issueCashReceiptAction } from "@/lib/domains/payment/actions/cashReceipt";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderInput,
} from "@/lib/utils/darkMode";

type CashReceiptModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  amount: number;
  programName: string;
};

export function CashReceiptModal({
  open,
  onOpenChange,
  paymentId,
  amount,
  programName,
}: CashReceiptModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [identityNumber, setIdentityNumber] = useState("");
  const [receiptType, setReceiptType] = useState<"소득공제" | "지출증빙">(
    "소득공제"
  );

  const handleIssue = () => {
    const cleaned = identityNumber.replace(/[^0-9]/g, "");

    if (!cleaned) {
      toast.showError("식별번호를 입력해주세요.");
      return;
    }

    // 소득공제: 주민번호(13) 또는 휴대폰(10~11), 지출증빙: 사업자번호(10)
    if (receiptType === "소득공제" && cleaned.length !== 13 && cleaned.length !== 10 && cleaned.length !== 11) {
      toast.showError("주민등록번호(13자리) 또는 휴대폰번호(10~11자리)를 입력해주세요.");
      return;
    }
    if (receiptType === "지출증빙" && cleaned.length !== 10) {
      toast.showError("사업자등록번호(10자리)를 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await issueCashReceiptAction(
          paymentId,
          cleaned,
          receiptType
        );

        if (result.success) {
          toast.showSuccess("현금영수증이 발급되었습니다.");
          onOpenChange(false);
          setIdentityNumber("");
          router.refresh();
        } else {
          toast.showError(result.error ?? "발급에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "현금영수증 발급 중 오류가 발생했습니다."
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="현금영수증 발급">
      <DialogContent>
        <div className="flex flex-col gap-4">
          {/* 결제 정보 */}
          <div className="rounded-lg bg-secondary-50 px-4 py-3 dark:bg-secondary-700/50">
            <p className={cn("text-sm", textSecondary)}>프로그램</p>
            <p className={cn("font-medium", textPrimary)}>{programName}</p>
            <p className={cn("pt-1 text-sm", textSecondary)}>결제 금액</p>
            <p className={cn("font-medium", textPrimary)}>
              {amount.toLocaleString()}원
            </p>
          </div>

          {/* 발급 유형 */}
          <div>
            <label
              className={cn("block pb-1 text-sm font-medium", textPrimary)}
            >
              발급 유형
            </label>
            <div className="flex gap-3">
              {(["소득공제", "지출증빙"] as const).map((type) => (
                <label key={type} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="receiptType"
                    value={type}
                    checked={receiptType === type}
                    onChange={() => setReceiptType(type)}
                    className="accent-indigo-600"
                  />
                  <span className={cn("text-sm", textPrimary)}>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 식별번호 입력 */}
          <div>
            <label
              htmlFor="identity-number"
              className={cn("block pb-1 text-sm font-medium", textPrimary)}
            >
              {receiptType === "소득공제"
                ? "주민등록번호 또는 휴대폰번호"
                : "사업자등록번호"}{" "}
              <span className="text-error-500">*</span>
            </label>
            <input
              id="identity-number"
              type="text"
              value={identityNumber}
              onChange={(e) => setIdentityNumber(e.target.value)}
              placeholder={
                receiptType === "소득공제"
                  ? "주민등록번호 13자리 (- 없이)"
                  : "사업자등록번호 10자리 (- 없이)"
              }
              maxLength={14}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm",
                borderInput,
                textPrimary,
                bgSurface
              )}
            />
            <p className={cn("mt-1 text-xs", textSecondary)}>
              {receiptType === "소득공제"
                ? "하이픈(-) 없이 숫자만 입력하세요."
                : "하이픈(-) 없이 사업자등록번호 10자리를 입력하세요."}
            </p>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button size="sm" onClick={handleIssue} disabled={isPending}>
          {isPending ? "발급 중..." : "현금영수증 발급"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
