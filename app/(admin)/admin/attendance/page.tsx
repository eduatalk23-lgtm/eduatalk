
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import {
  AttendanceRecordFormWithStudentSelect,
} from "./_components/AttendanceRecordForm";
import { AttendanceListClient } from "./_components/AttendanceListClient";
import { AttendanceStatistics } from "./_components/AttendanceStatistics";
import { AttendanceSearchFilter } from "./_components/AttendanceSearchFilter";
import { AttendancePagination } from "./_components/AttendancePagination";
import { findAttendanceRecordsWithPagination } from "@/lib/domains/attendance/repository";
import type {
  AttendanceFilters,
  AttendanceStatus,
  CheckMethod,
} from "@/lib/domains/attendance/types";
import { ATTENDANCE_LIST_PAGE_SIZE, type AttendanceSortOption } from "@/lib/constants/attendance";
import { logError } from "@/lib/errors";

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
  const studentNameFilter = searchParams.student_name?.trim() ?? "";
  const startDateFilter = searchParams.start_date?.trim() ?? "";
  const endDateFilter = searchParams.end_date?.trim() ?? "";
  const statusFilter = searchParams.status?.trim() as AttendanceStatus | undefined;
  const checkInMethodFilter = searchParams.check_in_method?.trim() as CheckMethod | undefined;
  const checkOutMethodFilter = searchParams.check_out_method?.trim() as CheckMethod | undefined;
  const sortBy: AttendanceSortOption = (searchParams.sort as AttendanceSortOption) || "date";
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = ATTENDANCE_LIST_PAGE_SIZE;

  // 출석 기록 조회 (페이지네이션 적용)
  const filters: AttendanceFilters = {
    start_date: startDateFilter || undefined,
    end_date: endDateFilter || undefined,
    status: statusFilter,
    check_in_method: checkInMethodFilter,
    check_out_method: checkOutMethodFilter,
  };

  // 학생명으로 필터링 (통합 검색 함수 사용)
  let studentIdsForFilter: string[] = [];
  if (studentNameFilter) {
    const { searchStudentsUnified } = await import("@/lib/data/studentSearch");
    const searchResult = await searchStudentsUnified({
      query: studentNameFilter,
      filters: {
        isActive: true,
      },
      limit: 1000, // 충분히 큰 범위로 조회
      role: "admin",
      tenantId: tenantContext.tenantId,
    });
    studentIdsForFilter = searchResult.students.map((s) => s.id);

    if (studentIdsForFilter.length > 0) {
      // 여러 학생 ID로 필터링
      filters.student_ids = studentIdsForFilter;
    } else {
      // 학생이 없으면 빈 결과 반환
      filters.student_ids = ["00000000-0000-0000-0000-000000000000"]; // 존재하지 않는 ID
    }
  }

  let paginationResult;
  try {
    paginationResult = await findAttendanceRecordsWithPagination(
      filters,
      {
        page,
        pageSize,
        sortBy,
        sortOrder: "desc",
      },
      tenantContext.tenantId
    );
  } catch (error: unknown) {
    // 에러 처리 유틸리티 사용
    const { handleSupabaseError, extractErrorDetails } = await import("@/lib/utils/errorHandling");
    const errorMessage = handleSupabaseError(error);
    const errorDetails = extractErrorDetails(error);
    
    // Supabase 에러 객체의 주요 속성 추출
    const errorInfo: Record<string, unknown> = {
      message: errorMessage,
      code: errorDetails.code || "UNKNOWN",
      name: errorDetails.code,
      stack: errorDetails.details,
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
    
    // 구조화된 로깅 사용
    logError(error, {
      context: "[admin/attendance]",
      operation: "출석 기록 조회",
      errorInfo,
      filters,
      tenantId: tenantContext.tenantId,
    });
    
    // 테이블이 없는 경우 (PGRST205, 42P01 에러 또는 AppError로 변환된 경우)
    const errorCode = (error && typeof error === "object" && "code" in error 
      ? (error as { code?: string }).code 
      : null) || (errorInfo.code as string | undefined) || "";
    const errorMessageForCheck = (error && typeof error === "object" && "message" in error
      ? (error as { message?: string }).message
      : null) || (errorInfo.message as string | undefined) || "";
    if (
      errorCode === "PGRST205" ||
      errorCode === "42P01" ||
      errorCode === "NOT_FOUND" ||
      errorMessageForCheck.includes("Could not find the table") ||
      errorMessageForCheck.includes("테이블")
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

  const records = paginationResult?.records ?? [];
  const totalPages = paginationResult?.totalPages ?? 1;

  // 전체 통계 계산 (필터링된 전체 데이터 기준)
  // 필터 기반 통계 계산 함수 사용
  const { calculateAttendanceStatsWithFilters } = await import(
    "@/lib/domains/attendance/service"
  );
  const overallStats = await calculateAttendanceStatsWithFilters(
    filters,
    tenantContext.tenantId
  );

  // 학생 목록 조회 (출석 기록 입력 폼용)
  // 학생 검색 제한 제거: 충분히 큰 범위로 조회
  const { data: allStudents } = await supabase
    .from("students")
    .select("id,name")
    .eq("tenant_id", tenantContext.tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .range(0, 999); // 1000명까지 조회 가능

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
                  tenantId={tenantContext.tenantId}
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
        <AttendanceSearchFilter
          studentNameFilter={studentNameFilter}
          startDateFilter={startDateFilter}
          endDateFilter={endDateFilter}
          statusFilter={statusFilter}
          checkInMethodFilter={checkInMethodFilter}
          checkOutMethodFilter={checkOutMethodFilter}
          sortBy={sortBy}
        />

        {/* 출석 기록 목록 */}
        {records.length === 0 ? (
          <EmptyState
            title="출석 기록이 없습니다"
            description="아직 등록된 출석 기록이 없습니다."
          />
        ) : (
          <>
            <AttendanceListClient records={records} />
            <AttendancePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={paginationResult?.total ?? 0}
              pageSize={pageSize}
              searchParams={searchParams}
            />
          </>
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

