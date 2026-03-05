import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAllFileRequestsAction,
  getFileRequestKpiAction,
} from "@/lib/domains/drive/actions/workflow";
import { REQUEST_STATUSES, type FileRequestStatus } from "@/lib/domains/drive/types";
import { FileRequestDashboardClient } from "./_components/FileRequestDashboardClient";

const VALID_STATUSES = new Set<string>(REQUEST_STATUSES);

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const { userId, role } = await getCachedUserRole();
  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const rawStatus = params.status;
  const status = rawStatus && VALID_STATUSES.has(rawStatus)
    ? (rawStatus as FileRequestStatus)
    : undefined;
  const search = params.search || undefined;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const [requestsData, kpi] = await Promise.all([
    getAllFileRequestsAction({ status, search, page }),
    getFileRequestKpiAction(),
  ]);

  return (
    <PageContainer widthType="LIST">
      <PageHeader
        title="파일 요청 관리"
        description="전체 학생의 파일 제출 요청 현황을 관리합니다."
      />
      <FileRequestDashboardClient
        requests={requestsData.requests}
        hasMore={requestsData.hasMore}
        kpi={kpi}
        currentStatus={status}
        currentSearch={search ?? ""}
        currentPage={page}
      />
    </PageContainer>
  );
}
