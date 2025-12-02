"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTenantToUser, assignTenantToMultipleUsers, type TenantlessUser } from "@/app/(superadmin)/actions/tenantlessUserActions";
import { AssignTenantDialog } from "./AssignTenantDialog";

type TenantlessUsersListProps = {
  users: TenantlessUser[];
  searchQuery: string;
  userTypeFilter: "student" | "parent" | "admin" | "all";
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

export function TenantlessUsersList({
  users,
  searchQuery,
  userTypeFilter,
  currentPage,
  totalPages,
  totalCount,
}: TenantlessUsersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assigningUserType, setAssigningUserType] = useState<"student" | "parent" | "admin" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const handleAssignTenant = (userId: string, userType: "student" | "parent" | "admin") => {
    setAssigningUserId(userId);
    setAssigningUserType(userType);
    setAssignDialogOpen(true);
  };

  const handleBulkAssignTenant = () => {
    if (selectedUsers.size === 0) {
      alert("테넌트를 할당할 사용자를 선택해주세요.");
      return;
    }

    // 선택된 사용자들의 타입 정보 수집
    const selectedUserData = users
      .filter((u) => selectedUsers.has(u.id))
      .map((u) => ({ userId: u.id, userType: u.userType }));

    if (selectedUserData.length === 0) {
      alert("선택된 사용자가 없습니다.");
      return;
    }

    setAssigningUserId(null); // null이면 일괄 할당 모드
    setAssignDialogOpen(true);
  };

  const handleAssignComplete = () => {
    setAssignDialogOpen(false);
    setAssigningUserId(null);
    setAssigningUserType(null);
    setSelectedUsers(new Set());
    router.refresh();
  };

  if (actionMessage) {
    setTimeout(() => setActionMessage(null), 3000);
  }

  // URL 파라미터 생성 헬퍼
  const buildUrl = (page: number, search?: string, type?: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (search) params.set("search", search);
    if (type && type !== "all") params.set("type", type);
    return `/superadmin/tenantless-users${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" className="flex flex-1 gap-2">
          <input
            type="text"
            name="search"
            placeholder="이메일 또는 이름으로 검색..."
            defaultValue={searchQuery}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <input type="hidden" name="type" value={userTypeFilter} />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
        </form>
        <div className="flex gap-2">
          {/* 타입 필터 */}
          <div className="flex rounded-lg border border-gray-300 bg-white">
            <a
              href={buildUrl(1, searchQuery || undefined, "all")}
              className={`px-4 py-2 text-sm font-medium transition ${
                userTypeFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              전체
            </a>
            <a
              href={buildUrl(1, searchQuery || undefined, "student")}
              className={`px-4 py-2 text-sm font-medium transition ${
                userTypeFilter === "student"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              학생
            </a>
            <a
              href={buildUrl(1, searchQuery || undefined, "parent")}
              className={`px-4 py-2 text-sm font-medium transition ${
                userTypeFilter === "parent"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              학부모
            </a>
            <a
              href={buildUrl(1, searchQuery || undefined, "admin")}
              className={`px-4 py-2 text-sm font-medium transition ${
                userTypeFilter === "admin"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              관리자
            </a>
          </div>
          {/* 일괄 할당 버튼 */}
          {selectedUsers.size > 0 && (
            <button
              onClick={handleBulkAssignTenant}
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "처리 중..." : `선택한 ${selectedUsers.size}명 할당`}
            </button>
          )}
        </div>
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
            : "테넌트 미할당 사용자가 없습니다."}
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
                  역할
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
                    {user.name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        user.role === "student"
                          ? "bg-blue-100 text-blue-800"
                          : user.role === "parent"
                          ? "bg-purple-100 text-purple-800"
                          : user.role === "admin"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-cyan-100 text-cyan-800"
                      }`}
                    >
                      {user.role === "student"
                        ? "학생"
                        : user.role === "parent"
                        ? "학부모"
                        : user.role === "admin"
                        ? "관리자"
                        : "컨설턴트"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <button
                      onClick={() => handleAssignTenant(user.id, user.userType)}
                      disabled={isPending}
                      className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-200 disabled:opacity-50"
                    >
                      테넌트 할당
                    </button>
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
              href={buildUrl(currentPage - 1, searchQuery || undefined, userTypeFilter)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              이전
            </a>
          )}
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages} (총 {totalCount}명)
          </span>
          {currentPage < totalPages && (
            <a
              href={buildUrl(currentPage + 1, searchQuery || undefined, userTypeFilter)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              다음
            </a>
          )}
        </div>
      )}

      {/* 테넌트 할당 다이얼로그 */}
      <AssignTenantDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        userId={assigningUserId}
        userType={assigningUserType}
        selectedUserIds={assigningUserId ? null : Array.from(selectedUsers)}
        users={users}
        onComplete={handleAssignComplete}
      />
    </div>
  );
}

