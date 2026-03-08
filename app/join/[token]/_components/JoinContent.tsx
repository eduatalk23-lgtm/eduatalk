"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation } from "@/lib/domains/invitation/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InvitationRole, InvitationRelation } from "@/lib/domains/invitation/types";
import type { Provider } from "@supabase/supabase-js";
import type { ConsentData } from "@/lib/types/auth";

type JoinContentProps = {
  invitation: {
    id: string;
    token: string;
    tenantName: string | null;
    targetRole: InvitationRole;
    studentName: string | null;
    relation: InvitationRelation | null;
    email: string | null;
    expiresAt: string;
  };
  isLoggedIn: boolean;
  currentUserId: string | null;
  currentUserEmail: string | null;
};

const ROLE_LABELS: Record<InvitationRole, string> = {
  admin: "관리자",
  consultant: "컨설턴트",
  student: "학생",
  parent: "학부모",
};

const ROLE_COLORS: Record<InvitationRole, { bg: string; text: string; icon: string }> = {
  admin: { bg: "bg-purple-100", text: "text-purple-800", icon: "bg-purple-100" },
  consultant: { bg: "bg-green-100", text: "text-green-800", icon: "bg-green-100" },
  student: { bg: "bg-blue-100", text: "text-blue-800", icon: "bg-blue-100" },
  parent: { bg: "bg-amber-100", text: "text-amber-800", icon: "bg-amber-100" },
};

export function JoinContent({
  invitation,
  isLoggedIn,
  currentUserId,
  currentUserEmail,
}: JoinContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);

  // 동의 상태
  const [consents, setConsents] = useState<ConsentData>({
    terms: false,
    privacy: false,
    marketing: false,
  });

  const isConsentsValid = consents.terms && consents.privacy;

  const roleLabel = ROLE_LABELS[invitation.targetRole];
  const roleColor = ROLE_COLORS[invitation.targetRole];
  const tenantName = invitation.tenantName || "TimeLevelUp";
  const studentName = invitation.studentName;

  const expiresDate = new Date(invitation.expiresAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 초대 설명 생성
  const description = (() => {
    if (invitation.targetRole === "admin" || invitation.targetRole === "consultant") {
      return (
        <>
          <strong>{tenantName}</strong>에서 <RoleBadge role={invitation.targetRole} />로 초대했습니다
        </>
      );
    }
    if (studentName) {
      return (
        <>
          <strong>{studentName}</strong> 학생의 <RoleBadge role={invitation.targetRole} />(으)로 초대되었습니다
        </>
      );
    }
    return (
      <>
        <RoleBadge role={invitation.targetRole} />(으)로 초대되었습니다
      </>
    );
  })();

  // 로그인 상태에서 바로 수락
  const handleAccept = () => {
    if (!currentUserId) return;
    if (!isConsentsValid) {
      setError("이용약관과 개인정보처리방침에 동의해주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation(invitation.token, currentUserId, { consents });
      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        setError(result.error || "초대 수락에 실패했습니다.");
      }
    });
  };

  // OAuth 로그인 → auth callback에서 자동 수락
  const handleSocialLogin = async (provider: Provider) => {
    if (!isConsentsValid) {
      setError("이용약관과 개인정보처리방침에 동의해주세요.");
      return;
    }
    setError(null);
    localStorage.setItem("join_token", invitation.token);

    // 동의 데이터를 쿠키에 저장 (auth callback에서 읽기 위해)
    document.cookie = `join_consents=${JSON.stringify(consents)};path=/;max-age=600;SameSite=Lax`;

    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?join_token=${invitation.token}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message || "소셜 로그인에 실패했습니다.");
    }
  };

  // 로그아웃 후 초대 페이지에 머무름
  const handleLogoutAndStay = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${roleColor.icon}`}>
          <InviteIcon role={invitation.targetRole} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">초대</h1>
        <p className="mt-2 text-gray-600">{description}</p>
      </div>

      {/* Invitation Details */}
      <div className="rounded-xl bg-gray-50 p-4 space-y-3">
        <DetailRow label="기관" value={tenantName} />
        {studentName && <DetailRow label="학생" value={studentName} />}
        {invitation.email && <DetailRow label="이메일" value={invitation.email} />}
        <DetailRow label="유효 기간" value={`${expiresDate}까지`} />
      </div>

      {/* Consents */}
      <div className="space-y-3">
        <ConsentCheckbox
          checked={consents.terms && consents.privacy && consents.marketing}
          onChange={(checked) =>
            setConsents({ terms: checked, privacy: checked, marketing: checked })
          }
          bold
        >
          <span className="text-sm font-semibold text-gray-900">전체 동의</span>
        </ConsentCheckbox>

        <div className="h-px bg-gray-200" />

        <ConsentCheckbox
          checked={consents.terms}
          onChange={(v) => setConsents((prev) => ({ ...prev, terms: v }))}
          required
        >
          <span className="text-sm text-gray-700">
            <a href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">이용약관</a>에 동의합니다
            <span className="text-red-500 ml-0.5">*</span>
          </span>
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={consents.privacy}
          onChange={(v) => setConsents((prev) => ({ ...prev, privacy: v }))}
          required
        >
          <span className="text-sm text-gray-700">
            <a href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-800">개인정보처리방침</a>에 동의합니다
            <span className="text-red-500 ml-0.5">*</span>
          </span>
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={consents.marketing}
          onChange={(v) => setConsents((prev) => ({ ...prev, marketing: v }))}
        >
          <span className="text-sm text-gray-500">마케팅 정보 수신에 동의합니다 (선택)</span>
        </ConsentCheckbox>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Actions */}
      {isLoggedIn ? (
        <LoggedInActions
          currentUserEmail={currentUserEmail}
          isPending={isPending}
          showSwitchAccount={showSwitchAccount}
          roleLabel={roleLabel}
          tenantName={tenantName}
          onAccept={handleAccept}
          onSocialLogin={handleSocialLogin}
          onLogout={handleLogoutAndStay}
          onShowSwitch={() => setShowSwitchAccount(true)}
        />
      ) : (
        <LoggedOutActions
          token={invitation.token}
          isPending={isPending}
          onSocialLogin={handleSocialLogin}
        />
      )}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        이 초대가 본인에게 전달된 것이 아니라면 무시해주세요
      </p>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function RoleBadge({ role }: { role: InvitationRole }) {
  const color = ROLE_COLORS[role];
  return (
    <span className={`inline-flex items-center rounded-full ${color.bg} px-2 py-0.5 text-xs font-medium ${color.text}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function InviteIcon({ role }: { role: InvitationRole }) {
  const colorClass = ROLE_COLORS[role].text.replace("text-", "text-");
  return (
    <svg className={`h-8 w-8 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
    </svg>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  required,
  bold,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${bold ? "h-5 w-5" : "h-4 w-4"}`}
        required={required}
      />
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-300" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-2 text-gray-500">또는</span>
      </div>
    </div>
  );
}

function SocialButtons({
  isPending,
  onSocialLogin,
  action,
}: {
  isPending: boolean;
  onSocialLogin: (provider: Provider) => void;
  action: "가입" | "로그인" | "진행";
}) {
  return (
    <div className="space-y-3">
      {/* Kakao (primary for Korean users) */}
      <button
        type="button"
        onClick={() => onSocialLogin("kakao")}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-yellow-300 bg-[#FEE500] px-4 py-3 text-sm font-medium text-[#191919] shadow-sm hover:bg-[#FDD800] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
          <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.724 1.8 5.113 4.508 6.459-.2.742-.723 2.688-.828 3.105-.13.52.19.513.4.374.164-.109 2.612-1.773 3.666-2.494.718.106 1.464.163 2.254.163 5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
        </svg>
        카카오로 {action}
      </button>
      {/* Google */}
      <button
        type="button"
        onClick={() => onSocialLogin("google")}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Google로 {action}
      </button>
    </div>
  );
}

// ============================================
// Logged-in flow
// ============================================

function LoggedInActions({
  currentUserEmail,
  isPending,
  showSwitchAccount,
  roleLabel,
  tenantName,
  onAccept,
  onSocialLogin,
  onLogout,
  onShowSwitch,
}: {
  currentUserEmail: string | null;
  isPending: boolean;
  showSwitchAccount: boolean;
  roleLabel: string;
  tenantName: string;
  onAccept: () => void;
  onSocialLogin: (provider: Provider) => void;
  onLogout: () => void;
  onShowSwitch: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Current account info */}
      <div className="rounded-xl bg-blue-50 p-4 space-y-1">
        <p className="text-xs text-blue-600 font-medium">현재 로그인된 계정</p>
        <p className="text-sm font-semibold text-blue-900">{currentUserEmail || "알 수 없음"}</p>
      </div>

      {/* Accept button */}
      <button
        onClick={onAccept}
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            처리 중...
          </span>
        ) : (
          "초대 수락하기"
        )}
      </button>
      <p className="text-center text-xs text-gray-500">
        수락하면 {tenantName}의 {roleLabel}로 참여하게 됩니다
      </p>

      {/* Switch account */}
      <Divider />

      {!showSwitchAccount ? (
        <button
          type="button"
          onClick={onShowSwitch}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          다른 계정으로 진행
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-xs text-gray-500">
            로그아웃 후 다른 계정으로 가입하거나 로그인합니다
          </p>
          <SocialButtons isPending={isPending} onSocialLogin={onSocialLogin} action="진행" />
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            로그아웃 후 이메일로 진행
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Logged-out flow: OAuth-first (no email/password form)
// ============================================

function LoggedOutActions({
  token,
  isPending,
  onSocialLogin,
}: {
  token: string;
  isPending: boolean;
  onSocialLogin: (provider: Provider) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-gray-600">
        간편 로그인으로 바로 시작하세요
      </p>

      <SocialButtons isPending={isPending} onSocialLogin={onSocialLogin} action="가입" />

      <Divider />

      <Link
        href={`/login?returnUrl=/join/${token}`}
        className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        이메일로 로그인
      </Link>
    </div>
  );
}
