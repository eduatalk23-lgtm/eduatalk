"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { signIn } from "@/lib/domains/auth/actions";
import { GoogleLoginButton } from "@/app/login/_components/GoogleLoginButton";
import { KakaoLoginButton } from "@/app/login/_components/KakaoLoginButton";

interface MobileLoginSheetProps {
  open: boolean;
  onClose: () => void;
}

const ROLES = [
  { key: "student", label: "학생" },
  { key: "parent", label: "학부모" },
  { key: "admin", label: "관리자" },
] as const;

function SheetContent({ onClose, closing }: { onClose: () => void; closing?: boolean }) {
  const searchParams = useSearchParams();
  const rawError = searchParams.get("error");

  const [activeRole, setActiveRole] = useState<string>("student");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    rawError === "account_deactivated"
      ? "비활성화된 계정입니다. 관리자에게 문의해주세요."
      : rawError
  );
  const [isPending, startTransition] = useTransition();

  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > 100) onClose();
    },
    [onClose]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await signIn(formData);
        if (result?.needsEmailVerification) {
          setError(result.error || "이메일 인증이 필요합니다.");
          return;
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다."
        );
      }
    });
  };

  return (
    <div
      ref={sheetRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 ${
        closing ? "animate-slide-down-sheet" : "animate-slide-up-sheet"
      }`}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-slate-600" />
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-800"
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <h2 className="text-xl font-bold text-center mt-2 mb-1 text-gray-900 dark:text-white">
          로그인
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-5">
          계정이 없다면{" "}
          <Link
            href="/signup"
            className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            회원가입
          </Link>
        </p>

        {/* Role tabs */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-1 mb-5">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveRole(r.key)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                activeRole === r.key
                  ? "bg-white shadow text-gray-900 dark:bg-slate-700 dark:text-white"
                  : "text-gray-500 dark:text-slate-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              이메일
            </label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-sm outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-primary-500"
            />
          </div>

          <div className="flex items-center justify-between text-sm mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="rememberMe"
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-gray-600 dark:text-slate-400">자동로그인</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-gray-500 dark:text-slate-400 hover:underline"
            >
              비밀번호 찾기
            </Link>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 w-full rounded-full bg-primary-600 px-4 py-3.5 text-white font-semibold shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                로그인 중...
              </span>
            ) : (
              "로그인"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-slate-900 px-3 text-gray-400 dark:text-slate-500">
              또는
            </span>
          </div>
        </div>

        {/* Social login */}
        <div className="flex flex-col gap-2.5">
          <GoogleLoginButton />
          <KakaoLoginButton />
        </div>
      </div>

      {/* Safe area bottom padding */}
      <div className="h-8 flex-shrink-0" />
    </div>
  );
}

export function MobileLoginSheet({ open, onClose }: MobileLoginSheetProps) {
  const [phase, setPhase] = useState<"idle" | "open" | "closing">("idle");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      // Cancel any pending close timer
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setPhase("open");
    } else if (phase === "open") {
      // Start close animation
      setPhase("closing");
      closeTimerRef.current = setTimeout(() => {
        setPhase("idle");
        closeTimerRef.current = null;
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll while sheet is visible
  useEffect(() => {
    if (phase !== "idle") {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [phase]);

  if (phase === "idle") return null;

  const isClosing = phase === "closing";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <Suspense>
        <SheetContent onClose={onClose} closing={isClosing} />
      </Suspense>
    </>
  );
}
