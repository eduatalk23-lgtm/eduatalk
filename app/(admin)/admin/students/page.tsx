export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getStudentsHasScore } from "@/lib/data/studentStats";
import { STUDENT_LIST_PAGE_SIZE, STUDENT_SORT_OPTIONS, type StudentSortOption, type StudentDivision } from "@/lib/constants/students";
import { StudentSearchFilter } from "./_components/StudentSearchFilter";
import { StudentListClient } from "./_components/StudentListClient";
import { StudentPagination } from "./_components/StudentPagination";
import { PageHeader } from "@/components/layout/PageHeader";
import { getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";
import { getStudentSchoolsBatch } from "@/lib/data/studentSchools";
import { CreateStudentButton } from "./_components/CreateStudentButton";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type StudentRow = {
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  school_id?: string | null;
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  division?: StudentDivision | null;
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
  const divisionFilter = params.division?.trim() as StudentDivision | undefined;
  const hasScoreFilter = params.has_score === "true";
  const showInactiveFilter = params.show_inactive === "true";
  const sortBy: StudentSortOption = (params.sort as StudentSortOption) || "name";
  const page = parseInt(params.page || "1", 10);
  const pageSize = STUDENT_LIST_PAGE_SIZE;

  // 학생 목록 조회 (페이지네이션) - division 필드 포함
  const selectFields = "id,name,grade,class,school_id,school_type,division,created_at,is_active";

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

  // division 필터링
  if (divisionFilter) {
    query = query.eq("division", divisionFilter);
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

  // 배치 쿼리로 학교 정보 및 연락처 정보 일괄 조회 (N+1 문제 해결)
  const studentIds = filteredStudents.map((s) => s.id);
  
  // 병렬로 데이터 페칭
  const [phoneDataList, schoolMap] = await Promise.all([
    getStudentPhonesBatch(studentIds),
    getStudentSchoolsBatch(supabase, filteredStudents),
  ]);

  // 연락처 데이터를 Map으로 변환
  const phoneDataMap = new Map(
    phoneDataList.map((p) => [p.id, p])
  );

  // 데이터를 학생 정보와 결합
  const studentsWithData = filteredStudents.map((student) => {
    const phoneData = phoneDataMap.get(student.id);
    const schoolName = schoolMap.get(student.id) ?? "-";
    
    return {
      id: student.id,
      name: student.name,
      grade: student.grade ? String(student.grade) : null,
      class: student.class,
      division: student.division ?? null,
      schoolName,
      phone: phoneData?.phone ?? null,
      mother_phone: phoneData?.mother_phone ?? null,
      father_phone: phoneData?.father_phone ?? null,
      is_active: student.is_active,
    };
  });

  const totalPages = count ? Math.ceil(count / pageSize) : 1;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <PageHeader title="학생 관리" />
          <CreateStudentButton />
        </div>

        {/* 검색 및 필터 바 */}
        <StudentSearchFilter
          searchQuery={searchQuery}
          gradeFilter={gradeFilter}
          classFilter={classFilter}
          divisionFilter={divisionFilter}
          hasScoreFilter={hasScoreFilter}
          showInactiveFilter={showInactiveFilter}
          sortBy={sortBy}
        />

        {/* 학생 리스트 */}
        {studentsWithData.length === 0 ? (
          <EmptyState
            title="등록된 학생이 없습니다"
            description="아직 등록된 학생이 없습니다."
          />
        ) : (
          <StudentListClient
            students={studentsWithData}
            isAdmin={role === "admin"}
          />
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
