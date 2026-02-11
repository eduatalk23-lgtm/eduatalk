"use client";

import { useEffect, useRef, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { cn } from "@/lib/cn";
import { textSecondary } from "@/lib/utils/darkMode";

type TossPaymentWidgetProps = {
  clientKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  onSuccess: (result: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }) => void;
  onError: (error: string) => void;
};

type TossWidgets = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadTossPayments>>["widgets"]>
>;

export function TossPaymentWidget({
  clientKey,
  orderId,
  orderName,
  amount,
  onSuccess,
  onError,
}: TossPaymentWidgetProps) {
  const [widgets, setWidgets] = useState<TossWidgets | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const paymentMethodRef = useRef<HTMLDivElement>(null);
  const agreementRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // 위젯 초기화
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const tossPayments = await loadTossPayments(clientKey);

        // 비회원 결제 (ANONYMOUS)
        const { ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
        const w = tossPayments.widgets({ customerKey: ANONYMOUS });

        await w.setAmount({ currency: "KRW", value: amount });

        setWidgets(w);
      } catch (err) {
        console.error("[TossPaymentWidget] 초기화 실패:", err);
        onError("결제 위젯 초기화에 실패했습니다.");
      }
    }

    init();
  }, [clientKey, amount, onError]);

  // 위젯 렌더링
  useEffect(() => {
    if (!widgets) return;

    async function render() {
      try {
        if (paymentMethodRef.current) {
          await widgets!.renderPaymentMethods({
            selector: "#toss-payment-method",
          });
        }

        if (agreementRef.current) {
          await widgets!.renderAgreement({
            selector: "#toss-agreement",
          });
        }

        setIsReady(true);
      } catch (err) {
        console.error("[TossPaymentWidget] 렌더링 실패:", err);
        onError("결제 UI 렌더링에 실패했습니다.");
      }
    }

    render();
  }, [widgets, onError]);

  const handlePayment = async () => {
    if (!widgets || isProcessing) return;

    setIsProcessing(true);
    try {
      // Promise 방식 사용 (모달 내에서 사용하므로 redirect 불필요)
      const result = await widgets.requestPayment({
        orderId,
        orderName,
      });

      if (result) {
        onSuccess({
          paymentKey: result.paymentKey,
          orderId: result.orderId,
          amount: result.amount.value,
        });
      }
    } catch (err) {
      const error = err as Error & { code?: string };
      // 사용자가 취소한 경우
      if (error.code === "USER_CANCEL" || error.code === "PAY_PROCESS_CANCELED") {
        setIsProcessing(false);
        return;
      }
      onError(error.message || "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 결제 수단 선택 UI */}
      <div id="toss-payment-method" ref={paymentMethodRef} />

      {/* 약관 동의 UI */}
      <div id="toss-agreement" ref={agreementRef} />

      {/* 결제 버튼 */}
      <button
        type="button"
        onClick={handlePayment}
        disabled={!isReady || isProcessing}
        className={cn(
          "w-full rounded-lg py-3 text-base font-semibold text-white transition-colors",
          isReady && !isProcessing
            ? "bg-blue-500 hover:bg-blue-600"
            : "cursor-not-allowed bg-gray-300"
        )}
      >
        {isProcessing
          ? "결제 처리 중..."
          : !isReady
            ? "결제 수단 로딩 중..."
            : `${amount.toLocaleString()}원 결제하기`}
      </button>

      {!isReady && (
        <p className={cn("text-center text-xs", textSecondary)}>
          결제 위젯을 불러오는 중입니다...
        </p>
      )}
    </div>
  );
}
