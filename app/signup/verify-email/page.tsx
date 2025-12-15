"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { resendConfirmationEmail } from "@/app/actions/auth";
import { Mail, RefreshCw, ArrowLeft } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleResend = async () => {
    if (!email || isResending) return;

    setIsResending(true);
    setResendMessage(null);

    try {
      const result = await resendConfirmationEmail(email);
      if (result.success) {
        setResendMessage({
          type: "success",
          text: result.message || "인증 메일을 재발송했습니다.",
        });
      } else {
        setResendMessage({
          type: "error",
          text: result.error || "메일 재발송에 실패했습니다.",
        });
      }
    } catch {
      setResendMessage({
        type: "error",
        text: "메일 재발송 중 오류가 발생했습니다.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
          <Mail className="h-8 w-8 text-indigo-600" />
        </div>

        <h1 className="text-2xl font-semibold">이메일을 확인해주세요</h1>

        <div className="text-sm text-neutral-600">
          {email ? (
            <>
              <span className="font-medium text-black">{email}</span>
              <span>로 인증 메일을 발송했습니다.</span>
            </>
          ) : (
            <span>입력하신 이메일로 인증 메일을 발송했습니다.</span>
          )}
        </div>

        <p className="text-sm text-neutral-500">
          이메일의 링크를 클릭하여 회원가입을 완료해주세요.
          <br />
          메일이 도착하지 않았다면 스팸 메일함을 확인해주세요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
            {isResending ? "발송 중..." : "인증 메일 재발송"}
          </button>
        )}

        {resendMessage && (
          <p
            className={`rounded-lg px-4 py-3 text-center text-sm ${
              resendMessage.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {resendMessage.text}
          </p>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          로그인 페이지로 이동
        </Link>
      </div>

      <p className="text-center text-xs text-neutral-400">
        이미 인증을 완료하셨다면 로그인 페이지에서 로그인해주세요.
      </p>
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      </section>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
