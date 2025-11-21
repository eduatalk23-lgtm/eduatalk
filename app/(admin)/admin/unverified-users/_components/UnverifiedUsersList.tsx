"use client";

import { useState, useTransition } from "react";
import {
  deleteUnverifiedUser,
  resendVerificationEmail,
  deleteMultipleUnverifiedUsers,
} from "@/app/(admin)/actions/unverifiedUserActions";
import { useRouter } from "next/navigation";

type UnverifiedUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: {
    display_name?: string;
  };
};

type UnverifiedUsersListProps = {
  users: UnverifiedUser[];
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

export function UnverifiedUsersList({
  users,
  searchQuery,
  currentPage,
  totalPages,
  totalCount,
}: UnverifiedUsersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleDelete = (userId: string, email?: string) => {
    if (
      !confirm(
        `정말 ${email || "이 사용자"}를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteUnverifiedUser(userId);
      if (result.success) {
        setActionMessage("사용자가 삭제되었습니다.");
        router.refresh();
      } else {
        alert(result.error || "사용자 삭제에 실패했습니다.");
      }
    });
  };

  const handleResendEmail = (email: string) => {
    startTransition(async () => {
      const result = await resendVerificationEmail(email);
      if (result.success) {
        setActionMessage(result.message || "인증 메일이 재발송되었습니다.");
      } else {
        alert(result.error || "인증 메일 재발송에 실패했습니다.");
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const handleToggleSelect = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedUsers.size === 0) {
      alert("삭제할 사용자를 선택해주세요.");
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedUsers.size}명의 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteMultipleUnverifiedUsers(Array.from(selectedUsers));
      if (result.success) {
        setActionMessage(`${result.deletedCount || 0}명의 사용자가 삭제되었습니다.`);
        setSelectedUsers(new Set());
        router.refresh();
      } else {
        alert(result.error || "일괄 삭제에 실패했습니다.");
      }
    });
  };

  if (actionMessage) {
    setTimeout(() => setActionMessage(null), 3000);
  }

  return (
    <div className="space-y-4">
      {/* 검색 및 일괄 작업 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" className="flex-1">
          <input
            type="text"
            name="search"
            placeholder="이메일 또는 이름으로 검색..."
            defaultValue={searchQuery}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </form>
        {selectedUsers.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "삭제 중..." : `선택한 ${selectedUsers.size}명 삭제`}
          </button>
        )}
      </div>

      {actionMessage && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          {actionMessage}
        </div>
      )}

      {/* 사용자 목록 */}
      {users.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          {searchQuery
            ? "검색 결과가 없습니다."
            : "미인증 사용자가 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  가입일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleToggleSelect(user.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {user.email || "이메일 없음"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {user.user_metadata?.display_name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      {user.email && (
                        <button
                          onClick={() => handleResendEmail(user.email!)}
                          disabled={isPending}
                          className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-200 disabled:opacity-50"
                        >
                          인증 메일 재발송
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={isPending}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <a
              href={`/admin/unverified-users?page=${currentPage - 1}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              이전
            </a>
          )}
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={`/admin/unverified-users?page=${currentPage + 1}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              다음
            </a>
          )}
        </div>
      )}
    </div>
  );
}

