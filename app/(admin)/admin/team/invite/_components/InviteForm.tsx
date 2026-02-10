"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeamInvitation } from "@/lib/domains/team/actions";
import type { InvitationRole } from "@/lib/domains/team/types";

type InviteFormProps = {
  /** 관리자 역할로 초대할 수 있는지 (owner 또는 superadmin만 가능) */
  canInviteAdmin: boolean;
};

export function InviteForm({ canInviteAdmin }: InviteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("consultant");
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    emailSent: boolean;
    emailError?: string;
    inviteToken?: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);

    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createTeamInvitation({ email: email.trim(), role });

      if (result.success) {
        setSuccessData({
          emailSent: result.emailSent ?? false,
          emailError: result.emailError,
          inviteToken: result.invitation?.token,
        });
        setEmail("");
        // 이메일이 성공적으로 발송된 경우에만 자동 이동
        if (result.emailSent) {
          setTimeout(() => {
            router.push("/admin/team");
          }, 2000);
        }
      } else {
        setError(result.error || "초대 생성에 실패했습니다.");
      }
    });
  };

  // 초대 링크 복사
  const handleCopyLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/invite/${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    alert("초대 링크가 복사되었습니다!");
  };

  if (successData) {
    const { emailSent, emailError, inviteToken } = successData;

    // 이메일 발송 실패한 경우
    if (!emailSent) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-8 w-8 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-center text-lg font-semibold text-amber-800 dark:text-amber-300">
            초대가 생성되었습니다
          </h3>
          <p className="mt-2 text-center text-sm text-amber-700 dark:text-amber-400">
            이메일 발송에 실패했습니다. 아래 링크를 직접 공유해주세요.
          </p>
          {emailError && (
            <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-500">
              사유: {emailError}
            </p>
          )}
          {inviteToken && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="rounded-lg bg-white p-3 dark:bg-gray-800">
                <p className="break-all text-xs text-gray-600 dark:text-gray-400">
                  {typeof window !== "undefined" && `${window.location.origin}/invite/${inviteToken}`}
                </p>
              </div>
              <button
                onClick={() => handleCopyLink(inviteToken)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                초대 링크 복사
              </button>
            </div>
          )}
          <button
            onClick={() => router.push("/admin/team")}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            팀 페이지로 이동
          </button>
        </div>
      );
    }

    // 이메일 발송 성공
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg
            className="h-8 w-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
          초대가 발송되었습니다!
        </h3>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          초대 이메일이 전송되었습니다. 팀 페이지로 이동합니다...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-5">
          {/* Email Input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              이메일 주소
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@example.com"
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Role Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              역할 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("consultant")}
                disabled={isPending}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                  role === "consultant"
                    ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    role === "consultant"
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <svg
                    className={`h-5 w-5 ${
                      role === "consultant"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <span
                  className={`text-sm font-medium ${
                    role === "consultant"
                      ? "text-green-800 dark:text-green-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  컨설턴트
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  학생 상담 및 관리
                </span>
              </button>

              <button
                type="button"
                onClick={() => canInviteAdmin && setRole("admin")}
                disabled={isPending || !canInviteAdmin}
                className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                  !canInviteAdmin
                    ? "cursor-not-allowed border-gray-200 opacity-50 dark:border-gray-700"
                    : role === "admin"
                      ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    role === "admin" && canInviteAdmin
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <svg
                    className={`h-5 w-5 ${
                      role === "admin" && canInviteAdmin
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <span
                  className={`text-sm font-medium ${
                    role === "admin" && canInviteAdmin
                      ? "text-blue-800 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  관리자
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {canInviteAdmin ? "전체 관리 권한" : "대표 관리자만 초대 가능"}
                </span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          초대 안내
        </h4>
        <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <li>• 초대받은 분에게 이메일이 발송됩니다</li>
          <li>• 초대는 7일간 유효합니다</li>
          <li>• 기존 계정이 있으면 로그인 후 수락 가능합니다</li>
          <li>• 새로운 사용자는 회원가입 후 수락할 수 있습니다</li>
        </ul>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
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
            초대 발송 중...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            초대 이메일 발송
          </>
        )}
      </button>
    </form>
  );
}
