// app/contents/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentTabs } from "./_components/ContentTabs";
import { FilterOptions } from "./_components/FilterOptions";
import { ContentsListWrapper } from "./_components/ContentsListWrapper";
import { ContentsList } from "./_components/ContentsList";
import { ContentStats } from "./_components/ContentStats";

type TabKey = "books" | "lectures";

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
    tabParam === "lectures" ? "lectures" : "books";

  const searchQuery = params.search;
  const subjectFilter = params.subject;
  const subjectCategoryFilter = params.subject_category;
  const semesterFilter = params.semester;
  const revisionFilter = params.revision;
  const publisherFilter = params.publisher;
  const platformFilter = params.platform;
  const difficultyFilter = params.difficulty;
  const sortBy = params.sort || "created_at_desc";
  const page = Number(params.page) || 1;

  const filters = {
    search: searchQuery,
    subject: subjectFilter,
    subject_category: subjectCategoryFilter,
    semester: semesterFilter,
    revision: revisionFilter,
    publisher: publisherFilter,
    platform: platformFilter,
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
              등록한 책과 강의를 한 곳에서 확인하세요.
            </p>
          </div>
          <div className="flex gap-2">
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
              href={`/contents/${activeTab}/new`}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {activeTab === "books" ? "+ 책 등록" : "+ 강의 등록"}
            </Link>
          </div>
        </div>

        {/* 통계 */}
        <ContentStats studentId={user.id} />

        {/* Tabs */}
        <ContentTabs
          tabs={[
            { key: "books", label: "교재" },
            { key: "lectures", label: "강의" },
          ]}
          defaultTab={activeTab}
        />

        {/* Filters and Sort */}
        <FilterOptions
          activeTab={activeTab}
          studentId={user.id}
          filters={filters}
          sortBy={sortBy}
          searchQuery={searchQuery}
        />

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

