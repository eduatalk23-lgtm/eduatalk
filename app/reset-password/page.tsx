"use client";

import Link from "next/link";
import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updatePassword } from "@/lib/domains/auth/actions";
import { Lock, Check, ArrowLeft, AlertTriangle } from "lucide-react";
import PasswordInput from "@/components/atoms/PasswordInput";
import PasswordStrengthIndicator, {
  calculatePasswordStrength,
} from "@/components/atoms/PasswordStrengthIndicator";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PageState = "loading" | "no_session" | "expired" | "ready" | "success";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");

  // 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[reset-password] 세션 확인 에러:", sessionError.message);
          setPageState("no_session");
          return;
        }

        if (!session) {
          // URL에서 에러 파라미터 확인 (이메일 링크 만료 등)
          const errorParam = searchParams.get("error");
          const errorCode = searchParams.get("error_code");

          if (errorCode === "otp_expired" || errorParam?.includes("expired")) {
            setPageState("expired");
          } else {
            setPageState("no_session");
          }
          return;
        }

        // 세션이 있으면 준비 완료
        setPageState("ready");
      } catch (err) {
        console.error("[reset-password] 세션 확인 실패:", err);
        setPageState("no_session");
      }
    };

    checkSession();
  }, [searchParams]);

  const validatePassword = () => {
    const result = calculatePasswordStrength(password);
    if (!result.checks.minLength) {
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
        setPageState("success");
        // 3초 후 로그인 페이지로 리다이렉트
        setTimeout(() => {
          router.push("/login?message=" + encodeURIComponent("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."));
        }, 3000);
      } else {
        // 에러 메시지 개선
        const errorMessage = result.error || "비밀번호 변경에 실패했습니다.";
        if (errorMessage.toLowerCase().includes("session") ||
            errorMessage.toLowerCase().includes("auth") ||
            errorMessage.toLowerCase().includes("not logged in")) {
          setError("세션이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.");
          setPageState("expired");
        } else {
          setError(errorMessage);
        }
      }
    } catch {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 화면
  if (pageState === "loading") {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <p className="text-sm text-neutral-500">세션을 확인하는 중...</p>
        </div>
      </section>
    );
  }

  // 세션 없음 또는 링크 만료 화면
  if (pageState === "no_session" || pageState === "expired") {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>

          <h1 className="text-2xl font-semibold">
            {pageState === "expired" ? "링크가 만료되었습니다" : "접근할 수 없습니다"}
          </h1>

          <p className="text-sm text-neutral-500">
            {pageState === "expired" ? (
              <>
                비밀번호 재설정 링크가 만료되었습니다.
                <br />
                새로운 링크를 요청해주세요.
              </>
            ) : (
              <>
                비밀번호를 재설정하려면 이메일의 링크를 클릭하거나
                <br />
                아래에서 새 링크를 요청해주세요.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            비밀번호 재설정 다시 요청
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            로그인 페이지로 이동
          </Link>
        </div>
      </section>
    );
  }

  // 성공 화면
  if (pageState === "success") {
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

  // 비밀번호 입력 화면 (세션 확인 완료)
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            새 비밀번호
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputSize="lg"
            placeholder="최소 8자 이상"
          />
          <PasswordStrengthIndicator password={password} showChecklist />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            비밀번호 확인
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            inputSize="lg"
            placeholder="비밀번호 다시 입력"
            hasError={!!(password && confirmPassword && password !== confirmPassword)}
          />
        </div>

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
