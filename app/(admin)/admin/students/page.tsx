export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getWeeklyStudyTimeSummary } from "@/lib/reports/weekly";
import { getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getStudentsStatsBatch, getStudentsHasScore } from "@/lib/data/studentStats";
import { STUDENT_LIST_PAGE_SIZE, STUDENT_SORT_OPTIONS, type StudentSortOption } from "@/lib/constants/students";
import { StudentActions } from "./_components/StudentActions";
import { StudentSearchFilter } from "./_components/StudentSearchFilter";
import { StudentTable } from "./_components/StudentTable";
import { StudentPagination } from "./_components/StudentPagination";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { getWeekRange } from "@/lib/date/weekRange";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  bgPage,
  bgHover,
  textPrimary,
  textSecondary,
  textMuted,
  textTertiary,
  borderDefault,
  borderInput,
  tableHeaderBase,
  tableCellBase,
  tableContainer,
  tableRowBase,
  inlineButtonPrimary,
  getGrayBgClasses,
  getStatusBadgeColorClasses,
  getIndigoTextClasses,
  bgStyles,
  divideDefaultVar,
} from "@/lib/utils/darkMode";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type StudentRow = {
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

export default async function AdminStudentsPage({
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
  const gradeFilter = params.grade?.trim() ?? "";
  const classFilter = params.class?.trim() ?? "";
  const hasScoreFilter = params.has_score === "true";
  const showInactiveFilter = params.show_inactive === "true";
  const sortBy: StudentSortOption = (params.sort as StudentSortOption) || "name";
  const page = parseInt(params.page || "1", 10);
  const pageSize = STUDENT_LIST_PAGE_SIZE;

  // 학생 목록 조회 (페이지네이션)
  const selectFields = "id,name,grade,class,created_at,is_active";

  const selectStudents = () =>
    supabase
      .from("students")
      .select(selectFields, { count: "exact" })
      .order(
        sortBy === "created_at"
          ? "created_at"
          : sortBy === "grade"
          ? "grade"
          : "name",
        {
          ascending: sortBy === "created_at" ? false : true,
        }
      );

  let query = selectStudents();

  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`);
  }

  if (gradeFilter) {
    query = query.eq("grade", gradeFilter);
  }

  if (classFilter) {
    query = query.eq("class", classFilter);
  }

  // is_active 필터링
  if (!showInactiveFilter) {
    query = query.eq("is_active", true);
  }

  // 페이지네이션 적용
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  let { data: students, error, count } = await query;

  if (error) {
    console.error("[admin/students] 학생 목록 조회 실패", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    
    // 에러 발생 시 사용자에게 알림 표시
    return (
      <div className="p-6 md:p-10">
        <div className="flex flex-col gap-6">
          <PageHeader title="학생 관리" />
          <ErrorState
            title="학생 목록을 불러올 수 없습니다"
            message="학생 목록을 조회하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            actionHref="/admin/students"
            actionLabel="새로고침"
          />
        </div>
      </div>
    );
  }

  const studentRows = (students as StudentRow[] | null) ?? [];

  // 성적 입력 여부 필터링
  let filteredStudents = studentRows;
  if (hasScoreFilter) {
    // 성적이 있는 학생만 필터링 (페이지네이션된 학생 ID만 조회하여 최적화)
    const studentIds = studentRows.map((s) => s.id);
    const hasScoreSet = await getStudentsHasScore(supabase, studentIds);
    filteredStudents = studentRows.filter((s) => hasScoreSet.has(s.id));
  }

  // 이번 주 날짜 범위
  const { weekStart, weekEnd } = getWeekRange();

  // 배치 쿼리로 모든 학생 통계를 한 번에 조회 (N+1 문제 해결)
  const studentIds = filteredStudents.map((s) => s.id);
  const statsMap = await getStudentsStatsBatch(
    supabase,
    studentIds,
    weekStart,
    weekEnd
  );

  // 통계 데이터를 학생 정보와 결합
  const studentsWithStats = filteredStudents.map((student) => {
    const stats = statsMap.get(student.id);
    return {
      ...student,
      studyTimeMinutes: stats?.studyTimeMinutes ?? 0,
      planCompletionRate: stats?.planCompletionRate ?? 0,
      lastActivity: stats?.lastActivity ?? null,
      hasScore: stats?.hasScore ?? false,
    };
  });

  const totalPages = count ? Math.ceil(count / pageSize) : 1;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader title="학생 관리" />

        {/* 검색 및 필터 바 */}
        <StudentSearchFilter
          searchQuery={searchQuery}
          gradeFilter={gradeFilter}
          classFilter={classFilter}
          hasScoreFilter={hasScoreFilter}
          showInactiveFilter={showInactiveFilter}
          sortBy={sortBy}
        />

        {/* 학생 리스트 */}
        {studentsWithStats.length === 0 ? (
          <EmptyState
            title="등록된 학생이 없습니다"
            description="아직 등록된 학생이 없습니다."
          />
        ) : (
          <StudentTable students={studentsWithStats} isAdmin={role === "admin"} />
        )}

        {/* 페이지네이션 */}
        <StudentPagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={params}
        />
      </div>
    </div>
  );
}
