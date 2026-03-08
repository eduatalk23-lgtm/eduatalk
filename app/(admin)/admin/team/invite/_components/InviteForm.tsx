"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvitation } from "@/lib/domains/invitation/actions";
import { Mail, MessageSquare, Link2, Copy } from "lucide-react";
import type { InvitationRole, DeliveryMethod } from "@/lib/domains/invitation/types";

type InviteFormProps = {
  canInviteAdmin: boolean;
};

const DELIVERY_OPTIONS: { label: string; method: DeliveryMethod; icon: typeof Mail; description: string }[] = [
  { label: "이메일", method: "email", icon: Mail, description: "이메일로 초대 링크 발송" },
  { label: "SMS", method: "sms", icon: MessageSquare, description: "문자로 초대 링크 발송" },
  { label: "링크만", method: "manual", icon: Link2, description: "링크를 직접 공유" },
];

export function InviteForm({ canInviteAdmin }: InviteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<InvitationRole>("consultant");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    deliverySent: boolean;
    deliveryError?: string;
    joinUrl?: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);

    if (deliveryMethod === "email" && !email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (deliveryMethod === "sms" && !phone.trim()) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createInvitation({
        targetRole: role,
        deliveryMethod,
        email: deliveryMethod === "email" ? email.trim() : (email.trim() || undefined),
        phone: deliveryMethod === "sms" ? phone.trim() : undefined,
      });

      if (result.success) {
        setSuccessData({
          deliverySent: result.deliverySent ?? false,
          deliveryError: result.deliveryError,
          joinUrl: result.joinUrl,
        });
        setEmail("");
        setPhone("");
        if (result.deliverySent) {
          setTimeout(() => router.push("/admin/team"), 2000);
        }
      } else {
        setError(result.error || "초대 생성에 실패했습니다.");
      }
    });
  };

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    alert("초대 링크가 복사되었습니다!");
  };

  // Success state
  if (successData) {
    const { deliverySent, deliveryError, joinUrl } = successData;

    if (!deliverySent) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-center text-lg font-semibold text-amber-800 dark:text-amber-300">
            초대가 생성되었습니다
          </h3>
          <p className="mt-2 text-center text-sm text-amber-700 dark:text-amber-400">
            {deliveryError
              ? `발송에 실패했습니다. 아래 링크를 직접 공유해주세요.`
              : "아래 링크를 공유해주세요."}
          </p>
          {deliveryError && (
            <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-500">
              사유: {deliveryError}
            </p>
          )}
          {joinUrl && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="rounded-lg bg-white p-3 dark:bg-gray-800">
                <p className="break-all text-xs text-gray-600 dark:text-gray-400">{joinUrl}</p>
              </div>
              <button
                onClick={() => handleCopyLink(joinUrl)}
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                <Copy size={14} />
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

    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
          초대가 발송되었습니다!
        </h3>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          {deliveryMethod === "sms" ? "초대 SMS가" : "초대 이메일이"} 전송되었습니다. 팀 페이지로 이동합니다...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-5">
          {/* Role Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">역할 선택</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("consultant")}
                disabled={isPending}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                  role === "consultant"
                    ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  role === "consultant" ? "bg-green-100" : "bg-gray-100"
                }`}>
                  <svg className={`h-5 w-5 ${role === "consultant" ? "text-green-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className={`text-sm font-medium ${role === "consultant" ? "text-green-800" : "text-gray-700"}`}>
                  컨설턴트
                </span>
                <span className="text-xs text-gray-500">학생 상담 및 관리</span>
              </button>

              <button
                type="button"
                onClick={() => canInviteAdmin && setRole("admin")}
                disabled={isPending || !canInviteAdmin}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                  !canInviteAdmin
                    ? "cursor-not-allowed border-gray-200 opacity-50"
                    : role === "admin"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  role === "admin" && canInviteAdmin ? "bg-blue-100" : "bg-gray-100"
                }`}>
                  <svg className={`h-5 w-5 ${role === "admin" && canInviteAdmin ? "text-blue-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className={`text-sm font-medium ${role === "admin" && canInviteAdmin ? "text-blue-800" : "text-gray-700"}`}>
                  관리자
                </span>
                <span className="text-xs text-gray-500">{canInviteAdmin ? "전체 관리 권한" : "대표 관리자만 초대 가능"}</span>
              </button>
            </div>
          </div>

          {/* Delivery Method Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">발송 방식</label>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = deliveryMethod === opt.method;
                return (
                  <button
                    key={opt.method}
                    type="button"
                    onClick={() => setDeliveryMethod(opt.method)}
                    disabled={isPending}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition text-center ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon size={18} className={isSelected ? "text-indigo-600" : "text-gray-400"} />
                    <span className={`text-xs font-medium ${isSelected ? "text-indigo-700" : "text-gray-600"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Input */}
          {deliveryMethod === "email" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일 주소
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team@example.com"
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}
          {deliveryMethod === "sms" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                전화번호
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}
          {deliveryMethod === "manual" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="email-optional" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일 주소 <span className="text-gray-400">(선택)</span>
              </label>
              <input
                type="email"
                id="email-optional"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team@example.com (기록용)"
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500">초대 링크가 생성되며, 직접 공유해야 합니다.</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">초대 안내</h4>
        <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <li>• 초대 링크는 7일간 유효합니다</li>
          <li>• 카카오/Google 계정으로 간편 가입할 수 있습니다</li>
          <li>• 기존 계정이 있으면 로그인 후 수락 가능합니다</li>
        </ul>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || (deliveryMethod === "email" && !email.trim()) || (deliveryMethod === "sms" && !phone.trim())}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {deliveryMethod === "manual" ? "생성 중..." : "발송 중..."}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {deliveryMethod === "manual" ? "초대 링크 생성" : "초대 발송"}
          </>
        )}
      </button>
    </form>
  );
}
