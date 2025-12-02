"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAdminUser } from "@/app/(admin)/actions/adminUserActions";

type AdminUser = {
  id: string;
  role: string;
  created_at: string;
  email: string;
};

export function AdminUsersList({ adminUsers }: { adminUsers: AdminUser[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(userId: string) {
    if (!confirm("정말 이 사용자의 관리자 권한을 제거하시겠습니까?")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteAdminUser(userId);
        router.refresh();
        alert("관리자 권한이 제거되었습니다.");
      } catch (error) {
        console.error("관리자 권한 제거 실패:", error);
        alert(
          error instanceof Error
            ? error.message
            : "관리자 권한 제거에 실패했습니다."
        );
      }
    });
  }

  if (adminUsers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="text-6xl">👤</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              등록된 관리자가 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              위 폼을 사용하여 관리자 계정을 생성하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              이메일
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              역할
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              생성일
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              작업
            </th>
          </tr>
        </thead>
        <tbody>
          {adminUsers.map((adminUser) => (
            <tr
              key={adminUser.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm text-gray-900">
                {adminUser.email}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    adminUser.role === "admin"
                      ? "bg-indigo-100 text-indigo-800"
                      : adminUser.role === "superadmin"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {adminUser.role === "admin"
                    ? "관리자"
                    : adminUser.role === "superadmin"
                    ? "Super Admin"
                    : "컨설턴트"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(adminUser.created_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <button
                  onClick={() => handleDelete(adminUser.id)}
                  disabled={isPending}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                >
                  권한 제거
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

