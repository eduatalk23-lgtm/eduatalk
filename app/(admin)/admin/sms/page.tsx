export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

type SMSLogRow = {
  id: string;
  tenant_id?: string | null;
  recipient_id?: string | null;
  recipient_phone?: string | null;
  message_content?: string | null;
  template_id?: string | null;
  status?: "pending" | "sent" | "delivered" | "failed" | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

type StudentRow = {
  id: string;
  name?: string | null;
};

export default async function AdminSMSPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const searchQuery = params.search?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "";

  // SMS 로그 조회
  const selectLogs = () =>
    supabase
      .from("sms_logs")
      .select(
        "id,tenant_id,recipient_id,recipient_phone,message_content,template_id,status,sent_at,delivered_at,error_message,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

  let query = selectLogs();

  // 상태 필터링
  if (statusFilter && ["pending", "sent", "delivered", "failed"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  let { data: logs, error } = await query;

  if (error && error.code === "42703") {
    ({ data: logs, error } = await selectLogs());
  }

  if (error) {
    console.error("[admin/sms] SMS 로그 조회 실패", error);
  }

  const logRows = (logs as SMSLogRow[] | null) ?? [];

  // 학생 정보 조회
  const recipientIds = [
    ...new Set(logRows.map((l) => l.recipient_id).filter(Boolean)),
  ] as string[];
  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .in("id", recipientIds.length > 0 ? recipientIds : [""]);

  const studentMap = new Map(
    (students ?? []).map((s: StudentRow) => [s.id, s.name ?? "이름 없음"])
  );

  // 검색 필터링 (학생 이름, 전화번호, 메시지 내용으로)
  let filteredLogs = logRows;
  if (searchQuery) {
    filteredLogs = logRows.filter((log) => {
      const studentName = studentMap.get(log.recipient_id ?? "") ?? "";
      const phone = log.recipient_phone ?? "";
      const message = log.message_content ?? "";
      return (
        studentName.includes(searchQuery) ||
        phone.includes(searchQuery) ||
        message.includes(searchQuery)
      );
    });
  }

  // 상태별 통계
  const stats = {
    total: filteredLogs.length,
    pending: filteredLogs.filter((l) => l.status === "pending").length,
    sent: filteredLogs.filter((l) => l.status === "sent").length,
    delivered: filteredLogs.filter((l) => l.status === "delivered").length,
    failed: filteredLogs.filter((l) => l.status === "failed").length,
  };

  const getStatusBadgeClass = (status: string | null | undefined) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "sent":
        return "발송 완료";
      case "delivered":
        return "전달 완료";
      case "pending":
        return "대기 중";
      case "failed":
        return "실패";
      default:
        return "알 수 없음";
    }
  };

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">SMS 발송 이력</h1>
      </div>

      {/* 통계 */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">전체</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">대기 중</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">발송 완료</div>
          <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">전달 완료</div>
          <div className="text-2xl font-bold text-blue-600">{stats.delivered}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">실패</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <form method="get" className="flex flex-1 gap-2">
          <input
            type="text"
            name="search"
            placeholder="학생 이름, 전화번호, 메시지 내용으로 검색..."
            defaultValue={searchQuery}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">전체 상태</option>
            <option value="pending">대기 중</option>
            <option value="sent">발송 완료</option>
            <option value="delivered">전달 완료</option>
            <option value="failed">실패</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          {(searchQuery || statusFilter) && (
            <Link
              href="/admin/sms"
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      {/* SMS 로그 목록 */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          title="SMS 발송 이력이 없습니다"
          description="아직 발송된 SMS가 없습니다."
        />
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const studentName = studentMap.get(log.recipient_id ?? "") ?? "-";
            return (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {log.recipient_id && (
                      <Link
                        href={`/admin/students/${log.recipient_id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {studentName}
                      </Link>
                    )}
                    {!log.recipient_id && (
                      <span className="font-semibold text-gray-900">-</span>
                    )}
                    <span className="text-sm text-gray-500">
                      {log.recipient_phone ?? "-"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                    >
                      {getStatusLabel(log.status)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString("ko-KR")
                      : "-"}
                  </span>
                </div>
                <p className="mb-2 text-sm text-gray-700">
                  {log.message_content ?? "-"}
                </p>
                {log.sent_at && (
                  <div className="text-xs text-gray-500">
                    발송 시간: {new Date(log.sent_at).toLocaleString("ko-KR")}
                  </div>
                )}
                {log.delivered_at && (
                  <div className="text-xs text-gray-500">
                    전달 시간: {new Date(log.delivered_at).toLocaleString("ko-KR")}
                  </div>
                )}
                {log.error_message && (
                  <div className="mt-2 text-xs text-red-600">
                    오류: {log.error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

