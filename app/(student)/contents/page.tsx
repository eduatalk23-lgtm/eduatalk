// app/contents/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentTabs } from "./_components/ContentTabs";
import { ContentsListWrapper } from "./_components/ContentsListWrapper";
import { ContentsList } from "./_components/ContentsList";
import { ContentStats } from "./_components/ContentStats";
import { UnifiedContentFilter } from "@/components/filters/UnifiedContentFilter";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { getPublishersForFilter, getPlatformsForFilter, getDifficultiesForMasterBooks, getDifficultiesForMasterLectures } from "@/lib/data/contentMasters";

type TabKey = "books" | "lectures" | "custom";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tabParam = params.tab;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const activeTab: TabKey =
    tabParam === "lectures" ? "lectures" : tabParam === "custom" ? "custom" : "books";

  const searchQuery = params.search;
  const curriculumRevisionId = params.curriculum_revision_id;
  const subjectGroupId = params.subject_group_id;
  const subjectId = params.subject_id;
  const publisherId = params.publisher_id;
  const platformId = params.platform_id;
  const difficultyFilter = params.difficulty;
  const sortBy = params.sort || "created_at_desc";
  const page = Number(params.page) || 1;

  const filters = {
    search: searchQuery,
    curriculum_revision_id: curriculumRevisionId,
    subject_group_id: subjectGroupId,
    subject_id: subjectId,
    publisher_id: publisherId,
    platform_id: platformId,
    difficulty: difficultyFilter,
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">학습 콘텐츠</p>
            <h1 className="text-3xl font-semibold text-gray-900">등록된 콘텐츠</h1>
            <p className="text-sm text-gray-500">
              등록한 책, 강의, 커스텀 콘텐츠를 한 곳에서 확인하세요.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/contents/master-books"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              📚 서비스 마스터 교재
            </Link>
            <Link
              href="/contents/master-lectures"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              🎧 서비스 마스터 강의
            </Link>
            <Link
              href="/contents/master-custom-contents"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              📝 서비스 마스터 커스텀 콘텐츠
            </Link>
            {activeTab !== "custom" && (
              <Link
                href={`/contents/${activeTab}/new`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                {activeTab === "books" ? "+ 책 등록" : "+ 강의 등록"}
              </Link>
            )}
          </div>
        </div>

        {/* 통계 */}
        <ContentStats studentId={user.id} />

        {/* Tabs */}
        <ContentTabs
          tabs={[
            { key: "books", label: "교재" },
            { key: "lectures", label: "강의" },
            { key: "custom", label: "커스텀" },
          ]}
          defaultTab={activeTab}
        />

        {/* Filters and Sort */}
        <Suspense fallback={<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="h-10 bg-gray-200 rounded animate-pulse"></div></div>}>
          <StudentContentFilterWrapper
            activeTab={activeTab}
            params={params}
          />
        </Suspense>

        {/* List */}
        <ContentsListWrapper activeTab={activeTab}>
          <ContentsList
            activeTab={activeTab}
            studentId={user.id}
            filters={filters}
            sortBy={sortBy}
            page={page}
          />
        </ContentsListWrapper>
      </div>
    </section>
  );
}

async function StudentContentFilterWrapper({
  activeTab,
  params,
}: {
  activeTab: TabKey;
  params: Record<string, string | undefined>;
}) {
  // 필터 옵션 조회 (에러 발생 시 빈 배열로 대체)
  const [curriculumRevisions, publishers, platforms, difficulties] = await Promise.allSettled([
    getCurriculumRevisions(),
    activeTab === "books" ? getPublishersForFilter() : Promise.resolve([]),
    activeTab === "lectures" ? getPlatformsForFilter() : Promise.resolve([]),
    activeTab === "books" ? getDifficultiesForMasterBooks() : getDifficultiesForMasterLectures(),
  ]).then((results) =>
    results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        console.error("[StudentContentFilterWrapper] 필터 옵션 조회 실패", result.reason);
        return [];
      }
    })
  );

  const filterOptions = {
    curriculumRevisions: Array.isArray(curriculumRevisions)
      ? curriculumRevisions
          .filter((rev): rev is { id: string; name: string } => 
            typeof rev === "object" && rev !== null && "id" in rev && "name" in rev
          )
          .map((rev) => ({
            id: rev.id,
            name: rev.name,
          }))
      : [],
    publishers: activeTab === "books" && Array.isArray(publishers) 
      ? publishers.filter((pub): pub is { id: string; name: string } => 
          typeof pub === "object" && pub !== null && "id" in pub && "name" in pub
        )
      : undefined,
    platforms: activeTab === "lectures" && Array.isArray(platforms)
      ? platforms.filter((plat): plat is { id: string; name: string } => 
          typeof plat === "object" && plat !== null && "id" in plat && "name" in plat
        )
      : undefined,
    difficulties: Array.isArray(difficulties) 
      ? difficulties.filter((diff): diff is string => typeof diff === "string")
      : [],
  };

  const basePath = "/contents";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <UnifiedContentFilter
        context="student"
        contentType={activeTab === "books" ? "book" : activeTab === "lectures" ? "lecture" : "custom"}
        basePath={basePath}
        initialValues={{
          curriculum_revision_id: params.curriculum_revision_id,
          subject_group_id: params.subject_group_id,
          subject_id: params.subject_id,
          publisher_id: params.publisher_id,
          platform_id: params.platform_id,
          search: params.search,
          difficulty: params.difficulty,
          sort: params.sort,
        }}
        filterOptions={filterOptions}
        showDifficulty={true}
        showSort={true}
        defaultSort="created_at_desc"
      />
    </div>
  );
}

