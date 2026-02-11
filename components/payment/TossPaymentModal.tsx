"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { TossPaymentWidget } from "./TossPaymentWidget";
import { prepareTossPaymentAction } from "@/lib/domains/payment/actions/tossPayment";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";

type TossPaymentModalBaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programName: string;
  amount: number;
  onSuccess: () => void;
};

type SinglePaymentProps = TossPaymentModalBaseProps & {
  paymentId: string;
  isBatch?: false;
  batchOrderId?: undefined;
};

type BatchPaymentProps = TossPaymentModalBaseProps & {
  paymentId?: undefined;
  isBatch: true;
  batchOrderId: string;
};

type TossPaymentModalProps = SinglePaymentProps | BatchPaymentProps;

type PreparedData = {
  orderId: string;
  amount: number;
  orderName: string;
};

export function TossPaymentModal(props: TossPaymentModalProps) {
  const { open, onOpenChange, programName, amount, onSuccess } = props;

  const toast = useToast();
  const [preparedData, setPreparedData] = useState<PreparedData | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  // 안정적인 ref (effect 의존성에서 제외)
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const isBatch = props.isBatch === true;
  const batchOrderId = isBatch ? props.batchOrderId : undefined;
  const paymentId = !isBatch ? props.paymentId : undefined;

  // 모달이 열릴 때 결제 준비 (useEffect로 open 상태 변화 감지)
  useEffect(() => {
    if (!open) {
      setPreparedData(null);
      return;
    }

    // 배치 모드: 이미 준비된 orderId를 바로 사용
    if (isBatch && batchOrderId) {
      setPreparedData({
        orderId: batchOrderId,
        amount,
        orderName: programName,
      });
      return;
    }

    // 단일 결제 모드: prepareTossPaymentAction 호출
    if (!paymentId) return;

    let cancelled = false;

    async function prepare() {
      setIsPreparing(true);
      try {
        const result = await prepareTossPaymentAction(paymentId!);
        if (cancelled) return;
        if (result.success && result.data) {
          setPreparedData(result.data);
        } else {
          toastRef.current.showError(result.error ?? "결제 준비에 실패했습니다.");
          onOpenChangeRef.current(false);
        }
      } catch {
        if (cancelled) return;
        toastRef.current.showError("결제 준비 중 오류가 발생했습니다.");
        onOpenChangeRef.current(false);
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    }

    prepare();

    return () => {
      cancelled = true;
    };
  }, [open, paymentId, isBatch, batchOrderId, amount, programName]);

  // 위젯에서 결제 성공 시 → 서버에 승인 요청
  const handleWidgetSuccess = useCallback(
    async (result: {
      paymentKey: string;
      orderId: string;
      amount: number;
    }) => {
      setIsConfirming(true);
      try {
        const response = await fetch("/api/payments/toss/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey: result.paymentKey,
            orderId: result.orderId,
            amount: result.amount,
          }),
        });

        const data = await response.json();

        if (data.success) {
          toast.showSuccess("결제가 완료되었습니다.");
          onOpenChange(false);
          onSuccess();
        } else {
          toast.showError(
            data.error?.message ?? "결제 승인에 실패했습니다."
          );
        }
      } catch {
        toast.showError("결제 승인 요청 중 오류가 발생했습니다.");
      } finally {
        setIsConfirming(false);
      }
    },
    [toast, onOpenChange, onSuccess]
  );

  const handleWidgetError = useCallback(
    (errorMessage: string) => {
      toast.showError(errorMessage);
    },
    [toast]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isBatch ? "일괄 결제" : "온라인 결제"}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* 결제 정보 요약 */}
        <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
          <p className={cn("text-sm font-medium", textPrimary)}>
            {programName}
          </p>
          <p className={cn("mt-1 text-lg font-bold", textPrimary)}>
            {amount.toLocaleString()}원
          </p>
        </div>

        {/* 결제 위젯 */}
        {isPreparing ? (
          <div className="flex items-center justify-center py-12">
            <p className={cn("text-sm", textSecondary)}>
              결제를 준비하는 중입니다...
            </p>
          </div>
        ) : isConfirming ? (
          <div className="flex items-center justify-center py-12">
            <p className={cn("text-sm", textSecondary)}>
              결제를 승인하는 중입니다...
            </p>
          </div>
        ) : preparedData && clientKey ? (
          <TossPaymentWidget
            clientKey={clientKey}
            orderId={preparedData.orderId}
            orderName={preparedData.orderName}
            amount={preparedData.amount}
            onSuccess={handleWidgetSuccess}
            onError={handleWidgetError}
          />
        ) : !clientKey ? (
          <div className="flex items-center justify-center py-12">
            <p className={cn("text-sm text-red-500")}>
              결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
