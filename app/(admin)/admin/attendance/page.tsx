export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getAttendanceRecords } from "@/lib/domains/attendance/service";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import {
  AttendanceRecordFormWithStudentSelect,
} from "./_components/AttendanceRecordForm";
import { AttendanceList } from "./_components/AttendanceList";
import { AttendanceStatistics } from "./_components/AttendanceStatistics";
import { AttendanceFilters as AttendanceFiltersComponent } from "./_components/AttendanceFilters";
import type {
  AttendanceFilters,
  AttendanceRecord,
} from "@/lib/domains/attendance/types";
import { calculateAttendanceStats } from "@/lib/domains/attendance/service";

type StudentRow = {
  id: string;
  name?: string | null;
};

type AttendancePageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

async function AttendanceContent({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">기관 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // 필터 파라미터
  const studentIdFilter = searchParams.student_id?.trim() ?? "";
  const startDateFilter = searchParams.start_date?.trim() ?? "";
  const endDateFilter = searchParams.end_date?.trim() ?? "";
  const statusFilter = searchParams.status?.trim() ?? "";

  // 출석 기록 조회
  const filters: AttendanceFilters = {
    start_date: startDateFilter || undefined,
    end_date: endDateFilter || undefined,
    status: statusFilter
      ? (statusFilter as AttendanceFilters["status"])
      : undefined,
  };

  if (studentIdFilter) {
    filters.student_id = studentIdFilter;
  }

  let records: AttendanceRecord[] = [];
  try {
    records = await getAttendanceRecords(filters);
  } catch (error: any) {
    // 에러 객체 전체를 먼저 로깅
    console.error("[admin/attendance] 출석 기록 조회 실패 - 원본 에러:", error);
    console.error("[admin/attendance] 에러 타입:", typeof error);
    console.error("[admin/attendance] 에러 constructor:", error?.constructor?.name);
    
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
    
    console.error("[admin/attendance] 출석 기록 조회 실패 - 상세 정보:", errorInfo);
    
    // 테이블이 없는 경우 (PGRST205, 42P01 에러 또는 AppError로 변환된 경우)
    const errorCode = error?.code || errorInfo.code;
    const errorMessage = error?.message || errorInfo.message || "";
    if (
      errorCode === "PGRST205" ||
      errorCode === "42P01" ||
      errorCode === "NOT_FOUND" ||
      errorMessage.includes("Could not find the table") ||
      errorMessage.includes("테이블")
    ) {
      return (
        <div className="p-6 md:p-10">
          <div className="flex flex-col gap-6 md:gap-8">
            <PageHeader title="출석 관리" />
            <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
              <p className="text-sm font-medium text-yellow-800">
                출석 기록 테이블이 아직 생성되지 않았습니다.
              </p>
              <p className="text-xs text-yellow-700">
                데이터베이스 마이그레이션을 실행해주세요.
              </p>
              <p className="text-xs text-yellow-600">
                마이그레이션 파일: supabase/migrations/20250203000000_create_attendance_tables.sql
              </p>
              <p className="text-xs text-yellow-600">
                Supabase CLI: <code className="bg-yellow-100 px-1 rounded">supabase migration up</code>
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // 학생 정보 조회
  const studentIds = [
    ...new Set(records.map((r) => r.student_id).filter(Boolean)),
  ];
  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .in("id", studentIds.length > 0 ? studentIds : [""]);

  const studentMap = new Map(
    (students ?? []).map((s: StudentRow) => [s.id, s.name ?? "이름 없음"])
  );

  // 전체 통계 계산 (필터링된 기록 기준)
  let overallStats = {
    total_days: 0,
    present_count: 0,
    absent_count: 0,
    late_count: 0,
    early_leave_count: 0,
    excused_count: 0,
    attendance_rate: 0,
    late_rate: 0,
    absent_rate: 0,
  };

  if (records.length > 0) {
    const totalDays = records.length;
    const presentCount = records.filter((r) => r.status === "present").length;
    const absentCount = records.filter((r) => r.status === "absent").length;
    const lateCount = records.filter((r) => r.status === "late").length;
    const earlyLeaveCount = records.filter(
      (r) => r.status === "early_leave"
    ).length;
    const excusedCount = records.filter((r) => r.status === "excused").length;

    overallStats = {
      total_days: totalDays,
      present_count: presentCount,
      absent_count: absentCount,
      late_count: lateCount,
      early_leave_count: earlyLeaveCount,
      excused_count: excusedCount,
      attendance_rate: totalDays > 0 ? (presentCount / totalDays) * 100 : 0,
      late_rate: totalDays > 0 ? (lateCount / totalDays) * 100 : 0,
      absent_rate: totalDays > 0 ? (absentCount / totalDays) * 100 : 0,
    };
  }

  // 학생 목록 조회 (출석 기록 입력 폼용)
  const { data: allStudents } = await supabase
    .from("students")
    .select("id,name")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(100);

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="출석 관리" />

        <div className="grid gap-6 md:grid-cols-2">
          {/* 출석 기록 입력 폼 */}
          <Card>
            <CardHeader title="출석 기록 입력" />
            <CardContent>
              {allStudents && allStudents.length > 0 ? (
                <AttendanceRecordFormWithStudentSelect
                  students={allStudents}
                />
              ) : (
                <p className="text-sm text-gray-500">등록된 학생이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          {/* 출석 통계 */}
          <Card>
            <CardHeader title="전체 통계" />
            <CardContent>
              <AttendanceStatistics statistics={overallStats} />
            </CardContent>
          </Card>
        </div>

        {/* 필터 */}
        <AttendanceFiltersComponent
          startDateFilter={startDateFilter}
          endDateFilter={endDateFilter}
          statusFilter={statusFilter}
        />

        {/* 출석 기록 목록 */}
        {records.length === 0 ? (
          <EmptyState
            title="출석 기록이 없습니다"
            description="아직 등록된 출석 기록이 없습니다."
          />
        ) : (
          <AttendanceList records={records} studentMap={studentMap} />
        )}
      </div>
    </div>
  );
}

export default async function AdminAttendancePage({
  searchParams,
}: AttendancePageProps) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="p-6 md:p-10">
          <div className="flex flex-col gap-6 md:gap-8">
            <PageHeader title="출석 관리" />
            <SuspenseFallback />
          </div>
        </div>
      }
    >
      <AttendanceContent searchParams={params} />
    </Suspense>
  );
}

