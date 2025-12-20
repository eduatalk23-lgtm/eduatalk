"use client";

import { useState, useTransition } from "react";
import { resendConfirmationEmail } from "@/app/actions/auth";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type ResendEmailButtonProps = {
  email: string;
};

export function ResendEmailButton({ email }: ResendEmailButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await resendConfirmationEmail(email);
      if (isSuccessResponse(result)) {
        setMessage(result.message || "인증 메일을 재발송했습니다.");
      } else if (isErrorResponse(result)) {
        setError(result.error || "이메일 재발송에 실패했습니다.");
      }
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending || !email}
        className="text-sm text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
      >
        {isPending ? "발송 중..." : "인증 메일 재발송"}
      </button>
      {message && (
        <p className="mt-1 text-xs text-green-600">{message}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

