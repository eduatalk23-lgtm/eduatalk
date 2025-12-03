import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseServerClient, createSupabasePublicClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { searchMasterLectures, getPlatformsForFilter } from "@/lib/data/contentMasters";
import { MasterLectureFilters } from "@/lib/data/contentMasters";
import { unstable_cache } from "next/cache";
import { secondsToMinutes } from "@/lib/utils/duration";
import { HierarchicalFilter } from "../master-books/_components/HierarchicalFilter";

// 필터 옵션 조회 함수 (캐싱 적용)
async function getCachedFilterOptions() {
  const getCached = unstable_cache(
    async () => {
      const [curriculumRevisions, platforms] = await Promise.all([
        (async () => {
          const supabase = createSupabasePublicClient();
          const { data } = await supabase
            .from("curriculum_revisions")
            .select("id, name")
            .order("name", { ascending: true });
          return (data || []).map((item) => ({
            id: item.id,
            name: item.name,
          }));
        })(),
        getPlatformsForFilter(),
      ]);

      return { curriculumRevisions, platforms };
    },
    ["master-lectures-filter-options"],
    {
      revalidate: 3600, // 1시간 캐시
      tags: ["master-lectures-filter-options"],
    }
  );

  return getCached();
}

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
        filters.limit || 50,
      ].join("-");
  
  const getCached = unstable_cache(
    async (filters: MasterLectureFilters) => {
      // 공개 데이터용 Supabase 클라이언트 생성 (쿠키 없이)
      // 학생은 공개 콘텐츠(tenant_id IS NULL)만 조회 가능
      const supabase = createSupabasePublicClient();
      
      // tenantId를 명시적으로 undefined로 설정하여 공개 콘텐츠만 조회
      const searchFilters: MasterLectureFilters = {
        ...filters,
        tenantId: undefined, // 공개 콘텐츠만 조회
      };

      // 표준 함수 사용
      return await searchMasterLectures(searchFilters, supabase);
    },
    [cacheKey],
    {
      revalidate: 60, // 1분 캐시
      tags: ["master-lectures-search"],
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
  filterOptions: { curriculumRevisions: Array<{ id: string; name: string }>; platforms: Array<{ id: string; name: string }> };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <HierarchicalFilter
        curriculumRevisions={filterOptions.curriculumRevisions}
        initialCurriculumRevisionId={params.curriculum_revision_id}
        initialSubjectGroupId={params.subject_group_id}
        initialSubjectId={params.subject_id}
        platforms={filterOptions.platforms}
        initialPlatformId={params.platform_id}
        contentType="lecture"
        searchQuery={params.search}
        basePath="/contents/master-lectures"
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

  // 검색 필터 구성
  const filters: MasterLectureFilters = {
    curriculum_revision_id: params.curriculum_revision_id,
    subject_group_id: params.subject_group_id,
    subject_id: params.subject_id,
    platform_id: params.platform_id,
    search: params.search,
    limit: 50,
  };

  // 병렬로 데이터 페칭
  const [searchResult, filterOptions] = await Promise.all([
    getCachedSearchResults(filters),
    getCachedFilterOptions(),
  ]);

  const { data: lectures, total } = searchResult;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">강의 검색</h1>
            <p className="text-sm text-gray-500">
              서비스에서 제공하는 강의를 검색하고 내 강의로 가져올 수 있습니다.
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
          총 <span className="font-semibold">{total}</span>개의 강의가
          검색되었습니다.
        </div>

        {/* 강의 목록 */}
        <div>
          {lectures.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">🎧</div>
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
              {lectures.map((lecture) => (
                <li
                  key={lecture.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {lecture.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lecture.platform || "플랫폼 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">개정</dt>
                        <dd>{lecture.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">학년/학기</dt>
                        <dd>{lecture.semester || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">교과</dt>
                        <dd>{lecture.subject_category || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">과목</dt>
                        <dd>{lecture.subject || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">총 회차</dt>
                        <dd>{lecture.total_episodes}회</dd>
                      </div>
                      {lecture.total_duration && (
                        <div className="flex justify-between">
                          <dt className="font-medium text-gray-500">
                            총 강의시간
                          </dt>
                          <dd>{secondsToMinutes(lecture.total_duration)}분</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">난이도</dt>
                        <dd>{lecture.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/contents/master-lectures/${lecture.id}`}
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

