import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { searchMasterBooks } from "@/lib/data/contentMasters";
import { MasterBookFilters } from "@/lib/data/contentMasters";

export default async function MasterBooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { role } = await getCurrentUserRole();

  const supabase = await createSupabaseServerClient();

  // 검색 필터 구성
  const filters: MasterBookFilters = {
    subject: params.subject,
    subject_category: params.subject_category,
    semester: params.semester,
    revision: params.revision,
    search: params.search,
    limit: 50,
  };

  const { data: books, total } = await searchMasterBooks(filters);

  // 필터 옵션 조회 (드롭다운용)
  const [subjects, semesters, revisions] = await Promise.all([
    supabase
      .from("master_books")
      .select("subject")
      .not("subject", "is", null)
      .then((res) => {
        const unique = new Set(
          (res.data || []).map((item) => item.subject).filter(Boolean)
        );
        return Array.from(unique).sort();
      }),
    supabase
      .from("master_books")
      .select("semester")
      .not("semester", "is", null)
      .then((res) => {
        const unique = new Set(
          (res.data || []).map((item) => item.semester).filter(Boolean)
        );
        return Array.from(unique).sort();
      }),
    supabase
      .from("master_books")
      .select("revision")
      .not("revision", "is", null)
      .then((res) => {
        const unique = new Set(
          (res.data || []).map((item) => item.revision).filter(Boolean)
        );
        return Array.from(unique).sort();
      }),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">교재 목록</h1>
            <p className="text-sm text-gray-500">
              서비스에서 제공하는 교재를 검색하고 확인하세요.
            </p>
          </div>
          {(role === "admin" || role === "consultant") && (
            <Link
              href="/admin/master-books/new"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + 교재 등록
            </Link>
          )}
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <form
            action="/admin/master-books"
            method="get"
            className="flex flex-wrap items-end gap-4"
          >
            {/* 개정교육과정 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                개정교육과정
              </label>
              <select
                name="revision"
                defaultValue={params.revision || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {revisions.map((rev) => (
                  <option key={rev} value={rev}>
                    {rev}
                  </option>
                ))}
              </select>
            </div>

            {/* 학년/학기 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                학년/학기
              </label>
              <select
                name="semester"
                defaultValue={params.semester || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {semesters.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* 교과 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">교과</label>
              <select
                name="subject_category"
                defaultValue={params.subject_category || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="국어">국어</option>
                <option value="수학">수학</option>
                <option value="영어">영어</option>
                <option value="사회">사회</option>
                <option value="과학">과학</option>
              </select>
            </div>

            {/* 과목 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">과목</label>
              <select
                name="subject"
                defaultValue={params.subject || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {subjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            {/* 제목 검색 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                제목 검색
              </label>
              <input
                type="text"
                name="search"
                defaultValue={params.search || ""}
                placeholder="교재명 입력"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* 검색 버튼 */}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              검색
            </button>

            {/* 초기화 버튼 */}
            <Link
              href="/admin/master-books"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          </form>
        </div>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold">{total}</span>개의 교재가
          검색되었습니다.
        </div>

        {/* 교재 목록 */}
        <div>
          {books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">📚</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    검색 결과가 없습니다
                  </h3>
                  <p className="text-sm text-gray-500">
                    다른 검색 조건으로 시도해보세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <li
                  key={book.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {book.publisher || "출판사 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">개정</dt>
                        <dd>{book.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">학년/학기</dt>
                        <dd>{book.semester || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">교과</dt>
                        <dd>{book.subject_category || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">과목</dt>
                        <dd>{book.subject || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">총 페이지</dt>
                        <dd>{book.total_pages}p</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">난이도</dt>
                        <dd>{book.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/admin/master-books/${book.id}`}
                      className="mt-2 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      상세보기
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

