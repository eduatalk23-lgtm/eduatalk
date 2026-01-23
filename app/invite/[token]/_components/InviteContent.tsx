"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation } from "@/lib/domains/team/actions/invitations";
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

  const roleLabel = invitation.role === "admin" ? "관리자" : "컨설턴트";
  const expiresDate = new Date(invitation.expiresAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
          {invitation.tenantName || "팀"}에 참여하도록 초대받았습니다
        </p>
      </div>

      {/* Invitation Details */}
      <div className="rounded-xl bg-gray-50 p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">초대 이메일</span>
          <span className="text-sm font-medium text-gray-900">{invitation.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">역할</span>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {roleLabel}
          </span>
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
        <div className="space-y-4">
          <p className="text-center text-sm text-gray-600">
            초대를 수락하려면 먼저 로그인하거나 계정을 생성해주세요
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              로그인
            </Link>
            <Link
              href={`/signup?invite=${token}&email=${encodeURIComponent(invitation.email)}`}
              className="flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              회원가입
            </Link>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        이 초대가 본인에게 전달된 것이 아니라면 무시해주세요
      </p>
    </div>
  );
}
