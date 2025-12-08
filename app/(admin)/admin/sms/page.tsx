export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";

export default async function AdminSMSPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  // 발송 폼 페이지로 리다이렉트
  redirect("/admin/sms/send");

  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
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
    // 에러 객체 전체를 먼저 로깅
    console.error("[admin/sms] SMS 로그 조회 실패 - 원본 에러:", error);
    console.error("[admin/sms] 에러 타입:", typeof error);
    console.error("[admin/sms] 에러 constructor:", error?.constructor?.name);
    
    // Supabase 에러 객체의 주요 속성 추출
    const errorInfo: Record<string, unknown> = {
      message: error?.message || error?.toString() || String(error) || "알 수 없는 에러",
      code: error?.code || "UNKNOWN",
      name: error?.name,
      stack: error?.stack,
    };
    
    // Supabase PostgrestError 속성 확인
    if (error && typeof error === "object") {
      if ("details" in error) {
        errorInfo.details = (error as { details?: unknown }).details;
      }
      if ("hint" in error) {
        errorInfo.hint = (error as { hint?: unknown }).hint;
      }
      if ("statusCode" in error) {
        errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
      }
      // AppError 속성 확인
      if ("statusCode" in error && "code" in error) {
        errorInfo.appErrorCode = (error as { code?: unknown }).code;
        errorInfo.appErrorStatusCode = (error as { statusCode?: unknown }).statusCode;
      }
    }
    
    console.error("[admin/sms] SMS 로그 조회 실패 - 상세 정보:", errorInfo);
  }

  // 테이블이 없는 경우 에러 메시지 표시 (에러가 있으면 먼저 처리)
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
      <div className="p-6 md:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS 발송 이력</h1>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <p className="text-sm font-medium text-yellow-800">
            SMS 로그 테이블이 아직 생성되지 않았습니다.
          </p>
          <p className="mt-2 text-xs text-yellow-700">
            데이터베이스 마이그레이션을 실행해주세요.
          </p>
          <p className="mt-1 text-xs text-yellow-600">
            sms_logs 테이블은 ERD 스키마에 정의되어 있습니다.
          </p>
          <p className="mt-1 text-xs text-yellow-600">
            Supabase CLI: <code className="bg-yellow-100 px-1 rounded">supabase migration up</code>
          </p>
        </div>
      </div>
    );
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

  // SMS 발송 폼용 학생 목록 조회 (모든 학생, 연락처 포함)
  // RLS 정책이 자동으로 tenant_id 필터링을 처리합니다
  let studentsSelectFields = "id, name, grade, class";
  
  // 학부모 연락처 컬럼 확인 (mother_phone, father_phone 사용)
  try {
    const testQuery = supabase.from("students").select("mother_phone, father_phone").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",mother_phone,father_phone";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }
  
  try {
    // is_active 컬럼이 있는지 테스트
    const testQuery = supabase.from("students").select("is_active").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",is_active";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

  const { data: studentsForSMS, error: studentsError } = await supabase
    .from("students")
    .select(studentsSelectFields)
    .order("name", { ascending: true });

  // student_profiles 테이블에서 phone 정보 조회 (학생 본인 연락처)
  const studentIds = (studentsForSMS ?? []).map((s: any) => s.id);
  let profiles: Array<{ id: string; phone?: string | null; mother_phone?: string | null; father_phone?: string | null }> = [];
  
  if (studentIds.length > 0) {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("student_profiles")
        .select("id, phone, mother_phone, father_phone")
        .in("id", studentIds);
      
      if (!profilesError && profilesData) {
        profiles = profilesData;
      }
    } catch (e) {
      // student_profiles 테이블이 없으면 무시
    }
  }

  // 프로필 정보를 학생 정보와 병합 (student_profiles 우선, 없으면 students 테이블 사용)
  const studentsWithPhones = (studentsForSMS ?? []).map((s: any) => {
    const profile = profiles.find((p: any) => p.id === s.id);
    return {
      ...s,
      phone: profile?.phone ?? null, // student_profiles 우선
      mother_phone: profile?.mother_phone ?? s.mother_phone ?? null,
      father_phone: profile?.father_phone ?? s.father_phone ?? null,
    };
  });

  // 에러 처리 및 디버깅
  if (studentsError) {
    // 에러 객체의 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: studentsError?.message || studentsError?.toString() || String(studentsError) || "알 수 없는 에러",
      code: studentsError?.code || "UNKNOWN",
    };
    
    if (studentsError && typeof studentsError === "object") {
      if ("details" in studentsError) {
        errorInfo.details = (studentsError as { details?: unknown }).details;
      }
      if ("hint" in studentsError) {
        errorInfo.hint = (studentsError as { hint?: unknown }).hint;
      }
      if ("statusCode" in studentsError) {
        errorInfo.statusCode = (studentsError as { statusCode?: unknown }).statusCode;
      }
    }
    
    console.error("[admin/sms] 학생 목록 조회 실패:", errorInfo);
  }

  // 디버깅: 학생 목록 조회 결과 확인
  if (process.env.NODE_ENV === "development") {
    const studentsWithAnyPhone = studentsWithPhones.filter(
      (s: any) => s.phone || s.mother_phone || s.father_phone
    );
    console.log("[admin/sms] 학생 목록 조회 결과:", {
      count: studentsWithPhones.length,
      withPhone: studentsWithAnyPhone.length,
      withoutPhone: studentsWithPhones.length - studentsWithAnyPhone.length,
      profilesCount: profiles.length,
      tenantId: tenantContext?.tenantId,
      hasError: !!studentsError,
      errorCode: studentsError?.code || null,
      sampleStudent: studentsWithPhones[0] ? {
        id: studentsWithPhones[0].id,
        name: studentsWithPhones[0].name,
        phone: studentsWithPhones[0].phone,
        mother_phone: studentsWithPhones[0].mother_phone,
        father_phone: studentsWithPhones[0].father_phone,
      } : null,
    });
  }

  // 학원명 조회
  let academyName = "학원";
  if (tenantContext?.tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantContext.tenantId)
      .single();
    if (tenant?.name) {
      academyName = tenant.name;
    }
  }

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

      {/* 학생 목록 조회 에러 안내 */}
      {studentsError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            학생 목록을 불러오는 중 오류가 발생했습니다.
          </p>
          <p className="mt-1 text-xs text-red-700">
            에러 코드: {studentsError.code || "알 수 없음"}
          </p>
          <p className="mt-1 text-xs text-red-600">
            {studentsError.message || "알 수 없는 오류"}
          </p>
          {studentsError.hint && (
            <p className="mt-1 text-xs text-red-600">힌트: {studentsError.hint}</p>
          )}
        </div>
      )}

      {/* 학생이 없는 경우 안내 */}
      {!studentsError && (!studentsForSMS || studentsForSMS.length === 0) && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            등록된 학생이 없습니다.
          </p>
          <p className="mt-1 text-xs text-yellow-700">
            학생 관리 페이지에서 학생을 등록한 후 SMS 발송을 이용할 수 있습니다.
          </p>
        </div>
      )}

      {/* SMS 발송 폼 - 항상 표시 */}
      <SMSSendForm
        students={studentsWithPhones.map((s: any) => ({
          id: s.id,
          name: s.name ?? null,
          grade: s.grade ?? null,
          class: s.class ?? null,
          phone: s.phone ?? null,
          mother_phone: s.mother_phone ?? null,
          father_phone: s.father_phone ?? null,
          is_active: s.is_active ?? null,
        }))}
        academyName={academyName}
      />

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

