import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getContainerClass } from "@/lib/constants/layout";
import { searchMasterBooks, getCurriculumRevisions, getPublishersForFilter, getDifficultiesForMasterBooks } from "@/lib/data/contentMasters";
import { MasterBookFilters } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import ExcelActions from "./_components/ExcelActions";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";

export default async function MasterBooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { role } = await getCachedUserRole();
  const tenantContext = await getTenantContext();

  const supabase = await createSupabaseServerClient();

  // 관리자/컨설턴트의 경우 자신의 테넌트 교재도 조회할 수 있도록 tenantId 전달
  // Super Admin의 경우 tenantId가 null이므로 모든 교재 조회 가능
  const tenantId = tenantContext?.tenantId || undefined;

  // 검색 필터 구성
  const filters: MasterBookFilters = {
    curriculum_revision_id: params.curriculum_revision_id,
    subject_group_id: params.subject_group_id,
    subject_id: params.subject_id,
    publisher_id: params.publisher_id,
    search: params.search,
    difficulty: params.difficulty,
    sort: (params.sort as ContentSortOption | undefined) ?? ("updated_at_desc" as ContentSortOption),
    tenantId, // 테넌트 ID 추가
    limit: 50,
  };

  const { data: books, total } = await searchMasterBooks(filters);

  // 필터 옵션 조회 (드롭다운용)
  const [curriculumRevisions, publishers, difficulties] = await Promise.all([
    getCurriculumRevisions(),
    getPublishersForFilter(tenantId),
    getDifficultiesForMasterBooks(tenantId),
  ]);

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">교재 목록</h1>
            <p className="text-sm text-gray-700">
              서비스에서 제공하는 교재를 검색하고 확인하세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "consultant") && (
              <>
                <ExcelActions />
                <Link
                  href="/admin/master-books/new"
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  + 교재 등록
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <UnifiedContentFilter
            context="admin"
            contentType="book"
            basePath="/admin/master-books"
            initialValues={{
              curriculum_revision_id: params.curriculum_revision_id,
              subject_group_id: params.subject_group_id,
              subject_id: params.subject_id,
              publisher_id: params.publisher_id,
              search: params.search,
              difficulty: params.difficulty,
              sort: params.sort,
            }}
            filterOptions={{
              curriculumRevisions,
              publishers,
              difficulties,
            }}
            showDifficulty={true}
            showSort={true}
            defaultSort="updated_at_desc"
          />
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
                  <p className="text-sm text-gray-700">
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
                    {book.cover_image_url && (
                      <div className="relative h-40 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                        <Image
                          src={book.cover_image_url}
                          alt={`${book.title} 표지`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-700">
                        {book.publisher_name || "출판사 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">개정</dt>
                        <dd>{book.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">과목 ID</dt>
                        <dd className="truncate max-w-[150px]">{book.subject_id || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">총 페이지</dt>
                        <dd>{book.total_pages ? `${book.total_pages}p` : "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">난이도</dt>
                        <dd>{book.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/admin/master-books/${book.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
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

