"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/app/(student)/actions/accountActions";
import { useToast } from "@/components/ui/ToastProvider";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

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
    } catch (err: any) {
      showError(err.message || "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold">계정 관리</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">비밀번호 변경</h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                현재 비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="current_password"
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="현재 비밀번호를 입력하세요"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                새 비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="new_password"
                required
                minLength={6}
                className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="새 비밀번호를 입력하세요 (최소 6자)"
              />
              <p className="text-xs text-gray-500">
                비밀번호는 최소 6자 이상이어야 합니다.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                새 비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="confirm_password"
                required
                minLength={6}
                className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="새 비밀번호를 다시 입력하세요"
              />
            </div>
          </section>

          {/* 저장 버튼 */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
      </div>
    </div>
  );
}
