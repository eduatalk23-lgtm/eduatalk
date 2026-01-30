"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendPasswordResetEmail } from "@/lib/domains/auth/actions";
import { Mail, ArrowLeft, Check } from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL에서 에러 파라미터 읽기
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await sendPasswordResetEmail(email);
      if (result.success) {
        setIsEmailSent(true);
      } else {
        setError(result.error || "비밀번호 재설정 메일 발송에 실패했습니다.");
      }
    } catch {
      setError("비밀번호 재설정 메일 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 메일 발송 완료 화면
  if (isEmailSent) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-semibold">메일을 발송했습니다</h1>

          <div className="text-sm text-neutral-600">
            <span className="font-medium text-black">{email}</span>
            <span>로 비밀번호 재설정 링크를 발송했습니다.</span>
          </div>

          <p className="text-sm text-neutral-500">
            이메일의 링크를 클릭하여 새 비밀번호를 설정해주세요.
            <br />
            메일이 도착하지 않았다면 스팸 메일함을 확인해주세요.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setIsEmailSent(false);
              setEmail("");
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            다른 이메일로 재발송
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            로그인 페이지로 이동
          </Link>
        </div>
      </section>
    );
  }

  // 이메일 입력 화면
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
          <Mail className="h-8 w-8 text-indigo-600" />
        </div>

        <h1 className="text-2xl font-semibold">비밀번호 찾기</h1>

        <p className="text-sm text-neutral-500">
          가입 시 사용한 이메일 주소를 입력하시면
          <br />
          비밀번호 재설정 링크를 보내드립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400"
            placeholder="you@example.com"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isSubmitting ? "발송 중..." : "비밀번호 재설정 메일 발송"}
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          로그인으로 돌아가기
        </Link>
      </div>
    </section>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      </section>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
