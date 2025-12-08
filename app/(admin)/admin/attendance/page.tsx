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
import {
  AttendanceRecordFormWithStudentSelect,
} from "./_components/AttendanceRecordForm";
import { AttendanceList } from "./_components/AttendanceList";
import { AttendanceStatistics } from "./_components/AttendanceStatistics";
import type { AttendanceFilters } from "@/lib/domains/attendance/types";
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

  const records = await getAttendanceRecords(filters);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">출석 관리</h1>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
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
      <div className="mb-6">
        <form method="get" className="flex flex-col gap-4 md:flex-row">
          <input
            type="date"
            name="start_date"
            placeholder="시작 날짜"
            defaultValue={startDateFilter}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <input
            type="date"
            name="end_date"
            placeholder="종료 날짜"
            defaultValue={endDateFilter}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">전체 상태</option>
            <option value="present">출석</option>
            <option value="absent">결석</option>
            <option value="late">지각</option>
            <option value="early_leave">조퇴</option>
            <option value="excused">공결</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          {(startDateFilter || endDateFilter || statusFilter) && (
            <a
              href="/admin/attendance"
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </a>
          )}
        </form>
      </div>

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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">출석 관리</h1>
          </div>
          <div className="text-sm text-gray-500">로딩 중...</div>
        </div>
      }
    >
      <AttendanceContent searchParams={params} />
    </Suspense>
  );
}

