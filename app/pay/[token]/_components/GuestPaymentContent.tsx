"use client";

import { useState, useCallback, useEffect } from "react";
import { TossPaymentWidget } from "@/components/payment/TossPaymentWidget";
import { GuestPaymentSuccess } from "./GuestPaymentSuccess";
import type { GuestPaymentData } from "@/lib/domains/payment/paymentLink/types";

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, remaining]);

  if (remaining <= 0) return { text: "만료됨", urgent: true, expired: true };

  const totalMinutes = Math.floor(remaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { text: `${days}일 ${hours % 24}시간 남음`, urgent: false, expired: false };
  }
  if (hours > 0) {
    return {
      text: `${hours}시간 ${minutes}분 남음`,
      urgent: hours < 1,
      expired: false,
    };
  }
  const secs = Math.floor((remaining % 60000) / 1000);
  return {
    text: `${minutes}분 ${secs}초 남음`,
    urgent: true,
    expired: false,
  };
}

type GuestPaymentContentProps = {
  data: GuestPaymentData;
};

export function GuestPaymentContent({ data }: GuestPaymentContentProps) {
  const [status, setStatus] = useState<"ready" | "confirming" | "success" | "error">("ready");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  const handleSuccess = useCallback(
    async (result: { paymentKey: string; orderId: string; amount: number }) => {
      setStatus("confirming");
      try {
        const response = await fetch("/api/payments/toss/confirm-guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: data.token,
            paymentKey: result.paymentKey,
            orderId: result.orderId,
            amount: result.amount,
          }),
        });

        const body = await response.json();

        if (body.success) {
          setReceiptUrl(body.data?.receiptUrl ?? null);
          setStatus("success");
        } else {
          setErrorMessage(body.error?.message ?? "결제 승인에 실패했습니다.");
          setStatus("error");
        }
      } catch {
        setErrorMessage("결제 승인 요청 중 오류가 발생했습니다.");
        setStatus("error");
      }
    },
    [data.token]
  );

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setStatus("error");
  }, []);

  const countdown = useCountdown(data.expiresAt);

  if (countdown.expired && status === "ready") {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-5">
        <div className="w-full rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">결제 링크가 만료되었습니다</h1>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              유효기간이 지났습니다. 학원에 문의하여 새 링크를 요청해 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <GuestPaymentSuccess
        academyName={data.academyName}
        programName={data.programName}
        amount={data.amount}
        receiptUrl={receiptUrl}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      {/* 헤더 */}
      <header className="bg-white px-5 py-4 shadow-sm dark:bg-gray-800">
        <h1 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100">
          수강료 결제
        </h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-5">
        {/* 결제 정보 카드 */}
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">{data.academyName}</p>
          <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
            {data.studentName}
          </h2>

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">프로그램</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{data.programName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">결제금액</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {data.amount.toLocaleString()}원
              </span>
            </div>
            {data.dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">납부기한</span>
                <span className="text-gray-900 dark:text-gray-100">{data.dueDate}</span>
              </div>
            )}
            {data.memo && (
              <div className="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{data.memo}</p>
              </div>
            )}
          </div>
        </div>

        {/* 결제 위젯 */}
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800">
          {status === "confirming" ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-sm text-gray-500 dark:text-gray-400">결제를 승인하는 중입니다...</p>
              </div>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <span className="text-xl text-red-600">!</span>
              </div>
              <p className="text-center text-sm font-medium text-red-600">
                {errorMessage}
              </p>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                문제가 계속되면 학원에 문의해 주세요.
              </p>
              <button
                type="button"
                onClick={() => setStatus("ready")}
                className="rounded-lg bg-blue-500 px-6 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                다시 시도
              </button>
            </div>
          ) : clientKey ? (
            <TossPaymentWidget
              clientKey={clientKey}
              orderId={data.orderId}
              orderName={`${data.academyName} - ${data.programName}`}
              amount={data.amount}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          ) : (
            <p className="py-8 text-center text-sm text-red-500">
              결제 설정이 완료되지 않았습니다.
            </p>
          )}
        </div>

        {/* 만료 카운트다운 */}
        <p
          className={`text-center text-xs ${
            countdown.urgent
              ? "font-medium text-red-500"
              : "text-gray-400"
          }`}
        >
          결제 유효기간: {countdown.text}
        </p>
      </main>
    </div>
  );
}
