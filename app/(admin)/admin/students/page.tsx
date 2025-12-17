export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getWeeklyStudyTimeSummary } from "@/lib/reports/weekly";
import { getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getStudentsStatsBatch } from "@/lib/data/studentStats";
import { StudentActions } from "./_components/StudentActions";
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


// 학생별 이번주 학습시간 조회
async function getStudentWeeklyStudyTime(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: sessions, error } = await supabase
      .from("student_study_sessions")
      .select("duration_seconds")
      .eq("student_id", studentId)
      .gte("started_at", weekStartStr)
      .lte("started_at", weekEndStr);

    if (error && error.code === "42703") {
      return 0;
    }

    if (error) throw error;

    const totalSeconds = (sessions ?? []).reduce(
      (sum: number, s: { duration_seconds?: number | null }) =>
        sum + (s.duration_seconds ?? 0),
      0
    );

    return Math.floor(totalSeconds / 60); // 분 단위로 반환
  } catch (error) {
    console.error(`[admin/students] 학습시간 조회 실패 (${studentId})`, error);
    return 0;
  }
}

// 학생별 이번주 플랜 실행률 조회
async function getStudentWeeklyPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("completed_amount")
      .eq("student_id", studentId)
      .gte("plan_date", weekStartStr)
      .lte("plan_date", weekEndStr);

    if (error && error.code === "42703") {
      return 0;
    }

    if (error) throw error;

    const planRows = plans ?? [];
    if (planRows.length === 0) return 0;

    const completed = planRows.filter(
      (p: { completed_amount?: number | null }) =>
        p.completed_amount !== null &&
        p.completed_amount !== undefined &&
        p.completed_amount > 0
    ).length;

    return Math.round((completed / planRows.length) * 100);
  } catch (error) {
    console.error(
      `[admin/students] 플랜 실행률 조회 실패 (${studentId})`,
      error
    );
    return 0;
  }
}

// 학생별 최근 학습일 조회
async function getStudentLastActivity(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<string | null> {
  try {
    const { data: session, error } = await supabase
      .from("student_study_sessions")
      .select("started_at")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code === "42703") {
      return null;
    }

    if (error) throw error;

    return session?.started_at ?? null;
  } catch (error) {
    console.error(
      `[admin/students] 최근 학습일 조회 실패 (${studentId})`,
      error
    );
    return null;
  }
}

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
  const sortBy = params.sort || "name"; // name, created_at, grade
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  // 학생 목록 조회 (페이지네이션)
  // is_active 컬럼이 없을 수 있으므로 안전하게 처리
  let selectFields = "id,name,grade,class,created_at";
  try {
    // is_active 컬럼이 있는지 테스트
    const testQuery = supabase.from("students").select("is_active").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      selectFields += ",is_active";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

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

  // is_active 필터링 (컬럼이 있을 때만)
  if (selectFields.includes("is_active") && !showInactiveFilter) {
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
    // 에러가 있어도 빈 배열로 처리하여 페이지가 계속 작동하도록
  }

  const studentRows = (students as StudentRow[] | null) ?? [];

  // 성적 입력 여부 필터링
  let filteredStudents = studentRows;
  if (hasScoreFilter) {
    // 성적이 있는 학생만 필터링 (두 테이블에서 각각 조회 후 합치기)
    // ⚠️ student_school_scores는 student_internal_scores로 변경되었습니다.
    const [schoolScores, mockScores] = await Promise.all([
      supabase.from("student_internal_scores").select("student_id"),
      supabase.from("student_mock_scores").select("student_id"),
    ]);

    const studentIdsWithScores = new Set<string>();
    (schoolScores.data ?? []).forEach((s: { student_id?: string }) => {
      if (s.student_id) studentIdsWithScores.add(s.student_id);
    });
    (mockScores.data ?? []).forEach((s: { student_id?: string }) => {
      if (s.student_id) studentIdsWithScores.add(s.student_id);
    });

    filteredStudents = studentRows.filter((s) =>
      studentIdsWithScores.has(s.id)
    );
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
        <div className="flex flex-col gap-4">
          <form
            method="get"
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            {/* 검색 */}
            <div className="flex flex-col gap-1 flex-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                이름 검색
              </label>
              <input
                type="text"
                name="search"
                placeholder="이름으로 검색..."
                defaultValue={searchQuery}
                className={cn(
                  "w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                  borderInput,
                  bgSurface,
                  textPrimary,
                  "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                )}
              />
            </div>

            {/* 학년 필터 */}
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                학년
              </label>
              <input
                type="text"
                name="grade"
                placeholder="전체"
                defaultValue={gradeFilter}
                className={cn(
                  "w-24 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                  borderInput,
                  bgSurface,
                  textPrimary,
                  "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                )}
              />
            </div>

            {/* 반 필터 */}
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                반
              </label>
              <input
                type="text"
                name="class"
                placeholder="전체"
                defaultValue={classFilter}
                className={cn(
                  "w-24 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                  borderInput,
                  bgSurface,
                  textPrimary,
                  "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                )}
              />
            </div>

          {/* 성적 입력 여부 필터 */}
          <div className="flex items-end">
            <label className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 transition",
              borderInput,
              bgSurface,
              bgHover
            )}>
              <input
                type="checkbox"
                name="has_score"
                value="true"
                defaultChecked={hasScoreFilter}
                className={cn("rounded text-indigo-600 focus:ring-indigo-500", borderInput)}
              />
              <span className={cn("text-sm", textSecondary)}>성적 입력 학생만</span>
            </label>
          </div>

          {/* 비활성화 학생 표시 필터 */}
          <div className="flex items-end">
            <label className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 transition",
              borderInput,
              bgSurface,
              bgHover
            )}>
              <input
                type="checkbox"
                name="show_inactive"
                value="true"
                defaultChecked={showInactiveFilter}
                className={cn("rounded text-indigo-600 focus:ring-indigo-500", borderInput)}
              />
              <span className={cn("text-sm", textSecondary)}>비활성화 포함</span>
            </label>
          </div>

          {/* 정렬 */}
          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              정렬
            </label>
            <select
              name="sort"
              defaultValue={sortBy}
              className={cn(
                "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                borderInput,
                bgSurface,
                textPrimary,
                "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              )}
            >
              <option value="name">이름순</option>
              <option value="created_at">최근 생성일</option>
              <option value="grade">학년순</option>
            </select>
          </div>

          {/* 검색 버튼 */}
          <button
            type="submit"
            className={cn("rounded-lg px-6 py-2 text-sm font-semibold text-white transition", inlineButtonPrimary())}
          >
            검색
          </button>

          {/* 초기화 */}
          {(searchQuery ||
            gradeFilter ||
            hasScoreFilter ||
            showInactiveFilter ||
            sortBy !== "name") && (
            <Link
              href="/admin/students"
              className={cn(
                "rounded-lg border px-6 py-2 text-sm font-semibold transition",
                borderInput,
                bgSurface,
                textSecondary,
                bgHover
              )}
            >
              초기화
            </Link>
          )}
        </form>
      </div>

        {/* 학생 리스트 */}
        {studentsWithStats.length === 0 ? (
          <EmptyState
            title="등록된 학생이 없습니다"
            description="아직 등록된 학생이 없습니다."
          />
        ) : (
          <div className={cn("overflow-x-auto rounded-lg shadow-sm", tableContainer)}>
          <table className="w-full">
            <thead className={cn(getGrayBgClasses("tableHeader"))}>
              <tr>
                <th className={tableHeaderBase}>이름</th>
                <th className={tableHeaderBase}>학년</th>
                <th className={tableHeaderBase}>반</th>
                <th className={tableHeaderBase}>이번주 학습시간</th>
                <th className={tableHeaderBase}>이번주 플랜 실행률</th>
                <th className={tableHeaderBase}>최근 학습일</th>
                <th className={tableHeaderBase}>성적 입력</th>
                <th className={tableHeaderBase}>상태</th>
                <th className={tableHeaderBase}>작업</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", "divide-gray-200 dark:divide-gray-700", bgSurface)}>
              {studentsWithStats.map((student) => (
                <tr key={student.id} className={tableRowBase}>
                  <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                    {student.name ?? "이름 없음"}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.grade ?? "-"}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.class ?? "-"}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.studyTimeMinutes}분
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={student.planCompletionRate}
                        max={100}
                        color="indigo"
                        height="sm"
                        className="w-24"
                      />
                      <span>{student.planCompletionRate}%</span>
                    </div>
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.lastActivity
                      ? new Date(student.lastActivity).toLocaleDateString(
                          "ko-KR"
                        )
                      : "-"}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.hasScore ? (
                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", getStatusBadgeColorClasses("success"))}>
                        입력됨
                      </span>
                    ) : (
                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", bgStyles.gray, textTertiary)}>
                        미입력
                      </span>
                    )}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    {student.is_active === false ? (
                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", getStatusBadgeColorClasses("error"))}>
                        비활성화
                      </span>
                    ) : (
                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", getStatusBadgeColorClasses("active"))}>
                        활성
                      </span>
                    )}
                  </td>
                  <td className={cn(tableCellBase, textMuted)}>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/students/${student.id}`}
                        className={getIndigoTextClasses("link")}
                      >
                        상세 보기
                      </Link>
                      <StudentActions
                        studentId={student.id}
                        studentName={student.name ?? "이름 없음"}
                        isActive={student.is_active !== false}
                        isAdmin={role === "admin"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/admin/students?${new URLSearchParams({
                  ...params,
                  page: String(page - 1),
                }).toString()}`}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition",
                  borderInput,
                  bgSurface,
                  textSecondary,
                  bgHover
                )}
              >
                이전
              </Link>
            )}
            <span className={cn("text-sm", textSecondary)}>
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/admin/students?${new URLSearchParams({
                  ...params,
                  page: String(page + 1),
                }).toString()}`}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition",
                  borderInput,
                  bgSurface,
                  textSecondary,
                  bgHover
                )}
              >
                다음
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
