"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvitation, resendInvitation } from "@/lib/domains/team/actions";
import type { TeamInvitation } from "@/lib/domains/team/types";

type PendingInvitationsListProps = {
  invitations: TeamInvitation[];
};

export function PendingInvitationsList({
  invitations,
}: PendingInvitationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCancel = (invitationId: string) => {
    if (!confirm("이 초대를 취소하시겠습니까?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActioningId(invitationId);

    startTransition(async () => {
      const result = await cancelInvitation(invitationId);
      setActioningId(null);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "초대 취소에 실패했습니다.");
      }
    });
  };

  const handleResend = (invitationId: string) => {
    setError(null);
    setSuccessMessage(null);
    setActioningId(invitationId);

    startTransition(async () => {
      const result = await resendInvitation(invitationId);
      setActioningId(null);

      if (result.success) {
        setSuccessMessage("초대 이메일을 다시 발송했습니다.");
        router.refresh();
      } else {
        setError(result.error || "이메일 재발송에 실패했습니다.");
      }
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
        <div className="divide-y divide-amber-200 dark:divide-amber-800">
          {invitations.map((invitation) => {
            const isActioning = actioningId === invitation.id;
            const roleLabel = invitation.role === "admin" ? "관리자" : "컨설턴트";
            const daysLeft = getDaysUntilExpiry(invitation.expiresAt);

            return (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Pending Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <svg
                      className="h-5 w-5 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>

                  {/* Info */}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {invitation.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          invitation.role === "admin"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {roleLabel}
                      </span>
                      <span>•</span>
                      <span
                        className={
                          daysLeft <= 1
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }
                      >
                        {daysLeft > 0
                          ? `${daysLeft}일 후 만료`
                          : "오늘 만료"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Resend Button */}
                  <button
                    onClick={() => handleResend(invitation.id)}
                    disabled={isActioning || isPending}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {isActioning ? "처리 중..." : "재발송"}
                  </button>

                  {/* Cancel Button */}
                  <button
                    onClick={() => handleCancel(invitation.id)}
                    disabled={isActioning || isPending}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    취소
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
