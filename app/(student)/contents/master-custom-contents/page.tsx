import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchMasterCustomContents, getCurriculumRevisions } from "@/lib/data/contentMasters";
import { MasterCustomContentFilters } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";
import { getContainerClass } from "@/lib/constants/layout";
import { inlineButtonBase } from "@/lib/utils/darkMode";

export default async function StudentMasterCustomContentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { role } = await getCachedUserRole();

  if (role !== "student") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();

  // 테넌트 ID 전달 (공개 콘텐츠 + 자신의 테넌트 콘텐츠)
  const tenantId = tenantContext?.tenantId || undefined;

  // 검색 필터 구성
  const filters: MasterCustomContentFilters = {
    curriculum_revision_id: params.curriculum_revision_id,
    subject_group_id: params.subject_group_id,
    subject_id: params.subject_id,
    content_type: params.content_type,
    search: params.search,
    difficulty: params.difficulty,
    sort: (params.sort as ContentSortOption | undefined) ?? ("updated_at_desc" as ContentSortOption),
    tenantId, // 테넌트 ID 추가
    limit: 50,
  };

  const { data: contents, total } = await searchMasterCustomContents(filters);

  // 필터 옵션 조회 (드롭다운용)
  const curriculumRevisions = await getCurriculumRevisions().catch(() => []);

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">커스텀 콘텐츠 목록</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              서비스에서 제공하는 커스텀 콘텐츠를 검색하고 가져올 수 있습니다.
            </p>
          </div>
          <Link
            href="/contents"
            className={inlineButtonBase("px-4 py-2 text-sm font-semibold")}
          >
            내 콘텐츠로
          </Link>
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <UnifiedContentFilter
            context="student"
            contentType="custom"
            basePath="/contents/master-custom-contents"
            initialValues={{
              curriculum_revision_id: params.curriculum_revision_id,
              subject_group_id: params.subject_group_id,
              subject_id: params.subject_id,
              content_type: params.content_type,
              search: params.search,
              difficulty: params.difficulty,
              sort: params.sort,
            }}
            filterOptions={{
              curriculumRevisions,
            }}
            showDifficulty={true}
            showSort={true}
            defaultSort="updated_at_desc"
          />
        </div>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          총 <span className="font-semibold">{total}</span>개의 커스텀 콘텐츠가
          검색되었습니다.
        </div>

        {/* 커스텀 콘텐츠 목록 */}
        <div>
          {contents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">📝</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    검색 결과가 없습니다
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    다른 검색 조건으로 시도해보세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {contents.map((content) => (
                <li
                  key={content.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {content.title}
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {content.content_type || "유형 정보 없음"}
                      </p>
                    </div>

                    <dl className="grid gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700 dark:text-gray-300">개정</dt>
                        <dd>{content.revision || "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700 dark:text-gray-300">과목</dt>
                        <dd>{content.subject || "—"}</dd>
                      </div>
                      {content.total_page_or_time && (
                        <div className="flex justify-between">
                          <dt className="font-medium text-gray-700 dark:text-gray-300">
                            {content.content_type === "book" ? "총 페이지" : "총 시간"}
                          </dt>
                          <dd>
                            {content.content_type === "book"
                              ? `${content.total_page_or_time}p`
                              : `${content.total_page_or_time}분`}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-700 dark:text-gray-300">난이도</dt>
                        <dd>{content.difficulty_level || "—"}</dd>
                      </div>
                    </dl>

                    <Link
                      href={`/contents/master-custom-contents/${content.id}`}
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

