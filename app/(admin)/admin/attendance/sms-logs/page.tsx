
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getAttendanceSMSLogs } from "@/app/(admin)/actions/smsLogActions";
import { SMSLogsTable } from "./_components/SMSLogsTable";
import { Card, CardContent } from "@/components/molecules/Card";
import { SMSLogsFilters } from "./_components/SMSLogsFilters";
import { SMSLogsPagination } from "./_components/SMSLogsPagination";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function SMSLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 50;

  // 필터 파라미터 파싱
  const filters = {
    startDate: params.startDate,
    endDate: params.endDate,
    studentId: params.studentId,
    status: params.status as "pending" | "sent" | "delivered" | "failed" | undefined,
    smsType: params.smsType as
      | "attendance_check_in"
      | "attendance_check_out"
      | "attendance_absent"
      | "attendance_late"
      | undefined,
  };

  // SMS 로그 조회
  const result = await getAttendanceSMSLogs(filters, page, pageSize);

  if (!result.success) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
          {result.error || "SMS 로그를 불러올 수 없습니다."}
        </div>
      </div>
    );
  }

  const logs = result.data || [];
  const total = result.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="출석 SMS 발송 로그"
          description="출석 관련 SMS 발송 이력을 확인할 수 있습니다."
        />

        {/* 필터 */}
        <SMSLogsFilters currentFilters={filters} />

        {/* 통계 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent>
              <div className="text-sm text-gray-500">전체 로그</div>
              <div className="text-2xl font-semibold text-gray-900">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-500">성공</div>
              <div className="text-2xl font-semibold text-green-600">
                {logs.filter((log) => log.status === "sent" || log.status === "delivered").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-500">실패</div>
              <div className="text-2xl font-semibold text-red-600">
                {logs.filter((log) => log.status === "failed").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-500">대기</div>
              <div className="text-2xl font-semibold text-amber-600">
                {logs.filter((log) => log.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 로그 테이블 */}
        <SMSLogsTable logs={logs} />

        {/* 페이지네이션 */}
        <SMSLogsPagination currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}

