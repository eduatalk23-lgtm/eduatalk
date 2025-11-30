import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseServerClient, createSupabasePublicClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { searchMasterLectures } from "@/lib/data/contentMasters";
import { MasterLectureFilters } from "@/lib/data/contentMasters";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { secondsToMinutes } from "@/lib/utils/duration";

// 필터 옵션 조회 함수 (캐싱 적용)
async function getCachedFilterOptions() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);

  const getCached = unstable_cache(
    async () => {
      const [subjectsRes, semestersRes, revisionsRes] = await Promise.all([
        supabase
          .from("master_lectures")
          .select("subject")
          .not("subject", "is", null),
        supabase
          .from("master_lectures")
          .select("semester")
          .not("semester", "is", null),
        supabase
          .from("master_lectures")
          .select("revision")
          .not("revision", "is", null),
      ]);

      const subjects = Array.from(
        new Set(
          (subjectsRes.data || [])
            .map((item) => item.subject)
            .filter(Boolean)
        )
      ).sort() as string[];

      const semesters = Array.from(
        new Set(
          (semestersRes.data || [])
            .map((item) => item.semester)
            .filter(Boolean)
        )
      ).sort() as string[];

      const revisions = Array.from(
        new Set(
          (revisionsRes.data || [])
            .map((item) => item.revision)
            .filter(Boolean)
        )
      ).sort() as string[];

      return { subjects, semesters, revisions };
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
    filters.subject || "",
    filters.subject_category || "",
    filters.semester || "",
    filters.revision || "",
    filters.search || "",
    filters.limit || 50,
  ].join("-");
  
  const getCached = unstable_cache(
    async (filters: MasterLectureFilters) => {
      // 캐시 함수 내부에서 공개 데이터용 Supabase 클라이언트 생성 (쿠키 없이)
      // master_lectures는 공개 데이터이므로 인증이 필요 없음
      const supabase = createSupabasePublicClient();
      
      let query = supabase
        .from("master_lectures")
        .select("*", { count: "exact" });

      // 필터 적용
      if (filters.subject) {
        query = query.eq("subject", filters.subject);
      }
      if (filters.subject_category) {
        query = query.eq("subject_category", filters.subject_category);
      }
      if (filters.semester) {
        query = query.eq("semester", filters.semester);
      }
      if (filters.revision) {
        query = query.eq("revision", filters.revision);
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
        console.error("[master-lectures] 검색 실패", error);
        throw new Error(error.message || "강의 검색에 실패했습니다.");
      }

      return {
        data: (data || []) as any[],
        total: count ?? 0,
      };
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

async function FilterForm({
  params,
  filterOptions,
}: {
  params: Record<string, string | undefined>;
  filterOptions: { subjects: string[]; semesters: string[]; revisions: string[] };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <form
        action="/contents/master-lectures"
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
            {filterOptions.revisions.map((rev) => (
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
            {filterOptions.semesters.map((sem) => (
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
            {filterOptions.subjects.map((subj) => (
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
            placeholder="강의명 입력"
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
          href="/contents/master-lectures"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          초기화
        </Link>
      </form>
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
    subject: params.subject,
    subject_category: params.subject_category,
    semester: params.semester,
    revision: params.revision,
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
          <FilterForm params={params} filterOptions={filterOptions} />
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

