"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeTeamMember, updateMemberRole } from "@/lib/domains/team/actions";
import type { TeamMember, InvitationRole } from "@/lib/domains/team/types";

type TeamMembersListProps = {
  members: TeamMember[];
  canManage: boolean;
};

export function TeamMembersList({ members, canManage }: TeamMembersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 팀에서 제거하시겠습니까?`)) {
      return;
    }

    setError(null);
    setActioningId(memberId);
    startTransition(async () => {
      const result = await removeTeamMember(memberId);
      setActioningId(null);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "팀원 제거에 실패했습니다.");
      }
    });
  };

  const handleRoleChange = (memberId: string, newRole: InvitationRole) => {
    setError(null);
    setActioningId(memberId);
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole);
      setActioningId(null);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "역할 변경에 실패했습니다.");
      }
    });
  };

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
          <svg
            className="h-6 w-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          아직 팀원이 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {members.map((member) => {
            const isActioning = actioningId === member.id;
            const roleLabel = member.role === "admin" ? "관리자" : "컨설턴트";

            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {member.displayName?.[0] || member.email[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {member.displayName || member.email.split("@")[0]}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Role Badge / Select */}
                  {canManage ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as InvitationRole)
                      }
                      disabled={isActioning || isPending}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                      <option value="admin">관리자</option>
                      <option value="consultant">컨설턴트</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        member.role === "admin"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {roleLabel}
                    </span>
                  )}

                  {/* Remove Button */}
                  {canManage && (
                    <button
                      onClick={() =>
                        handleRemove(
                          member.id,
                          member.displayName || member.email
                        )
                      }
                      disabled={isActioning || isPending}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
                      title="팀에서 제거"
                    >
                      {isActioning ? (
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
