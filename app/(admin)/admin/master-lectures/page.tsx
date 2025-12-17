import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getContainerClass } from "@/lib/constants/layout";
import { searchMasterLectures, getCurriculumRevisions, getPlatformsForFilter, getDifficultiesForMasterLectures } from "@/lib/data/contentMasters";
import { MasterLectureFilters } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import ExcelActions from "./_components/ExcelActions";
import { secondsToMinutes } from "@/lib/utils/duration";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";

export default async function MasterLecturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { role } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  const supabase = await createSupabaseServerClient();

  // 관리자/컨설턴트의 경우 자신의 테넌트 강의도 조회할 수 있도록 tenantId 전달
  // Super Admin의 경우 tenantId가 null이므로 모든 강의 조회 가능
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

  const { data: lectures, total } = await searchMasterLectures(filters);

  // 필터 옵션 조회 (드롭다운용)
  const [curriculumRevisions, platforms, difficulties] = await Promise.all([
    getCurriculumRevisions(),
    getPlatformsForFilter(tenantId),
    getDifficultiesForMasterLectures(tenantId),
  ]);

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">강의 목록</h1>
            <p className="text-sm text-gray-700">
              서비스에서 제공하는 강의를 검색하고 확인하세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "consultant") && (
              <>
                <ExcelActions />
                <Link
                  href="/admin/master-lectures/new"
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  + 강의 등록
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <UnifiedContentFilter
            context="admin"
            contentType="lecture"
            basePath="/admin/master-lectures"
            initialValues={{
              curriculum_revision_id: params.curriculum_revision_id,
              subject_group_id: params.subject_group_id,
              subject_id: params.subject_id,
              platform_id: params.platform_id,
              search: params.search,
              difficulty: params.difficulty,
              sort: params.sort,
            }}
            filterOptions={{
              curriculumRevisions,
              platforms,
              difficulties,
            }}
            showDifficulty={true}
            showSort={true}
            defaultSort="updated_at_desc"
          />
        </div>

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
                  <p className="text-sm text-gray-700">
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
                      <p className="text-sm text-gray-700">
                        {lecture.platform || "플랫폼 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">개정</dt>
                        <dd>{lecture.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">교과</dt>
                        <dd>{lecture.subject_category || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">과목</dt>
                        <dd>{lecture.subject || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">총 회차</dt>
                        <dd>{lecture.total_episodes}회</dd>
                      </div>
                      {lecture.total_duration && (
                        <div className="flex justify-between">
                          <dt className="font-medium text-gray-700">
                            총 강의시간
                          </dt>
                          <dd>{secondsToMinutes(lecture.total_duration)}분</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700">난이도</dt>
                        <dd>{lecture.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/admin/master-lectures/${lecture.id}`}
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

