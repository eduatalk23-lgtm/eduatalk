"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/domains/auth/actions";
import { Lock, Check, ArrowLeft } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  // 미들웨어에서 접근 제어를 처리하므로 hasAccess 체크 불필요

  const validatePassword = () => {
    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    if (!validatePassword()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updatePassword(password);
      if (result.success) {
        setIsSuccess(true);
        // 3초 후 로그인 페이지로 리다이렉트
        setTimeout(() => {
          router.push("/login?message=" + encodeURIComponent("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."));
        }, 3000);
      } else {
        setError(result.error || "비밀번호 변경에 실패했습니다.");
      }
    } catch {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 성공 화면
  if (isSuccess) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-semibold">비밀번호 변경 완료</h1>

          <p className="text-sm text-neutral-500">
            비밀번호가 성공적으로 변경되었습니다.
            <br />
            잠시 후 로그인 페이지로 이동합니다...
          </p>
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          바로 로그인하기
        </Link>
      </section>
    );
  }

  // 비밀번호 입력 화면 (미들웨어에서 접근 제어 처리)
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
          <Lock className="h-8 w-8 text-indigo-600" />
        </div>

        <h1 className="text-2xl font-semibold">새 비밀번호 설정</h1>

        <p className="text-sm text-neutral-500">
          새로운 비밀번호를 입력해주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          새 비밀번호
          <input
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400"
            placeholder="최소 8자 이상"
            minLength={8}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          비밀번호 확인
          <input
            type="password"
            name="confirmPassword"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400"
            placeholder="비밀번호 다시 입력"
          />
        </label>

        {password && confirmPassword && password !== confirmPassword && (
          <p className="text-sm text-red-600">비밀번호가 일치하지 않습니다.</p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !password || !confirmPassword}
          className="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      </section>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
