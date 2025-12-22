"use client";

import { useState } from "react";
import { resendConfirmationEmail } from "@/lib/domains/auth/actions";
import { useServerAction } from "@/lib/hooks/useServerAction";

type ResendEmailButtonProps = {
  email: string;
};

export function ResendEmailButton({ email }: ResendEmailButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const { execute, isPending, error, isSuccess, reset } = useServerAction(
    resendConfirmationEmail,
    {
      onSuccess: (_, successMessage) => {
        setMessage(successMessage || "인증 메일을 재발송했습니다.");
      },
      onError: () => {
        setMessage(null);
      },
    }
  );

  const handleResend = () => {
    setMessage(null);
    reset();
    execute(email);
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
      {message && isSuccess && (
        <p className="mt-1 text-xs text-green-600">{message}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

