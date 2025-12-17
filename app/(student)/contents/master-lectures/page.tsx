import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchMasterLectures, getPlatformsForFilter, getDifficultiesForMasterLectures } from "@/lib/data/contentMasters";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { MasterLectureFilters } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { secondsToMinutes } from "@/lib/utils/duration";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";
import { inlineButtonBase } from "@/lib/utils/darkMode";


// 검색 결과 조회 함수 (캐싱 적용)
async function getCachedSearchResults(filters: MasterLectureFilters) {
  // 안정적인 캐시 키 생성
  const cacheKey = [
    "master-lectures-search",
    filters.curriculum_revision_id || "",
    filters.subject_group_id || "",
    filters.subject_id || "",
    filters.platform_id || "",
    filters.search || "",
    filters.difficulty || "",
    filters.sort || "",
    filters.tenantId || "", // tenantId를 캐시 키에 포함
    filters.limit || 50,
  ].join("-");

  const getCached = unstable_cache(
    async (filters: MasterLectureFilters) => {
      // 공개 데이터용 Supabase 클라이언트 생성 (쿠키 없이)
      const supabase = createSupabasePublicClient();

      // tenantId를 그대로 전달 (공개 콘텐츠 + 자신의 테넌트 콘텐츠)
      return await searchMasterLectures(filters, supabase);
    },
    [cacheKey],
    {
      revalidate: 60, // 1분 캐시
      tags: ["master-lectures-search"],
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
    platforms: Array<{ id: string; name: string }>;
    difficulties: string[];
  };
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <UnifiedContentFilter
        context="master"
        contentType="lecture"
        basePath="/contents/master-lectures"
        initialValues={{
          curriculum_revision_id: params.curriculum_revision_id,
          subject_group_id: params.subject_group_id,
          subject_id: params.subject_id,
          platform_id: params.platform_id,
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

export default async function StudentMasterLecturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { userId, role } = await getCurrentUserRole();

  if (!userId) redirect("/login");

  // 테넌트 ID 가져오기 (공개 콘텐츠 + 자신의 테넌트 콘텐츠)
  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || undefined;

  // 검색 필터 구성
  const filters: MasterLectureFilters = {
    curriculum_revision_id: params.curriculum_revision_id,
    subject_group_id: params.subject_group_id,
    subject_id: params.subject_id,
    platform_id: params.platform_id,
    search: params.search,
    difficulty: params.difficulty,
    sort: (params.sort as ContentSortOption | undefined) ?? ("updated_at_desc" as ContentSortOption),
    tenantId, // 테넌트 ID 추가
    limit: 50,
  };

  // 필터 옵션 조회 (드롭다운용) - 캐시 없이 직접 조회
  const [curriculumRevisions, platforms, difficulties] = await Promise.all([
    getCurriculumRevisions(),
    getPlatformsForFilter(),
    getDifficultiesForMasterLectures(),
  ]);

  // 검색 결과 조회 (캐싱 적용)
  const searchResult = await getCachedSearchResults(filters);
  const { data: lectures, total } = searchResult;

  const filterOptions = {
    curriculumRevisions: curriculumRevisions.map((rev) => ({
      id: rev.id,
      name: rev.name,
    })),
    platforms,
    difficulties,
  };

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">강의 검색</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              서비스에서 제공하는 강의를 검색하고 내 강의로 가져올 수 있습니다.
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
          총 <span className="font-semibold">{total}</span>개의 강의가
          검색되었습니다.
        </div>

        {/* 강의 목록 */}
        <div>
          {lectures.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">🎧</div>
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
              {lectures.map((lecture) => (
                <li
                  key={lecture.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {lecture.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {lecture.platform || "플랫폼 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">개정</dt>
                        <dd>{lecture.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">교과</dt>
                        <dd>{lecture.subject_category || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">과목</dt>
                        <dd>{lecture.subject || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">총 회차</dt>
                        <dd>{lecture.total_episodes}회</dd>
                      </div>
                      {lecture.total_duration && (
                        <div className="flex justify-between">
                          <dt className="font-medium text-gray-500 dark:text-gray-400">
                            총 강의시간
                          </dt>
                          <dd>{secondsToMinutes(lecture.total_duration)}분</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">난이도</dt>
                        <dd>{lecture.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/contents/master-lectures/${lecture.id}`}
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

