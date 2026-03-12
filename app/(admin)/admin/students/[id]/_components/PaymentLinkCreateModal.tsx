"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import { createPaymentLinkAction } from "@/lib/domains/payment/paymentLink/actions";
import { SITE_URL } from "@/lib/constants/routes";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { DeliveryMethod } from "@/lib/domains/payment/paymentLink/types";

/** 전화번호 포맷팅: 숫자만 추출 후 하이픈 삽입 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 유효한 휴대폰 번호인지 검증 */
function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

type PaymentLinkCreateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecordWithEnrollment;
  defaultPhone?: string;
  onSuccess?: () => void;
};

export function PaymentLinkCreateModal({
  open,
  onOpenChange,
  payment,
  defaultPhone,
  onSuccess,
}: PaymentLinkCreateModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [phone, setPhone] = useState(() =>
    defaultPhone ? formatPhone(defaultPhone) : ""
  );
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("sms");
  const [expiresInHours, setExpiresInHours] = useState(72);

  // 결과 상태
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const remainingAmount = payment.amount - (payment.paid_amount ?? 0);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createPaymentLinkAction({
        paymentRecordId: payment.id,
        recipientPhone: deliveryMethod !== "manual" ? phone : undefined,
        deliveryMethod,
        expiresInHours,
      });

      if (result.success && result.data) {
        setCreatedToken(result.data.token);
        if (deliveryMethod === "manual") {
          toast.showSuccess("결제 링크가 생성되었습니다.");
        } else {
          toast.showSuccess("결제 링크가 발송되었습니다.");
        }
        onSuccess?.();
      } else {
        toast.showError(result.error ?? "링크 생성에 실패했습니다.");
      }
    });
  };

  const paymentUrl = createdToken ? `${SITE_URL}/pay/${createdToken}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      toast.showSuccess("링크가 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.showError("복사에 실패했습니다.");
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setCreatedToken(null);
      setCopied(false);
      setPhone("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="결제 링크 보내기"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* 결제 정보 요약 */}
        <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
          <p className={cn("text-sm", textSecondary)}>
            {payment.program_name}
          </p>
          <p className={cn("mt-1 text-lg font-bold", textPrimary)}>
            {remainingAmount.toLocaleString()}원
          </p>
        </div>

        {createdToken ? (
          // 링크 생성 완료
          <div className="flex flex-col gap-3">
            <label className={cn("text-sm font-medium", textPrimary)}>
              결제 링크
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={paymentUrl}
                readOnly
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs",
                  "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700",
                  textPrimary
                )}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              닫기
            </button>
          </div>
        ) : (
          // 입력 폼
          <>
            {/* 발송 방법 */}
            <div className="flex flex-col gap-2">
              <label className={cn("text-sm font-medium", textPrimary)}>
                발송 방법
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "sms" as const, label: "SMS" },
                    { value: "alimtalk" as const, label: "알림톡" },
                    { value: "manual" as const, label: "링크만 생성" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeliveryMethod(opt.value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      deliveryMethod === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 전화번호 (manual 아닐 때만) */}
            {deliveryMethod !== "manual" && (
              <div className="flex flex-col gap-2">
                <label className={cn("text-sm font-medium", textPrimary)}>
                  수신자 전화번호
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="010-0000-0000"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    "border-gray-200 dark:border-gray-600",
                    "bg-white dark:bg-gray-700",
                    textPrimary,
                    phone && !isValidPhone(phone) && "border-red-400 dark:border-red-500"
                  )}
                />
                {phone && !isValidPhone(phone) && (
                  <p className="text-xs text-red-500">
                    올바른 휴대폰 번호를 입력해 주세요
                  </p>
                )}
              </div>
            )}

            {/* 유효기간 */}
            <div className="flex flex-col gap-2">
              <label className={cn("text-sm font-medium", textPrimary)}>
                유효기간
              </label>
              <select
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  "border-gray-200 dark:border-gray-600",
                  "bg-white dark:bg-gray-700",
                  textPrimary
                )}
              >
                <option value={24}>24시간</option>
                <option value={48}>48시간</option>
                <option value={72}>72시간 (기본)</option>
                <option value={168}>7일</option>
                <option value={720}>30일</option>
              </select>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || (deliveryMethod !== "manual" && !isValidPhone(phone))}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors",
                  isPending || (deliveryMethod !== "manual" && !isValidPhone(phone))
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-blue-500 hover:bg-blue-600"
                )}
              >
                {isPending
                  ? "처리 중..."
                  : deliveryMethod === "manual"
                    ? "링크 생성"
                    : "발송하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
