import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Pagination } from "./Pagination";
import {
  deleteBook,
  deleteLecture,
  deleteCustomContent,
} from "@/lib/domains/content";
import { ContentsListClient } from "./ContentsListClient";
import { EmptyState } from "@/components/molecules/EmptyState";

type TabKey = "books" | "lectures" | "custom";
export type ContentListItem = {
  id: string;
  title: string;
  revision?: string | null | undefined;
  semester?: string | null | undefined;
  subject_category?: string | null | undefined;
  subject?: string | null | undefined;
  publisher?: string | null | undefined;
  platform?: string | null | undefined;
  difficulty_level?: string | null | undefined;
  total_pages?: number | null | undefined;
  total_episodes?: number | null | undefined;
  duration?: number | null | undefined;
  content_type?: string | null | undefined;
  total_page_or_time?: number | null | undefined;
  linked_book_id?: string | null | undefined;
  master_content_id?: string | null | undefined; // 교재용
  master_lecture_id?: string | null | undefined; // 강의용
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
    const emptyStateConfig = {
      books: {
        icon: "📚",
        title: "등록된 책이 없습니다",
        description: "새로운 책을 등록하여 학습을 시작해보세요.",
        actionLabel: "+ 새 교재 등록",
        actionHref: "/contents/books/new",
      },
      lectures: {
        icon: "🎧",
        title: "등록된 강의가 없습니다",
        description: "새로운 강의를 등록하여 학습을 시작해보세요.",
        actionLabel: "+ 새 강의 등록",
        actionHref: "/contents/lectures/new",
      },
      custom: {
        icon: "📝",
        title: "등록된 커스텀 콘텐츠가 없습니다",
        description: "서비스 마스터 커스텀 콘텐츠에서 가져오거나 직접 등록해보세요.",
        actionLabel: "서비스 마스터 커스텀 콘텐츠에서 가져오기",
        actionHref: "/contents/master-custom-contents",
      },
    };

    const config = emptyStateConfig[activeTab];

    return (
      <EmptyState
        icon={config.icon}
        title={config.title}
        description={config.description}
        actionLabel={config.actionLabel}
        actionHref={config.actionHref}
      />
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
    <ul className="grid gap-4 min-h-[400px]">
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
  supabase: SupabaseClient,
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
      const { count: initialCount, error: countError } = await (countQuery
        .eq("student_id", studentId)
        .select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
      let count = initialCount;

      if (ErrorCodeCheckers.isColumnNotFound(countError)) {
        const countQuery2 = selectBooks();
        const { count: count2 } = await (countQuery2.select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
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
      
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
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
            "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,total_episodes,linked_book_id,master_content_id,master_lecture_id,curriculum_revision_id,subject_group_id,subject_id,platform_id,created_at"
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
      const { count: initialCount, error: countError } = await (countQuery
        .eq("student_id", studentId)
        .select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
      let count = initialCount;

      if (ErrorCodeCheckers.isColumnNotFound(countError)) {
        const countQuery2 = selectLectures();
        const { count: count2 } = await (countQuery2.select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
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
      
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
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
      const { count: initialCount, error: countError } = await (countQuery
        .eq("student_id", studentId)
        .select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
      let count = initialCount;

      if (ErrorCodeCheckers.isColumnNotFound(countError)) {
        const countQuery2 = selectCustomContents();
        const { count: count2 } = await (countQuery2.select("*") as unknown as { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null; error: unknown }> }).select("*", { count: "exact", head: true });
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
      
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
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
      { label: "개정교육과정", value: item.revision ?? null },
      { label: "교과", value: item.subject_category ?? null },
      { label: "과목", value: item.subject ?? null },
      { label: "출판사", value: item.publisher ?? null },
      { label: "난이도", value: item.difficulty_level ?? null },
      {
        label: "총 페이지",
        value: item.total_pages ? `${item.total_pages}p` : null,
      },
    ];
  }

  if (tab === "lectures") {
    return [
      { label: "개정교육과정", value: item.revision ?? null },
      { label: "교과", value: item.subject_category ?? null },
      { label: "과목", value: item.subject ?? null },
      { label: "플랫폼", value: item.platform ?? null },
      { label: "난이도", value: item.difficulty_level ?? null },
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
      { label: "콘텐츠 유형", value: item.content_type ?? null },
      { label: "과목", value: item.subject ?? null },
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

