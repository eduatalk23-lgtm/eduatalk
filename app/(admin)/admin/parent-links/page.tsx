import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { PendingLinkRequestsList } from "./_components/PendingLinkRequestsList";
import { PendingLinkRequestsSkeleton } from "./_components/PendingLinkRequestsSkeleton";

export default async function ParentLinksPage() {
  const { userId, role, tenantId } = await getCurrentUserRole();

  // 권한 확인
  if (!userId || (role !== "admin" && role !== "consultant")) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-h1 text-gray-900">학부모 연결 관리</h1>
        <p className="mt-2 text-sm text-gray-600">
          학부모가 요청한 학생 연결을 승인하거나 거부할 수 있습니다.
        </p>
      </div>

      <Suspense fallback={<PendingLinkRequestsSkeleton />}>
        <PendingLinkRequestsList tenantId={tenantId} />
      </Suspense>
    </div>
  );
}

