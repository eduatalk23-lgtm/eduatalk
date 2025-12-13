"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdminUser } from "@/app/(admin)/actions/adminUserActions";

export function CreateAdminUserForm() {
  const [isPending, startTransition] = useTransition();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "consultant">("admin");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createAdminUser(formData);
        router.refresh();
        setUserEmail("");
        alert("관리자 계정이 생성되었습니다.");
      } catch (error) {
        console.error("관리자 계정 생성 실패:", error);
        alert(
          error instanceof Error
            ? error.message
            : "관리자 계정 생성에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 이메일 입력 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            사용자 이메일 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="user_email"
            required
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500">
            관리자로 승격할 사용자의 이메일을 입력하세요.
          </p>
        </div>

        {/* 역할 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            역할 <span className="text-red-500">*</span>
          </label>
          <select
            name="role"
            required
            value={userRole}
            onChange={(e) =>
              setUserRole(e.target.value as "admin" | "consultant")
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="admin">관리자 (Admin)</option>
            <option value="consultant">컨설턴트 (Consultant)</option>
          </select>
          <p className="text-xs text-gray-500">
            관리자: 모든 권한, 컨설턴트: 상담 및 조회 권한
          </p>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !userEmail}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "생성 중..." : "관리자 계정 생성"}
        </button>
      </div>
    </form>
  );
}

