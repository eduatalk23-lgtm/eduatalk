import { Suspense } from "react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentCard } from "./ContentCard";
import { Pagination } from "./Pagination";
import {
  deleteBook,
  deleteLecture,
  deleteCustomContent,
} from "@/app/(student)/actions/contentActions";
import { ContentsListClient } from "./ContentsListClient";

type TabKey = "books" | "lectures" | "custom";
export type ContentListItem = {
  id: string;
  title: string;
  revision?: string | null;
  semester?: string | null;
  subject_category?: string | null;
  subject?: string | null;
  publisher?: string | null;
  platform?: string | null;
  difficulty_level?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
  duration?: number | null;
  content_type?: string | null;
  total_page_or_time?: number | null;
  linked_book_id?: string | null;
  linkedBook?: { id: string; title: string } | null;
  // 알 수 없는 필드가 있을 경우를 위한 fallback
} & Record<string, unknown>;

type ContentsListProps = {
  activeTab: TabKey;
  studentId: string;
  filters: {
    search?: string;
    curriculum_revision_id?: string;
    subject_group_id?: string;
    subject_id?: string;
    publisher_id?: string;
    platform_id?: string;
    difficulty?: string;
  };
  sortBy: string;
  page?: number;
};

async function ContentsListContent({
  activeTab,
  studentId,
  filters,
  sortBy,
  page = 1,
}: ContentsListProps) {
  const supabase = await createSupabaseServerClient();
  const ITEMS_PER_PAGE = 20;
  const { list, total, totalPages } = await fetchContentsByTab(
    supabase,
    activeTab,
    studentId,
    filters,
    sortBy,
    page,
    ITEMS_PER_PAGE
  );

  // 강의의 경우 연결된 교재 정보 조회
  if (activeTab === "lectures" && list.length > 0) {
    const linkedBookIds = list
      .map((item) => item.linked_book_id)
      .filter((id): id is string => !!id);
    
    if (linkedBookIds.length > 0) {
      const { data: linkedBooks } = await supabase
        .from("books")
        .select("id, title")
        .in("id", linkedBookIds)
        .eq("student_id", studentId);
      
      const linkedBooksMap = new Map(
        (linkedBooks || []).map((book) => [book.id, book])
      );
      
      // 각 강의에 연결된 교재 정보 추가
      list.forEach((item) => {
        const linkedBookId = item.linked_book_id;
        if (linkedBookId && linkedBooksMap.has(linkedBookId)) {
          const linkedBook = linkedBooksMap.get(linkedBookId);
          if (linkedBook) {
            item.linkedBook = linkedBook;
          }
        }
      });
    }
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="mx-auto flex max-w-md flex-col gap-6">
            <div className="text-6xl">
              {activeTab === "books" && "📚"}
              {activeTab === "lectures" && "🎧"}
              {activeTab === "custom" && "📝"}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {activeTab === "books" && "등록된 책이 없습니다"}
                {activeTab === "lectures" && "등록된 강의가 없습니다"}
                {activeTab === "custom" && "등록된 커스텀 콘텐츠가 없습니다"}
              </h3>
              <p className="text-sm text-gray-500">
                {activeTab === "books" && "새로운 책을 등록하여 학습을 시작해보세요."}
                {activeTab === "lectures" && "새로운 강의를 등록하여 학습을 시작해보세요."}
                {activeTab === "custom" && "서비스 마스터 커스텀 콘텐츠에서 가져오거나 직접 등록해보세요."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {activeTab === "custom" ? (
                <Link
                  href="/contents/master-custom-contents"
                  className="inline-flex items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  📝 서비스 마스터 커스텀 콘텐츠에서 가져오기
                </Link>
              ) : (
                <>
                  <Link
                    href={activeTab === "books" ? "/contents/master-books" : "/contents/master-lectures"}
                    className="inline-flex items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    {activeTab === "books" ? "📚 서비스 마스터 교재에서 가져오기" : "🎧 서비스 마스터 강의에서 가져오기"}
                  </Link>
                  <Link
                    href={`/contents/${activeTab}/new`}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    {activeTab === "books" ? "+ 새 교재 등록" : "+ 새 강의 등록"}
                  </Link>
                </>
              )}
            </div>
          </div>
      </div>
    );
  }

  return (
    <>
      <ContentsListClient
        list={list}
        activeTab={activeTab}
        deleteBook={deleteBook}
        deleteLecture={deleteLecture}
        deleteCustomContent={deleteCustomContent}
      />
      
      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          activeTab={activeTab}
          filters={filters}
          sortBy={sortBy}
        />
      )}
    </>
  );
}

function ContentsListSkeleton() {
  return (
    <ul className="grid gap-4">
      {[1, 2, 3].map((i) => (
        <li
          key={i}
          className="rounded-lg border bg-white p-4 shadow-sm animate-pulse"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-gray-200 rounded w-20"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ContentsList(props: ContentsListProps) {
  return (
    <Suspense fallback={<ContentsListSkeleton />}>
      <ContentsListContent {...props} />
    </Suspense>
  );
}

type Row = { label: string; value: string | number | null };

type ContentFilters = {
  search?: string;
  curriculum_revision_id?: string;
  subject_group_id?: string;
  subject_id?: string;
  publisher_id?: string;
  platform_id?: string;
  difficulty?: string;
};

async function fetchContentsByTab(
  supabase: any,
  tab: TabKey,
  studentId: string,
  filters: ContentFilters = {},
  sortBy: string = "created_at_desc",
  page: number = 1,
  itemsPerPage: number = 20
): Promise<{ list: ContentListItem[]; total: number; totalPages: number }> {
  try {
    if (tab === "books") {
      const selectBooks = () => {
        let query = supabase
          .from("books")
          .select(
            "id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,master_content_id,curriculum_revision_id,subject_group_id,subject_id,publisher_id,created_at"
          );

        // 필터 적용
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }
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
        if (filters.difficulty) {
          query = query.eq("difficulty_level", filters.difficulty);
        }

        // 정렬
        if (sortBy === "title_asc") {
          query = query.order("title", { ascending: true });
        } else if (sortBy === "title_desc") {
          query = query.order("title", { ascending: false });
        } else if (sortBy === "difficulty_level_asc") {
          query = query.order("difficulty_level", { ascending: true });
        } else if (sortBy === "difficulty_level_desc") {
          query = query.order("difficulty_level", { ascending: false });
        } else if (sortBy === "created_at_asc") {
          query = query.order("created_at", { ascending: true });
        } else {
          // created_at_desc (기본값)
          query = query.order("created_at", { ascending: false });
        }

        return query;
      };

      // 전체 개수 조회 (필터 적용된 쿼리 사용)
      const countQuery = selectBooks();
      let { count, error: countError } = await countQuery
        .eq("student_id", studentId)
        .select("*", { count: "exact", head: true });
      
      if (countError && countError.code === "42703") {
        const countQuery2 = selectBooks();
        const { count: count2 } = await countQuery2.select("*", { count: "exact", head: true });
        count = count2;
      }
      
      const total = count ?? 0;
      const totalPages = Math.ceil(total / itemsPerPage);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // 페이지네이션 적용
      const dataQuery = selectBooks();
      let { data, error } = await dataQuery
        .eq("student_id", studentId)
        .range(from, to);
      
      if (error && error.code === "42703") {
        const dataQuery2 = selectBooks();
        ({ data, error } = await dataQuery2.range(from, to));
      }
      if (error) throw error;
      
      return { list: data ?? [], total, totalPages };
    }

    if (tab === "lectures") {
      const selectLectures = () => {
        let query = supabase
          .from("lectures")
          .select(
            "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,total_episodes,linked_book_id,master_content_id,curriculum_revision_id,subject_group_id,subject_id,platform_id,created_at"
          );

        // 필터 적용
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }
        if (filters.curriculum_revision_id) {
          query = query.eq("curriculum_revision_id", filters.curriculum_revision_id);
        }
        if (filters.subject_group_id) {
          query = query.eq("subject_group_id", filters.subject_group_id);
        }
        if (filters.subject_id) {
          query = query.eq("subject_id", filters.subject_id);
        }
        if (filters.platform_id) {
          query = query.eq("platform_id", filters.platform_id);
        }
        if (filters.difficulty) {
          query = query.eq("difficulty_level", filters.difficulty);
        }

        // 정렬
        if (sortBy === "title_asc") {
          query = query.order("title", { ascending: true });
        } else if (sortBy === "title_desc") {
          query = query.order("title", { ascending: false });
        } else if (sortBy === "difficulty_level_asc") {
          query = query.order("difficulty_level", { ascending: true });
        } else if (sortBy === "difficulty_level_desc") {
          query = query.order("difficulty_level", { ascending: false });
        } else if (sortBy === "created_at_asc") {
          query = query.order("created_at", { ascending: true });
        } else {
          // created_at_desc (기본값)
          query = query.order("created_at", { ascending: false });
        }

        return query;
      };

      // 전체 개수 조회 (필터 적용된 쿼리 사용)
      const countQuery = selectLectures();
      let { count, error: countError } = await countQuery
        .eq("student_id", studentId)
        .select("*", { count: "exact", head: true });
      
      if (countError && countError.code === "42703") {
        const countQuery2 = selectLectures();
        const { count: count2 } = await countQuery2.select("*", { count: "exact", head: true });
        count = count2;
      }
      
      const total = count ?? 0;
      const totalPages = Math.ceil(total / itemsPerPage);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // 페이지네이션 적용
      const dataQuery = selectLectures();
      let { data, error } = await dataQuery
        .eq("student_id", studentId)
        .range(from, to);
      
      if (error && error.code === "42703") {
        const dataQuery2 = selectLectures();
        ({ data, error } = await dataQuery2.range(from, to));
      }
      if (error) throw error;
      
      return { list: data ?? [], total, totalPages };
    }

    if (tab === "custom") {
      const selectCustomContents = () => {
        let query = supabase
          .from("student_custom_contents")
          .select(
            "id,title,content_type,total_page_or_time,subject,created_at"
          );

        // 필터 적용
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }
        if (filters.subject_id) {
          // subject_id는 student_custom_contents에 없을 수 있으므로 subject로 필터링
          // 실제로는 subject 필드로만 필터링 가능
        }

        // 정렬
        if (sortBy === "title_asc") {
          query = query.order("title", { ascending: true });
        } else if (sortBy === "title_desc") {
          query = query.order("title", { ascending: false });
        } else if (sortBy === "created_at_asc") {
          query = query.order("created_at", { ascending: true });
        } else {
          // created_at_desc (기본값)
          query = query.order("created_at", { ascending: false });
        }

        return query;
      };

      // 전체 개수 조회
      const countQuery = selectCustomContents();
      let { count, error: countError } = await countQuery
        .eq("student_id", studentId)
        .select("*", { count: "exact", head: true });
      
      if (countError && countError.code === "42703") {
        const countQuery2 = selectCustomContents();
        const { count: count2 } = await countQuery2.select("*", { count: "exact", head: true });
        count = count2;
      }
      
      const total = count ?? 0;
      const totalPages = Math.ceil(total / itemsPerPage);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // 페이지네이션 적용
      const dataQuery = selectCustomContents();
      let { data, error } = await dataQuery
        .eq("student_id", studentId)
        .range(from, to);
      
      if (error && error.code === "42703") {
        const dataQuery2 = selectCustomContents();
        ({ data, error } = await dataQuery2.range(from, to));
      }
      if (error) throw error;
      
      return { list: data ?? [], total, totalPages };
    }

    return { list: [], total: 0, totalPages: 0 };
  } catch (err) {
    console.error(err);
    return { list: [], total: 0, totalPages: 0 };
  }
}

// 클라이언트에서 사용할 수 있도록 함수 export
export function getDetailRows(tab: TabKey, item: ContentListItem): Row[] {
  if (tab === "books") {
    return [
      { label: "개정교육과정", value: item.revision },
      { label: "교과", value: item.subject_category },
      { label: "과목", value: item.subject },
      { label: "출판사", value: item.publisher },
      { label: "난이도", value: item.difficulty_level },
      {
        label: "총 페이지",
        value: item.total_pages ? `${item.total_pages}p` : null,
      },
    ];
  }

  if (tab === "lectures") {
    return [
      { label: "개정교육과정", value: item.revision },
      { label: "교과", value: item.subject_category },
      { label: "과목", value: item.subject },
      { label: "플랫폼", value: item.platform },
      { label: "난이도", value: item.difficulty_level },
      {
        label: "총 회차",
        value: item.total_episodes ? `${item.total_episodes}회` : null,
      },
      {
        label: "재생 시간",
        value: item.duration ? `${Math.round(item.duration / 60)}분` : null,
      },
    ];
  }

  if (tab === "custom") {
    return [
      { label: "콘텐츠 유형", value: item.content_type },
      { label: "과목", value: item.subject },
      {
        label: item.content_type === "book" ? "총 페이지" : "총 시간",
        value: item.total_page_or_time
          ? item.content_type === "book"
            ? `${item.total_page_or_time}p`
            : `${item.total_page_or_time}분`
          : null,
      },
    ];
  }

  return [];
}

export function getSubText(tab: TabKey, item: ContentListItem): string {
  if (tab === "books") return item.publisher || "출판사 정보 없음";
  if (tab === "lectures") return item.platform || "플랫폼 정보 없음";
  if (tab === "custom") return item.content_type || "유형 정보 없음";
  return "";
}

