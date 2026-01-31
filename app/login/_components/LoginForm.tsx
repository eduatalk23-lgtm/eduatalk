"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/domains/auth/actions";
import { ResendEmailButton } from "./ResendEmailButton";
import { StyledInput } from "./StyledInput";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { KakaoLoginButton } from "./KakaoLoginButton";
import { motion } from "framer-motion";

type LoginFormProps = {
  returnUrl?: string;
};

export function LoginForm({ returnUrl }: LoginFormProps) {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState<string>("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get("email")?.toString() || "";
    setEmail(emailValue);
    setNeedsEmailVerification(false);
    setVerificationEmail("");

    // returnUrl이 있으면 FormData에 추가
    if (returnUrl) {
      formData.append("returnUrl", returnUrl);
    }

    startTransition(async () => {
      try {
        const result = await signIn(formData); // 서버 액션 호출

        // 이메일 인증이 필요한 경우
        if (result?.needsEmailVerification) {
          setError(result.error || "이메일 인증이 필요합니다.");
          setNeedsEmailVerification(true);
          setVerificationEmail(result.email || emailValue);
          return;
        }

        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "로그인 중 오류가 발생했습니다.";
        setError(errorMessage);
        setNeedsEmailVerification(false);
      }
    });
  };

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
        <p className="mt-2 text-neutral-500">
          계정이 없다면{" "}
          <Link href="/signup" className="font-medium text-black underline-offset-4 hover:underline">
            회원가입
          </Link>
          을 진행해주세요.
        </p>
      </div>

      {/* ⛔ 여기‼ 절대로 action= 넣으면 안 됨 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <StyledInput
          label="이메일"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <StyledInput
          label="비밀번호"
          type="password"
          name="password"
          required
          placeholder="••••••••"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                name="rememberMe"
                className="peer h-4 w-4 rounded border-gray-300 text-black focus:ring-black/20"
              />
            </div>
            <span className="text-neutral-600 group-hover:text-black transition-colors">자동로그인</span>
          </label>
          <Link href="/forgot-password" className="text-neutral-500 hover:text-black hover:underline transition-colors">
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {message && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 font-medium"
          >
            {message}
          </motion.p>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 font-medium flex flex-col gap-2"
          >
            <p>{error}</p>
            {needsEmailVerification && verificationEmail && (
              <div>
                <ResendEmailButton email={verificationEmail} />
              </div>
            )}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 w-full rounded-xl bg-black px-4 py-3.5 text-white font-medium shadow-lg shadow-black/20 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              로그인 중...
            </span>
          ) : (
            "로그인"
          )}
        </button>
      </form>

      {/* 구분선 */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-gray-500">또는</span>
        </div>
      </div>

      {/* 소셜 로그인 */}
      <div className="flex flex-col gap-3">
        <GoogleLoginButton />
        <KakaoLoginButton />
      </div>
    </>
  );
}

