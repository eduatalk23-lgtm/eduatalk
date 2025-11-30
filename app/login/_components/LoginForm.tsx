"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { ResendEmailButton } from "./ResendEmailButton";

export function LoginForm() {
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
      <div>
        <h1 className="text-h1">로그인</h1>
        <p className="text-sm text-neutral-500">
          계정이 없다면{" "}
          <Link href="/signup" className="text-black underline">
            회원가입
          </Link>
          을 진행해주세요.
        </p>
      </div>

      {/* ⛔ 여기‼ 절대로 action= 넣으면 안 됨 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          비밀번호
          <input
            type="password"
            name="password"
            required
            className="rounded border px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
            placeholder="••••••••"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="rememberMe"
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-neutral-600">자동로그인</span>
        </label>

        {message && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        )}

        {error && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{error}</p>
            {needsEmailVerification && verificationEmail && (
              <div className="mt-2">
                <ResendEmailButton email={verificationEmail} />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </>
  );
}

