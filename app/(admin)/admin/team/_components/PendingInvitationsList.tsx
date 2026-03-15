"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, MessageSquare, Mail, Send } from "lucide-react";
import { cancelInvitationAction, resendInvitationAction, sendInvitationAction } from "@/lib/domains/invitation/actions";
import type { Invitation } from "@/lib/domains/invitation/types";

type PendingInvitationsListProps = {
  invitations: Invitation[];
};

export function PendingInvitationsList({
  invitations,
}: PendingInvitationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Send modal state
  const [sendModal, setSendModal] = useState<{ invitationId: string } | null>(null);
  const [sendMethod, setSendMethod] = useState<"sms" | "email">("sms");
  const [sendContact, setSendContact] = useState("");

  const handleCancel = (invitationId: string) => {
    if (!confirm("이 초대를 취소하시겠습니까?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActioningId(invitationId);

    startTransition(async () => {
      const result = await cancelInvitationAction(invitationId);
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
      const result = await resendInvitationAction(invitationId);
      setActioningId(null);

      if (result.success) {
        setSuccessMessage("초대를 다시 발송했습니다.");
        router.refresh();
      } else {
        setError(result.error || "재발송에 실패했습니다.");
      }
    });
  };

  const handleOpenSendModal = (invitationId: string) => {
    setSendModal({ invitationId });
    setSendMethod("sms");
    setSendContact("");
  };

  const handleSendSubmit = () => {
    if (!sendModal || !sendContact.trim()) return;
    setError(null);
    setSuccessMessage(null);
    setActioningId(sendModal.invitationId);

    const modalId = sendModal.invitationId;
    const method = sendMethod;
    const contact = sendContact.trim();

    startTransition(async () => {
      const result = await sendInvitationAction(modalId, method, contact);
      setActioningId(null);

      if (result.success) {
        setSuccessMessage(method === "sms" ? "초대 SMS를 발송했습니다." : "초대 이메일을 발송했습니다.");
        setSendModal(null);
        router.refresh();
      } else {
        setError(result.error || "발송에 실패했습니다.");
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
            const roleLabel = invitation.targetRole === "admin" ? "관리자" : "컨설턴트";
            const daysLeft = getDaysUntilExpiry(invitation.expiresAt);
            const isManualDelivery = invitation.deliveryMethod === "manual" || invitation.deliveryMethod === "qr";

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
                      {invitation.email || invitation.phone || "링크 초대"}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          invitation.targetRole === "admin"
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
                  {/* Send/Resend Button */}
                  {isManualDelivery ? (
                    <button
                      onClick={() => handleOpenSendModal(invitation.id)}
                      disabled={isActioning || isPending}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      {isActioning ? "처리 중..." : "발송"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResend(invitation.id)}
                      disabled={isActioning || isPending}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      {isActioning ? "처리 중..." : "재발송"}
                    </button>
                  )}

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

      {/* Send invitation modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">초대 발송</h3>
              <button
                onClick={() => setSendModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">발송 방식</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSendMethod("sms")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition ${
                    sendMethod === "sms"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <MessageSquare size={16} />
                  SMS
                </button>
                <button
                  onClick={() => setSendMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition ${
                    sendMethod === "email"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Mail size={16} />
                  이메일
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {sendMethod === "sms" ? "전화번호" : "이메일"}
              </label>
              <input
                type={sendMethod === "sms" ? "tel" : "email"}
                value={sendContact}
                onChange={(e) => setSendContact(e.target.value)}
                placeholder={sendMethod === "sms" ? "010-1234-5678" : "user@email.com"}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSendModal(null)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleSendSubmit}
                disabled={isPending || !sendContact.trim()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending && actioningId === sendModal.invitationId ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    발송 중...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    발송
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
