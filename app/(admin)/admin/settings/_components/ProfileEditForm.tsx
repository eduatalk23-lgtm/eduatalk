"use client";

import { useState, useTransition } from "react";
import { updateMyProfile } from "@/lib/domains/team/actions/profile";
import { useToast } from "@/components/ui/ToastProvider";

type ProfileEditFormProps = {
  initialName: string;
  email: string | null;
  role: string;
};

export default function ProfileEditForm({
  initialName,
  email,
  role,
}: ProfileEditFormProps) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const roleLabel = role === "admin" ? "관리자" : role === "consultant" ? "상담사" : "슈퍼관리자";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("이름을 입력해주세요.", "error");
      return;
    }

    startTransition(async () => {
      const result = await updateMyProfile({ name: name.trim() });

      if (result.success) {
        showToast("프로필이 수정되었습니다.", "success");
        setIsEditing(false);
      } else {
        showToast(result.error || "프로필 수정에 실패했습니다.", "error");
      }
    });
  };

  const handleCancel = () => {
    setName(initialName);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-gray-900 dark:text-gray-100">내 프로필</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            수정
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              이름
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="이름을 입력하세요"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">이메일</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {email || "-"}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">역할</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {roleLabel}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">이름</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {initialName || "-"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">이메일</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {email || "-"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">역할</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {roleLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
