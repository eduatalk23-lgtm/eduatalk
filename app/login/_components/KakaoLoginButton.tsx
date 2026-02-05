"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function KakaoLoginButton() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      // 연결 코드가 있으면 localStorage에 저장 (OAuth 플로우 후 사용)
      const connectionCode = searchParams.get("code");
      if (connectionCode) {
        localStorage.setItem("signup_connection_code", connectionCode);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "카카오 로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleKakaoLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 font-medium text-[#191919] shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: "#FEE500" }}
      >
        {isLoading ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 4C7.58172 4 4 6.90985 4 10.4934C4 12.7284 5.38659 14.6999 7.47329 15.8615L6.55635 19.1753C6.48426 19.4297 6.76616 19.6362 6.98729 19.4888L10.8392 16.8526C11.2167 16.9143 11.604 16.9467 12 16.9467C16.4183 16.9467 20 14.0369 20 10.4534C20 6.90985 16.4183 4 12 4Z"
              fill="#191919"
            />
          </svg>
        )}
        <span>{isLoading ? "로그인 중..." : "카카오로 계속하기"}</span>
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
