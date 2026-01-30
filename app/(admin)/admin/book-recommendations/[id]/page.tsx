import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Users,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Building2,
  FileText,
  Tag,
} from "lucide-react";
import { getContainerClass } from "@/lib/constants/layout";
import { getBookRecommendationById } from "@/lib/domains/plan/llm/actions/coldStart/persistence";
import { cn } from "@/lib/cn";

export default async function BookRecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const book = await getBookRecommendationById(id);

  if (!book) {
    notFound();
  }

  const {
    title,
    author,
    publisherName,
    totalPages,
    subjectCategory,
    subject,
    difficultyLevel,
    reviewScore,
    reviewCount,
    targetStudents,
    recommendationMetadata,
    chapters,
    strengths,
    weaknesses,
  } = book;

  // 추천 이유 추출
  const recommendationReasons = recommendationMetadata?.recommendation?.reasons ?? [];
  const reviewSummary = recommendationMetadata?.reviews;

  return (
    <section className={getContainerClass("CONTENT_DETAIL", "lg")}>
      <div className="flex flex-col gap-8">
        {/* 뒤로가기 */}
        <Link
          href="/admin/book-recommendations"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          교재 추천 목록으로 돌아가기
        </Link>

        {/* 헤더 */}
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {author && (
                <p className="text-lg text-gray-600">{author}</p>
              )}
            </div>

            {/* 출판사 */}
            {publisherName && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="h-4 w-4" />
                <span>{publisherName}</span>
              </div>
            )}

            {/* 태그 */}
            <div className="flex flex-wrap gap-2">
              {subjectCategory && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {subjectCategory}
                </span>
              )}
              {subject && subject !== subjectCategory && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {subject}
                </span>
              )}
              {difficultyLevel && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                  {difficultyLevel}
                </span>
              )}
              {totalPages && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {totalPages}페이지
                </span>
              )}
            </div>
          </div>

          {/* 리뷰 점수 */}
          {reviewScore !== null && (
            <div className="flex flex-col items-center gap-1 rounded-lg bg-yellow-50 px-6 py-4">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-5 w-5",
                      star <= Math.round(reviewScore)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200"
                    )}
                  />
                ))}
              </div>
              <span className="text-2xl font-bold text-yellow-700">
                {reviewScore.toFixed(1)}
              </span>
              {reviewCount > 0 && (
                <span className="text-sm text-gray-500">
                  {reviewCount.toLocaleString()}개 리뷰
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 왼쪽: 추천 정보 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* 추천 이유 */}
            {recommendationReasons.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Tag className="h-5 w-5 text-indigo-600" />
                  추천 이유
                </h2>

                <ul className="space-y-3">
                  {recommendationReasons.map((reason, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg bg-indigo-50 p-3"
                    >
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
                        {reason.category === "quality" && "품질"}
                        {reason.category === "popularity" && "인기"}
                        {reason.category === "suitability" && "적합성"}
                        {reason.category === "structure" && "구성"}
                      </span>
                      <span className="text-gray-700">{reason.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 후기 요약 */}
            {reviewSummary && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  후기 요약
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* 긍정적 후기 */}
                  {reviewSummary.positives && reviewSummary.positives.length > 0 && (
                    <div className="rounded-lg bg-green-50 p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800">
                        <ThumbsUp className="h-4 w-4" />
                        긍정적 후기
                      </h3>
                      <ul className="space-y-1">
                        {reviewSummary.positives.map((positive, idx) => (
                          <li key={idx} className="text-sm text-green-700">
                            + {positive}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 부정적 후기 */}
                  {reviewSummary.negatives && reviewSummary.negatives.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
                        <ThumbsDown className="h-4 w-4" />
                        주의사항
                      </h3>
                      <ul className="space-y-1">
                        {reviewSummary.negatives.map((negative, idx) => (
                          <li key={idx} className="text-sm text-red-700">
                            - {negative}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 키워드 */}
                {reviewSummary.keywords && reviewSummary.keywords.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      자주 언급되는 키워드
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {reviewSummary.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                        >
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 장단점 */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* 장점 */}
              {strengths.length > 0 && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <ThumbsUp className="h-5 w-5 text-green-600" />
                    장점
                  </h2>
                  <ul className="space-y-2">
                    {strengths.map((strength, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-gray-600"
                      >
                        <span className="text-green-500 mt-1">+</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 단점 */}
              {weaknesses.length > 0 && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <ThumbsDown className="h-5 w-5 text-red-500" />
                    주의사항
                  </h2>
                  <ul className="space-y-2">
                    {weaknesses.map((weakness, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-gray-600"
                      >
                        <span className="text-red-500 mt-1">-</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 목차 */}
            {chapters.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                  목차 ({chapters.length}개 챕터)
                </h2>

                <ul className="divide-y divide-gray-100">
                  {chapters.map((chapter, idx) => (
                    <li key={idx} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {chapter.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {chapter.startRange}~{chapter.endRange}페이지
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 오른쪽: 추천 대상 및 요약 */}
          <div className="flex flex-col gap-6">
            {/* 추천 대상 학생 */}
            {targetStudents.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Users className="h-5 w-5 text-green-600" />
                  추천 대상
                </h2>
                <ul className="space-y-2">
                  {targetStudents.map((target, idx) => (
                    <li
                      key={idx}
                      className="rounded-lg bg-green-50 px-4 py-2 text-green-800"
                    >
                      {target}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 요약 정보 */}
            <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                요약
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">출판사</dt>
                  <dd className="font-medium text-gray-900">{publisherName ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">교과</dt>
                  <dd className="font-medium text-gray-900">
                    {subjectCategory ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">과목</dt>
                  <dd className="font-medium text-gray-900">
                    {subject ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">난이도</dt>
                  <dd className="font-medium text-gray-900">
                    {difficultyLevel ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">총 페이지</dt>
                  <dd className="font-medium text-gray-900">
                    {totalPages ? `${totalPages}페이지` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">리뷰 수</dt>
                  <dd className="font-medium text-gray-900">
                    {reviewCount.toLocaleString()}개
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
