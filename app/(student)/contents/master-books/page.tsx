import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { searchMasterBooks, getPublishersForFilter } from "@/lib/data/contentMasters";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { MasterBookFilters } from "@/lib/data/contentMasters";
import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { HierarchicalFilter } from "./_components/HierarchicalFilter";

// 검색 결과 조회 함수 (캐싱 적용)
async function getCachedSearchResults(filters: MasterBookFilters) {
  // 안정적인 캐시 키 생성
      const cacheKey = [
        "master-books-search",
        filters.curriculum_revision_id || "",
        filters.subject_group_id || "",
        filters.subject_id || "",
        filters.publisher_id || "",
        filters.search || "",
        filters.limit || 50,
      ].join("-");
  
  const getCached = unstable_cache(
    async (filters: MasterBookFilters) => {
      // 캐시 함수 내부에서 공개 데이터용 Supabase 클라이언트 생성 (쿠키 없이)
      // master_books는 공개 데이터이므로 인증이 필요 없음
      const supabase = createSupabasePublicClient();
      
      let query = supabase
        .from("master_books")
        .select("*", { count: "exact" });

      // 필터 적용
      if (filters.curriculum_revision_id) {
        query = query.eq("curriculum_revision_id", filters.curriculum_revision_id);
      }
      if (filters.subject_group_id) {
        query = query.eq("subject_group_id", filters.subject_group_id);
      }
      if (filters.subject_id) {
        query = query.eq("subject_id", filters.subject_id);
      }
      if (filters.publisher_id) {
        query = query.eq("publisher_id", filters.publisher_id);
      }
      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }
      if (filters.tenantId) {
        query = query.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
      } else {
        query = query.is("tenant_id", null);
      }

      // 정렬
      query = query.order("updated_at", { ascending: false });

      // 페이지네이션
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("[master-books] 검색 실패", error);
        throw new Error(error.message || "교재 검색에 실패했습니다.");
      }

      return {
        data: (data || []) as any[],
        total: count ?? 0,
      };
    },
    [cacheKey],
    {
      revalidate: 60, // 1분 캐시
      tags: ["master-books-search"],
    }
  );

  return getCached(filters);
}

function FilterOptionsSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterFormWrapper({
  params,
  filterOptions,
}: {
  params: Record<string, string | undefined>;
  filterOptions: { curriculumRevisions: Array<{ id: string; name: string }>; publishers: Array<{ id: string; name: string }> };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <HierarchicalFilter
        curriculumRevisions={filterOptions.curriculumRevisions}
        initialCurriculumRevisionId={params.curriculum_revision_id}
        initialSubjectGroupId={params.subject_group_id}
        initialSubjectId={params.subject_id}
        publishers={filterOptions.publishers}
        initialPublisherId={params.publisher_id}
        contentType="book"
        searchQuery={params.search}
      />
    </div>
  );
}

export default async function StudentMasterBooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { userId, role } = await getCurrentUserRole();

  if (!userId) redirect("/login");

  // 검색 필터 구성
  const filters: MasterBookFilters = {
    curriculum_revision_id: params.curriculum_revision_id,
    subject_group_id: params.subject_group_id,
    subject_id: params.subject_id,
    publisher_id: params.publisher_id,
    search: params.search,
    limit: 50,
  };

  // 필터 옵션 조회 (드롭다운용) - 캐시 없이 직접 조회
  const [curriculumRevisions, publishers] = await Promise.all([
    getCurriculumRevisions(),
    getPublishersForFilter(),
  ]);

  // 검색 결과 조회 (캐싱 적용)
  const searchResult = await getCachedSearchResults(filters);
  const { data: books, total } = searchResult;

  const filterOptions = {
    curriculumRevisions: curriculumRevisions.map((rev) => ({
      id: rev.id,
      name: rev.name,
    })),
    publishers,
  };

  console.log("[student/master-books] 개정교육과정 조회 결과:", {
    count: curriculumRevisions.length,
    revisions: curriculumRevisions.map((r) => ({ id: r.id, name: r.name })),
  });

  console.log("[student/master-books] 개정교육과정 조회 결과:", {
    count: curriculumRevisions.length,
    revisions: curriculumRevisions.map((r) => ({ id: r.id, name: r.name })),
  });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">교재 검색</h1>
            <p className="text-sm text-gray-500">
              서비스에서 제공하는 교재를 검색하고 내 교재로 가져올 수 있습니다.
            </p>
          </div>
          <Link
            href="/contents"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← 목록으로
          </Link>
        </div>

        {/* 검색 필터 */}
        <Suspense fallback={<FilterOptionsSkeleton />}>
          <FilterFormWrapper params={params} filterOptions={filterOptions} />
        </Suspense>

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
                      href={`/contents/master-books/${book.id}`}
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

