
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchMasterBooks, getPublishersForFilter, getDifficultiesForMasterBooks } from "@/lib/data/contentMasters";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { MasterBookFilters } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";
import { inlineButtonBase } from "@/lib/utils/darkMode";

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
    filters.difficulty || "",
    filters.sort || "",
    filters.tenantId || "", // tenantId를 캐시 키에 포함
    filters.limit || 50,
  ].join("-");

  const getCached = unstable_cache(
    async (filters: MasterBookFilters) => {
      // 공개 데이터용 Supabase 클라이언트 생성 (쿠키 없이)
      const supabase = createSupabasePublicClient();

      // 표준 함수 사용
      return await searchMasterBooks(filters, supabase);
    },
    [cacheKey],
    {
      revalidate: 60, // 1분 캐시
      tags: ["master-books-search"],
    }
  );

  return getCached(filters);
}


function FilterFormWrapper({
  params,
  filterOptions,
}: {
  params: Record<string, string | undefined>;
  filterOptions: { 
    curriculumRevisions: Array<{ id: string; name: string }>; 
    publishers: Array<{ id: string; name: string }>;
    difficulties: string[];
  };
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <UnifiedContentFilter
        context="master"
        contentType="book"
        basePath="/contents/master-books"
        initialValues={{
          curriculum_revision_id: params.curriculum_revision_id,
          subject_group_id: params.subject_group_id,
          subject_id: params.subject_id,
          publisher_id: params.publisher_id,
          search: params.search,
          difficulty: params.difficulty,
          sort: params.sort,
        }}
        filterOptions={filterOptions}
        showDifficulty={true}
        showSort={true}
        defaultSort="updated_at_desc"
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
  const { userId, role } = await getCachedUserRole();

  if (!userId) redirect("/login");

  // 테넌트 ID 가져오기 (공개 콘텐츠 + 자신의 테넌트 콘텐츠)
  const tenantContext = await getTenantContext();
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

  // 필터 옵션 조회 (드롭다운용) - 캐시 없이 직접 조회
  const [curriculumRevisions, publishers, difficulties] = await Promise.all([
    getCurriculumRevisions(),
    getPublishersForFilter(),
    getDifficultiesForMasterBooks(),
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
    difficulties,
  };


  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">교재 검색</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              서비스에서 제공하는 교재를 검색하고 내 교재로 가져올 수 있습니다.
            </p>
          </div>
          <Link
            href="/contents"
            className={inlineButtonBase("px-4 py-2 text-sm font-semibold")}
          >
            ← 목록으로
          </Link>
        </div>

        {/* 검색 필터 */}
        <Suspense fallback={<SuspenseFallback />}>
          <FilterFormWrapper params={params} filterOptions={filterOptions} />
        </Suspense>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          총 <span className="font-semibold">{total}</span>개의 교재가
          검색되었습니다.
        </div>

        {/* 교재 목록 */}
        <div>
          {books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">📚</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    검색 결과가 없습니다
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    {book.cover_image_url && (
                      <div className="relative h-40 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(book as any).publisher_name || "출판사 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">개정</dt>
                        <dd>{book.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">교과</dt>
                        <dd>{book.subject_category || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">과목</dt>
                        <dd>{book.subject || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">총 페이지</dt>
                        <dd>{book.total_pages}p</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">난이도</dt>
                        <dd>{book.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/contents/master-books/${book.id}`}
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

