
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import Link from "next/link";
import { SMSResultsClient } from "./_components/SMSResultsClient";

type SMSLogRow = {
  id: string;
  tenant_id?: string | null;
  recipient_id?: string | null;
  recipient_phone?: string | null;
  message_content?: string | null;
  template_id?: string | null;
  status?: "pending" | "sent" | "delivered" | "failed" | "scheduled" | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  message_key?: string | null;
  ref_key?: string | null;
  ppurio_result_code?: string | null;
  scheduled_at?: string | null;
};

type StudentRow = {
  id: string;
  name?: string | null;
};

const ITEMS_PER_PAGE = 20;

export default async function SMSResultsPage({
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
  const startDate = params.startDate?.trim() ?? "";
  const endDate = params.endDate?.trim() ?? "";
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // SMS 로그 조회 (페이지네이션 적용)
  const selectLogs = () =>
    supabase
      .from("sms_logs")
      .select(
        "id,tenant_id,recipient_id,recipient_phone,message_content,template_id,status,sent_at,delivered_at,error_message,created_at,message_key,ref_key,ppurio_result_code,scheduled_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

  let query = selectLogs();

  // 상태 필터링
  if (statusFilter && ["pending", "sent", "delivered", "failed", "scheduled"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  // 날짜 범위 필터
  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59`);
  }

  let { data: allLogs, error, count } = await query;

  if (ErrorCodeCheckers.isColumnNotFound(error)) {
    const retryQuery = selectLogs();
    if (statusFilter && ["pending", "sent", "delivered", "failed", "scheduled"].includes(statusFilter)) {
      retryQuery.eq("status", statusFilter);
    }
    if (startDate) retryQuery.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) retryQuery.lte("created_at", `${endDate}T23:59:59`);
    ({ data: allLogs, error, count } = await retryQuery);
  }

  if (error) {
    console.error("[admin/sms/results] SMS 로그 조회 실패:", error);
  }

  // 테이블이 없는 경우 에러 메시지 표시
  const errorCode = error?.code;
  const errorMessage = error?.message || "";
  if (
    error &&
    (errorCode === "PGRST205" ||
      errorCode === "42P01" ||
      errorMessage.includes("Could not find the table") ||
      errorMessage.includes("테이블"))
  ) {
    return (
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMS 발송 이력</h1>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <p className="text-sm font-medium text-yellow-800">
            SMS 로그 테이블이 아직 생성되지 않았습니다.
          </p>
          <p className="text-xs text-yellow-700">
            데이터베이스 마이그레이션을 실행해주세요.
          </p>
        </div>
      </div>
    );
  }

  let logRows = (allLogs as SMSLogRow[] | null) ?? [];

  // 학생 정보 조회 (로그에 표시하기 위해, 검색에도 사용)
  const allRecipientIds = [
    ...new Set(logRows.map((l) => l.recipient_id).filter(Boolean)),
  ] as string[];
  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .in("id", allRecipientIds.length > 0 ? allRecipientIds : [""]);

  const studentMap = new Map(
    (students ?? []).map((s: StudentRow) => [s.id, s.name ?? "이름 없음"])
  );

  // 검색 필터링 (학생 이름, 전화번호, 메시지 내용으로)
  if (searchQuery) {
    logRows = logRows.filter((log) => {
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

  // 페이지네이션 적용 (검색 필터링 후)
  const totalCount = searchQuery ? logRows.length : (count ?? 0);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLogs = logRows.slice(offset, offset + ITEMS_PER_PAGE);

  // 전체 통계를 위한 별도 쿼리 (필터 적용 전)
  const { count: totalStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true });

  const { count: pendingStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: sentStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent");

  const { count: deliveredStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "delivered");

  const { count: failedStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: scheduledStats } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "scheduled");

  const stats = {
    total: totalStats ?? 0,
    pending: pendingStats ?? 0,
    sent: sentStats ?? 0,
    delivered: deliveredStats ?? 0,
    failed: failedStats ?? 0,
    scheduled: scheduledStats ?? 0,
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">SMS 발송 이력</h1>
        <Link
          href="/admin/sms/send"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          SMS 발송하기
        </Link>
      </div>

      <SMSResultsClient
        initialLogs={paginatedLogs}
        studentMap={Object.fromEntries(studentMap)}
        stats={stats}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        startDate={startDate}
        endDate={endDate}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
      />
    </div>
  );
}
