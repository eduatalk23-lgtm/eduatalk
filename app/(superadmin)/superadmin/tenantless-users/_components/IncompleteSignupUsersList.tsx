"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncompleteSignupUser } from "@/lib/domains/superadmin";
import { deleteIncompleteSignupUser } from "@/lib/domains/superadmin";

type Props = {
  users: IncompleteSignupUser[];
};

export function IncompleteSignupUsersList({ users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (userId: string, email: string) => {
    if (!confirm(`"${email}" 사용자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingId(userId);
    startTransition(async () => {
      const result = await deleteIncompleteSignupUser(userId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "삭제에 실패했습니다.");
      }
      setDeletingId(null);
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProviderLabel = (provider: string | null) => {
    switch (provider) {
      case "google":
        return "Google";
      case "kakao":
        return "카카오";
      case "email":
        return "이메일";
      default:
        return provider || "알 수 없음";
    }
  };

  if (users.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        미완료 가입 사용자가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-500">
            <th className="pb-3 pr-4">이메일</th>
            <th className="pb-3 pr-4">이름</th>
            <th className="pb-3 pr-4">가입 방법</th>
            <th className="pb-3 pr-4">가입 시도 역할</th>
            <th className="pb-3 pr-4">가입 시도 시각</th>
            <th className="pb-3 pr-4">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="text-sm">
              <td className="py-3 pr-4">
                <span className="font-medium text-gray-900">{user.email}</span>
              </td>
              <td className="py-3 pr-4 text-gray-700">
                {user.name || "-"}
              </td>
              <td className="py-3 pr-4">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {getProviderLabel(user.provider)}
                </span>
              </td>
              <td className="py-3 pr-4">
                {user.signupRole ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {user.signupRole === "student" ? "학생" : user.signupRole === "parent" ? "학부모" : user.signupRole}
                  </span>
                ) : (
                  <span className="text-gray-400">미선택</span>
                )}
              </td>
              <td className="py-3 pr-4 text-gray-500">
                {formatDate(user.created_at)}
              </td>
              <td className="py-3 pr-4">
                <button
                  onClick={() => handleDelete(user.id, user.email)}
                  disabled={isPending && deletingId === user.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {isPending && deletingId === user.id ? "삭제 중..." : "삭제"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
