export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/molecules/EmptyState";

type ConsultingNoteRow = {
  id: string;
  student_id?: string | null;
  consultant_id?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type StudentRow = {
  id: string;
  name?: string | null;
};

export default async function AdminConsultingPage({
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
  const studentIdFilter = params.student_id?.trim() ?? "";

  // 상담노트 조회
  const selectNotes = () =>
    supabase
      .from("student_consulting_notes")
      .select("id,student_id,consultant_id,note,created_at")
      .order("created_at", { ascending: false });

  let query = selectNotes();

  // 본인이 작성한 노트만 조회 (admin은 모든 노트 조회 가능)
  if (role !== "admin") {
    query = query.eq("consultant_id", userId);
  }

  if (studentIdFilter) {
    query = query.eq("student_id", studentIdFilter);
  }

  let { data: notes, error } = await query.limit(100);

  if (error && error.code === "42703") {
    ({ data: notes, error } = await selectNotes().limit(100));
  }

  if (error) {
    console.error("[admin/consulting] 상담노트 조회 실패", error);
  }

  const noteRows = (notes as ConsultingNoteRow[] | null) ?? [];

  // 학생 정보 조회
  const studentIds = [...new Set(noteRows.map((n) => n.student_id).filter(Boolean))] as string[];
  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .in("id", studentIds.length > 0 ? studentIds : [""]);

  const studentMap = new Map(
    (students ?? []).map((s: StudentRow) => [s.id, s.name ?? "이름 없음"])
  );

  // 검색 필터링 (학생 이름으로 - 통합 검색 함수 사용)
  let filteredNotes = noteRows;
  if (searchQuery) {
    // 통합 검색 함수로 학생 검색
    const { searchStudentsUnified } = await import("@/lib/data/studentSearch");
    const { getTenantContext } = await import("@/lib/tenant/getTenantContext");
    const tenantContext = await getTenantContext();
    
    const searchResult = await searchStudentsUnified({
      query: searchQuery,
      filters: {
        isActive: true,
      },
      limit: 1000,
      role: "admin",
      tenantId: tenantContext?.tenantId ?? null,
    });

    const searchedStudentIds = new Set(searchResult.students.map((s) => s.id));

    // 검색된 학생 ID와 노트 내용으로 필터링
    filteredNotes = noteRows.filter((note) => {
      const studentName = studentMap.get(note.student_id ?? "") ?? "";
      const matchesStudent = searchedStudentIds.has(note.student_id ?? "");
      const matchesNote = (note.note ?? "").includes(searchQuery);
      return matchesStudent || matchesNote;
    });
  }

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">상담 노트</h1>
      </div>

      {/* 검색 바 */}
      <div>
        <form method="get" className="flex flex-col gap-4 md:flex-row">
          <input
            type="text"
            name="search"
            placeholder="학생 이름 또는 상담 내용으로 검색..."
            defaultValue={searchQuery}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          {searchQuery && (
            <Link
              href="/admin/consulting"
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      {/* 상담노트 목록 */}
      {filteredNotes.length === 0 ? (
        <EmptyState
          title="상담노트가 없습니다"
          description="아직 작성된 상담노트가 없습니다."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredNotes.map((note) => {
            const studentName = studentMap.get(note.student_id ?? "") ?? "이름 없음";
            return (
              <Link
                key={note.id}
                href={`/admin/students/${note.student_id}`}
                className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{studentName}</span>
                    <span className="text-xs text-gray-500">
                      {note.created_at
                        ? new Date(note.created_at).toLocaleString("ko-KR")
                        : "-"}
                    </span>
                  </div>
                </div>
                <p className="line-clamp-3 text-sm text-gray-700">{note.note ?? ""}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

