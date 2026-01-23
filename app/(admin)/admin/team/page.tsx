import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getTeamMembers, getPendingInvitations, getTeamOverview } from "@/lib/domains/team/queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamMembersList } from "./_components/TeamMembersList";
import { PendingInvitationsList } from "./_components/PendingInvitationsList";

export default async function TeamPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  // consultant는 팀원 목록만 볼 수 있음 (초대 불가)
  const canInvite = role === "admin" || role === "superadmin";

  const [members, pendingInvitations, overview] = await Promise.all([
    getTeamMembers(),
    canInvite ? getPendingInvitations() : Promise.resolve([]),
    getTeamOverview(),
  ]);

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="팀 관리"
          description="팀원을 초대하고 관리하세요"
        />
        {canInvite && (
          <Link
            href="/admin/team/invite"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            팀원 초대
          </Link>
        )}
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              전체 팀원
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {overview.totalMembers}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              관리자
            </div>
            <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {overview.adminCount}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              컨설턴트
            </div>
            <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
              {overview.consultantCount}
            </div>
          </div>
          {canInvite && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                대기 중인 초대
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {overview.pendingInvitations}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Members */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          팀원 ({members.length})
        </h2>
        <TeamMembersList members={members} canManage={canInvite} currentUserId={userId} />
      </div>

      {/* Pending Invitations */}
      {canInvite && pendingInvitations.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            대기 중인 초대 ({pendingInvitations.length})
          </h2>
          <PendingInvitationsList invitations={pendingInvitations} />
        </div>
      )}
    </div>
  );
}
