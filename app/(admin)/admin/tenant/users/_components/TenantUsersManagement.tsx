"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/atoms/Spinner";
import {
  getTenantUsersAction,
  assignUserToTenantAction,
} from "@/app/(admin)/actions/tenantUsers";
import type { TenantUser } from "@/app/(admin)/actions/tenantUsers";

type TenantUsersManagementProps = {
  tenantId: string;
};

export function TenantUsersManagement({
  tenantId,
}: TenantUsersManagementProps) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [filter, setFilter] = useState<"all" | "students" | "parents">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadUsers();
  }, [tenantId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getTenantUsersAction(tenantId);
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      showError("사용자 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToTenant = async (
    userId: string,
    userType: "student" | "parent"
  ) => {
    try {
      const result = await assignUserToTenantAction(userId, tenantId, userType);
      if (result.success) {
        showSuccess("사용자가 기관에 할당되었습니다.");
        loadUsers();
      } else {
        showError(result.error || "사용자 할당에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to assign user:", error);
      showError("사용자 할당 중 오류가 발생했습니다.");
    }
  };

  const filteredUsers = users.filter((user) => {
    // 필터 적용
    if (filter === "students" && user.type !== "student") return false;
    if (filter === "parents" && user.type !== "parent") return false;

    // 검색어 적용
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const isStudent = user.type === "student";
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        (isStudent && user.grade?.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const stats = {
    total: users.length,
    students: users.filter((u) => u.type === "student").length,
    parents: users.filter((u) => u.type === "parent").length,
    unassigned: users.filter((u) => !u.tenant_id).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-300 bg-white p-6">
          <div className="text-body-2 text-gray-600">전체 사용자</div>
          <div className="mt-2 text-h2 text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-6">
          <div className="text-body-2 text-gray-600">학생</div>
          <div className="mt-2 text-h2 text-gray-900">{stats.students}</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-6">
          <div className="text-body-2 text-gray-600">학부모</div>
          <div className="mt-2 text-h2 text-gray-900">{stats.parents}</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-6">
          <div className="text-body-2 text-gray-600">미할당</div>
          <div className="mt-2 text-h2 text-gray-900">{stats.unassigned}</div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 text-body-2 font-semibold transition ${
              filter === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter("students")}
            className={`rounded-lg px-4 py-2 text-body-2 font-semibold transition ${
              filter === "students"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            학생
          </button>
          <button
            onClick={() => setFilter("parents")}
            className={`rounded-lg px-4 py-2 text-body-2 font-semibold transition ${
              filter === "parents"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            학부모
          </button>
        </div>

        <input
          type="text"
          placeholder="이름, 이메일, 학년으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-body-2 text-gray-900 md:w-64"
        />
      </div>

      {/* 사용자 목록 */}
      <div className="rounded-xl border border-gray-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-300 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  정보
                </th>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  기관
                </th>
                <th className="px-6 py-3 text-left text-body-2-bold text-gray-800">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-body-2 text-gray-600"
                  >
                    {searchQuery
                      ? "검색 결과가 없습니다."
                      : "사용자가 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-body-2 text-gray-900">
                      {user.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-body-2 text-gray-900">
                      {user.email || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          user.type === "student"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {user.type === "student" ? "학생" : "학부모"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-body-2 text-gray-900">
                      {user.type === "student" ? (
                        <span>
                          {user.grade || "-"} 학년
                        </span>
                      ) : (
                        <span>
                          {user.relationship || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-body-2 text-gray-900">
                      {user.tenant_id ? (
                        <span className="text-green-600">할당됨</span>
                      ) : (
                        <span className="text-red-600">미할당</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!user.tenant_id || user.tenant_id !== tenantId ? (
                        <button
                          onClick={() =>
                            handleAssignToTenant(user.id, user.type)
                          }
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white hover:bg-indigo-700"
                        >
                          {user.tenant_id ? "이동" : "할당"}
                        </button>
                      ) : (
                        <span className="text-body-2 text-gray-600">
                          현재 기관
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

