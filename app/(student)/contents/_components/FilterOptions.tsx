import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { FilterBar } from "./FilterBar";
import { FilterDrawer } from "./FilterDrawer";

type TabKey = "books" | "lectures";

type FilterOptionsProps = {
  activeTab: TabKey;
  studentId: string;
  filters: {
    search?: string;
    subject?: string;
    subject_category?: string;
    semester?: string;
    revision?: string;
    publisher?: string;
    platform?: string;
    difficulty?: string;
  };
  sortBy: string;
  searchQuery?: string;
};

async function FilterOptionsContent({
  activeTab,
  studentId,
  filters,
  sortBy,
  searchQuery,
}: FilterOptionsProps) {
  // cookies()를 unstable_cache() 외부에서 호출
  const cookieStore = await cookies();

  // 필터 옵션 조회 (캐싱 적용)
  const getCachedFilterOptions = unstable_cache(
    async (tab: TabKey, userId: string) => {
      // 캐시 함수 내부에서 쿠키 스토어를 사용하여 Supabase 클라이언트 생성
      const supabaseInstance = await createSupabaseServerClient(cookieStore);
      const [allSubjects, allSubjectCategories, allSemesters, allRevisions, allPublishers, allPlatforms, allDifficulties] = await Promise.all([
        fetchDistinctValues(supabaseInstance, tab, userId, "subject"),
        fetchDistinctValues(supabaseInstance, tab, userId, "subject_category"),
        fetchDistinctValues(supabaseInstance, tab, userId, "semester"),
        fetchDistinctValues(supabaseInstance, tab, userId, "revision"),
        tab === "books" ? fetchDistinctValues(supabaseInstance, tab, userId, "publisher") : Promise.resolve([]),
        tab === "lectures" ? fetchDistinctValues(supabaseInstance, tab, userId, "platform") : Promise.resolve([]),
        fetchDistinctValues(supabaseInstance, tab, userId, "difficulty_level"),
      ]);

      return {
        allSubjects,
        allSubjectCategories,
        allSemesters,
        allRevisions,
        allPublishers,
        allPlatforms,
        allDifficulties,
      };
    },
    [`filter-options-${studentId}-${activeTab}`],
    {
      revalidate: 300, // 5분 캐시
      tags: [`filter-options-${studentId}-${activeTab}`],
    }
  );

  const filterOptions = await getCachedFilterOptions(activeTab, studentId);

  return (
    <FilterDrawer
      activeTab={activeTab}
      searchQuery={searchQuery}
      subjectFilter={filters.subject}
      subjectCategoryFilter={filters.subject_category}
      semesterFilter={filters.semester}
      revisionFilter={filters.revision}
      publisherFilter={filters.publisher}
      platformFilter={filters.platform}
      difficultyFilter={filters.difficulty}
      sortBy={sortBy}
      {...filterOptions}
    />
  );
}

export function FilterOptions(props: FilterOptionsProps) {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <FilterOptionsContent {...props} />
    </Suspense>
  );
}

async function fetchDistinctValues(
  supabase: SupabaseClient,
  tab: TabKey,
  studentId: string,
  fieldName: string
): Promise<string[]> {
  try {
    const tableName = tab === "books" ? "books" : "lectures";

    const selectQuery = () =>
      supabase
        .from(tableName)
        .select(fieldName)
        .not(fieldName, "is", null);

    let { data, error } = await selectQuery().eq("student_id", studentId);
    if (error && error.code === "42703") {
      ({ data, error } = await selectQuery());
    }
    if (error) throw error;

    const values = new Set<string>();
    ((data ?? []) as unknown as Record<string, string | null>[]).forEach((item: Record<string, string | null>) => {
      const value = item[fieldName];
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  } catch (err) {
    console.error(err);
    return [];
  }
}

