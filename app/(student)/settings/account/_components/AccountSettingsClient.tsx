"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword as updatePassword } from "@/lib/domains/auth";
import { handleSupabaseError } from "@/lib/utils/errorHandling";
import { useToast } from "@/components/ui/ToastProvider";
import ProviderBadge, {
  toAuthProvider,
  formatRelativeTime,
  type AuthProvider,
} from "@/components/ui/ProviderBadge";

type AccountSettingsClientProps = {
  email: string | null;
  provider: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

export default function AccountSettingsClient({
  email,
  provider,
  lastSignInAt,
  emailConfirmedAt,
}: AccountSettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const authProvider: AuthProvider = toAuthProvider(provider);
  const isEmailUser = authProvider === "email";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const currentPassword = String(
      formData.get("current_password") ?? ""
    ).trim();
    const newPassword = String(formData.get("new_password") ?? "").trim();
    const confirmPassword = String(
      formData.get("confirm_password") ?? ""
    ).trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("모든 필드를 입력해주세요.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      showError("새 비밀번호는 최소 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    try {
      const result = await updatePassword(currentPassword, newPassword);

      if (result.success) {
        showSuccess("비밀번호가 변경되었습니다.");
        setTimeout(() => {
          router.push("/settings");
        }, 2000);
      } else {
        showError(result.error || "비밀번호 변경에 실패했습니다.");
      }
    } catch (err: unknown) {
      const errorMessage = handleSupabaseError(err);
      showError(errorMessage || "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 계정 정보 섹션 */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="text-h2">계정 정보</h2>

        <div className="flex flex-col gap-4">
          {/* 이메일 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              이메일
            </label>
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-[var(--text-secondary)]">
              {email ?? "-"}
            </div>
          </div>

          {/* 로그인 방식 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              로그인 방식
            </label>
            <div className="flex items-center gap-3">
              <ProviderBadge provider={authProvider} />
              {lastSignInAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  최근 로그인: {formatRelativeTime(lastSignInAt)}
                </span>
              )}
            </div>
          </div>

          {/* 이메일 인증 상태 */}
          {isEmailUser && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일 인증
              </label>
              <div className="flex items-center gap-2">
                {emailConfirmedAt ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      인증 완료
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    미인증
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 비밀번호 변경 - 이메일 사용자만 */}
      {isEmailUser ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="text-h2">비밀번호 변경</h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                현재 비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="current_password"
                required
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                placeholder="현재 비밀번호를 입력하세요"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                새 비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="new_password"
                required
                minLength={6}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                placeholder="새 비밀번호를 입력하세요 (최소 6자)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                비밀번호는 최소 6자 이상이어야 합니다.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                새 비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="confirm_password"
                required
                minLength={6}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                placeholder="새 비밀번호를 다시 입력하세요"
              />
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </form>
      ) : (
        /* OAuth 사용자 안내 */
        <section className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-h2">비밀번호 관리</h2>
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                소셜 계정으로 로그인 중입니다
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <ProviderBadge provider={authProvider} size="sm" />{" "}
                계정으로 로그인하고 있어 별도의 비밀번호가 필요하지 않습니다.
                비밀번호는 해당 소셜 서비스에서 관리됩니다.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
