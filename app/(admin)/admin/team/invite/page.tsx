import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteForm } from "./_components/InviteForm";

export default async function InvitePage() {
  const { userId, role } = await getCurrentUserRole();

  // admin 또는 superadmin만 초대 가능
  if (!userId || (role !== "admin" && role !== "superadmin")) {
    redirect("/admin/team");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/team"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <PageHeader
          title="팀원 초대"
          description="이메일로 새로운 팀원을 초대하세요"
        />
      </div>

      {/* Invite Form */}
      <div className="mx-auto w-full max-w-lg">
        <InviteForm />
      </div>
    </div>
  );
}
