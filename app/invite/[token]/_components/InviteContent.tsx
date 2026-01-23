"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation, signUpAndAcceptInvitation } from "@/lib/domains/team/actions/invitations";
import type { InvitationRole } from "@/lib/domains/team/types";

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
                로그인하러 가기
              </Link>
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
