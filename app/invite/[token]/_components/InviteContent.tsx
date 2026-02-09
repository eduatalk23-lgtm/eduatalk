"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation, signUpAndAcceptInvitation } from "@/lib/domains/team/actions/invitations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InvitationRole } from "@/lib/domains/team/types";
import type { Provider } from "@supabase/supabase-js";

type InviteContentProps = {
  invitation: {
    id: string;
    email: string;
    role: InvitationRole;
    tenantName: string | null;
    expiresAt: string;
  };
  token: string;
  isLoggedIn: boolean;
};

export function InviteContent({
  invitation,
  token,
  isLoggedIn,
}: InviteContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  // 회원가입 폼 상태
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  const roleLabel = invitation.role === "admin" ? "관리자" : "컨설턴트";
  const expiresDate = new Date(invitation.expiresAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 로그인된 상태에서 초대 수락
  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation({ token });

      if (result.success) {
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else {
          router.push("/admin/dashboard");
        }
      } else {
        setError(result.error || "초대 수락에 실패했습니다.");
      }
    });
  };

  // 소셜 로그인으로 초대 수락
  const handleSocialLogin = async (provider: Provider) => {
    setError(null);
    // 안전망: localStorage에 토큰 저장
    localStorage.setItem("invite_token", token);

    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?invite_token=${token}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message || "소셜 로그인에 실패했습니다.");
    }
  };

  // 회원가입과 동시에 초대 수락
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 유효성 검사
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    startTransition(async () => {
      const result = await signUpAndAcceptInvitation({
        token,
        email: invitation.email,
        password,
        name: name.trim(),
      });

      if (result.success) {
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else {
          router.push("/login?message=회원가입이 완료되었습니다. 로그인해주세요.");
        }
      } else {
        setError(result.error || "회원가입에 실패했습니다.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-8 w-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">팀 초대</h1>
        <p className="mt-2 text-gray-600">
          <strong>{invitation.tenantName || "팀"}</strong>에서{" "}
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            {roleLabel}
          </span>
          로 초대했습니다
        </p>
      </div>

      {/* Invitation Details */}
      <div className="rounded-xl bg-gray-50 p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">초대 이메일</span>
          <span className="text-sm font-medium text-gray-900">{invitation.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">유효 기간</span>
          <span className="text-sm text-gray-900">{expiresDate}까지</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      {isLoggedIn ? (
        // 로그인된 상태: 초대 수락 버튼만
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
                처리 중...
              </span>
            ) : (
              "초대 수락하기"
            )}
          </button>
          <p className="text-center text-xs text-gray-500">
            수락하면 {invitation.tenantName || "팀"}의 {roleLabel}로 참여하게 됩니다
          </p>
        </div>
      ) : (
        // 로그인 안 된 상태: 회원가입/로그인 탭
        <div className="space-y-4">
          {/* 탭 버튼 */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              회원가입
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              로그인
            </button>
          </div>

          {mode === "signup" ? (
            // 회원가입 폼
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* 이메일 (읽기 전용) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  초대받은 이메일 주소로 가입됩니다
                </p>
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* 가입 버튼 */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
                    처리 중...
                  </span>
                ) : (
                  "회원가입 및 초대 수락"
                )}
              </button>

              {/* 소셜 로그인 구분선 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>

              {/* 소셜 로그인 버튼 */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google로 가입
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin("kakao")}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-yellow-300 bg-[#FEE500] px-4 py-3 text-sm font-medium text-[#191919] shadow-sm hover:bg-[#FDD800] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
                    <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.724 1.8 5.113 4.508 6.459-.2.742-.723 2.688-.828 3.105-.13.52.19.513.4.374.164-.109 2.612-1.773 3.666-2.494.718.106 1.464.163 2.254.163 5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
                  </svg>
                  카카오로 가입
                </button>
              </div>
            </form>
          ) : (
            // 로그인 안내
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-600">
                이미 계정이 있다면 로그인 후 초대를 수락하세요
              </p>
              <Link
                href={`/login?returnUrl=/invite/${token}`}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                이메일로 로그인
              </Link>

              {/* 소셜 로그인 구분선 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>

              {/* 소셜 로그인 버튼 */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google로 로그인
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin("kakao")}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-yellow-300 bg-[#FEE500] px-4 py-3 text-sm font-medium text-[#191919] shadow-sm hover:bg-[#FDD800] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
                    <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.724 1.8 5.113 4.508 6.459-.2.742-.723 2.688-.828 3.105-.13.52.19.513.4.374.164-.109 2.612-1.773 3.666-2.494.718.106 1.464.163 2.254.163 5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
                  </svg>
                  카카오로 로그인
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        이 초대가 본인에게 전달된 것이 아니라면 무시해주세요
      </p>
    </div>
  );
}
