import { Suspense } from "react";
import { getContainerClass } from "@/lib/constants/layout";
import {
  getBookRecommendations,
  getAvailablePublishersForRecommendations,
  searchBookRecommendations,
} from "@/lib/domains/plan/llm/actions/coldStart/persistence";
import { BookRecommendationCard, BookRecommendationCardSkeleton } from "./_components/BookRecommendationCard";
import { BookRecommendationFilters } from "./_components/BookRecommendationFilters";

// 사용 가능한 교과 목록
const SUBJECT_CATEGORIES = ["국어", "수학", "영어", "한국사", "사회", "과학"];

export default async function BookRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  // 검색어가 있으면 검색, 없으면 필터 조회
  const hasSearch = Boolean(params.search);

  const result = hasSearch
    ? await searchBookRecommendations(params.search!, {
        subjectCategory: params.subjectCategory,
        difficultyLevel: params.difficultyLevel,
        publisher: params.publisher,
        limit: 50,
      })
    : await getBookRecommendations({
        subjectCategory: params.subjectCategory,
        difficultyLevel: params.difficultyLevel,
        publisher: params.publisher,
        limit: 50,
        orderBy: "review_score",
        orderDirection: "desc",
      });

  // 출판사 목록 조회 (필터용)
  const publishers = await getAvailablePublishersForRecommendations();

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-700">서비스 마스터</p>
          <h1 className="text-3xl font-semibold text-gray-900">교재 추천 관리</h1>
          <p className="text-sm text-gray-700">
            콜드 스타트 시스템에서 수집된 교재 추천 정보를 확인하세요.
          </p>
        </div>

        {/* 검색/필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Suspense fallback={<div className="h-24 animate-pulse bg-gray-100 rounded" />}>
            <BookRecommendationFilters
              publishers={publishers}
              subjectCategories={SUBJECT_CATEGORIES}
              initialValues={{
                search: params.search,
                publisher: params.publisher,
                subjectCategory: params.subjectCategory,
                difficultyLevel: params.difficultyLevel,
              }}
            />
          </Suspense>
        </div>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold">{result.totalCount}</span>권의 교재가
          검색되었습니다.
        </div>

        {/* 교재 목록 */}
        <div>
          {result.books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">📚</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {hasSearch ? "검색 결과가 없습니다" : "등록된 교재 추천이 없습니다"}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {hasSearch
                      ? "다른 검색어로 시도해보세요."
                      : "콜드 스타트 추천을 실행하면 교재 정보가 자동으로 수집됩니다."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.books.map((book) => (
                <li key={book.id}>
                  <BookRecommendationCard book={book} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * 로딩 상태
 */
export function Loading() {
  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>

        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />

        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i}>
              <BookRecommendationCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
