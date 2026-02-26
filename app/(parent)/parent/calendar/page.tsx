import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { fetchCalendarPageDataAsAdmin } from "./_lib/fetchCalendarPageDataAsAdmin";
import { ParentCalendarWrapper } from "./_components/ParentCalendarWrapper";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

/**
 * 학부모 캘린더 페이지 (조회 전용)
 *
 * URL: /parent/calendar
 * - ?studentId={id} → 해당 자녀의 캘린더 조회
 * - studentId 없음 → 첫 번째 자녀의 캘린더 표시
 *
 * 학부모는 캘린더를 생성/수정하지 않고 조회만 합니다.
 * canAccessStudent()로 권한 검증 후, admin client(RLS 바이패스)로 데이터를 조회합니다.
 * 이는 calendars/calendar_events 테이블의 RLS가 학부모 역할을 지원하지 않기 때문입니다.
 */
export default async function ParentCalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회 (parent_student_links는 RLS 비활성 → 정상 동작)
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <ParentCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
        linkedStudents={[]}
        emptyReason="no_children"
      />
    );
  }

  // 선택된 학생 ID (쿼리 파라미터 또는 첫 번째 학생)
  const selectedStudentId = params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    return (
      <ParentCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
        linkedStudents={linkedStudents}
        emptyReason="not_found"
      />
    );
  }

  // 접근 권한 확인 (parent_student_links 기반)
  const hasAccess = await canAccessStudent(supabase, userId, selectedStudentId);

  if (!hasAccess) {
    return (
      <ParentCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
        linkedStudents={linkedStudents}
        selectedStudentId={selectedStudentId}
        emptyReason="no_access"
      />
    );
  }

  // Admin client로 학생/캘린더 데이터 조회 (RLS 바이패스)
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return (
      <ParentCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
        linkedStudents={linkedStudents}
        selectedStudentId={selectedStudentId}
        emptyReason="not_found"
      />
    );
  }

  // 학생 정보 조회
  const { data: student } = await adminClient
    .from("students")
    .select("id, name, tenant_id")
    .eq("id", selectedStudentId)
    .single();

  if (!student) {
    return (
      <ParentCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
        linkedStudents={linkedStudents}
        selectedStudentId={selectedStudentId}
        emptyReason="not_found"
      />
    );
  }

  // Primary 캘린더 조회 (생성하지 않음 — admin client로 RLS 바이패스)
  const { data: calendarData } = await adminClient
    .from("calendars")
    .select("id")
    .eq("owner_id", student.id)
    .eq("is_student_primary", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  const calendarId = calendarData?.[0]?.id ?? null;

  if (!calendarId) {
    return (
      <ParentCalendarWrapper
        studentId={student.id}
        studentName={student.name}
        tenantId={student.tenant_id}
        calendarId={null}
        pageData={null}
        linkedStudents={linkedStudents}
        selectedStudentId={selectedStudentId}
        emptyReason="no_calendar"
      />
    );
  }

  // 캘린더 데이터 로드 (admin client 사용)
  const pageData = await fetchCalendarPageDataAsAdmin(
    adminClient,
    student.id,
    calendarId,
    params.date
  );

  return (
    <ParentCalendarWrapper
      studentId={student.id}
      studentName={student.name}
      tenantId={student.tenant_id}
      calendarId={calendarId}
      pageData={pageData}
      linkedStudents={linkedStudents}
      selectedStudentId={selectedStudentId}
    />
  );
}
