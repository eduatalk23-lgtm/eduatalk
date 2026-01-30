import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Users,
  BookOpen,
  Gauge,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Video,
} from "lucide-react";
import { getContainerClass } from "@/lib/constants/layout";
import { getInstructorWithLectures } from "@/lib/domains/plan/llm/actions/coldStart/persistence";
import { cn } from "@/lib/cn";

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const instructor = await getInstructorWithLectures(id);

  if (!instructor) {
    notFound();
  }

  const {
    name,
    platform,
    profileSummary,
    subjectCategories,
    subjects,
    specialty,
    teachingStyle,
    difficultyFocus,
    lecturePace,
    explanationStyle,
    reviewScore,
    reviewCount,
    targetStudents,
    strengths,
    weaknesses,
    lectures,
  } = instructor;

  return (
    <section className={getContainerClass("CONTENT_DETAIL", "lg")}>
      <div className="flex flex-col gap-8">
        {/* 뒤로가기 */}
        <Link
          href="/admin/master-instructors"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          강사 목록으로 돌아가기
        </Link>

        {/* 헤더 */}
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
              {platform && (
                <p className="text-lg text-gray-600">{platform}</p>
              )}
            </div>

            {/* 교과 태그 */}
            {subjectCategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subjectCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                  >
                    {category}
                  </span>
                ))}
                {subjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            )}

            {/* 프로필 요약 */}
            {profileSummary && (
              <p className="text-gray-600 max-w-2xl">{profileSummary}</p>
            )}
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
          {/* 왼쪽: 강의 스타일 정보 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* 강의 스타일 */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                강의 스타일
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {teachingStyle && (
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm text-gray-500">강의 유형</p>
                      <p className="font-medium text-gray-900">{teachingStyle}</p>
                    </div>
                  </div>
                )}

                {difficultyFocus && (
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <Gauge className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm text-gray-500">주력 난이도</p>
                      <p className="font-medium text-gray-900">{difficultyFocus}</p>
                    </div>
                  </div>
                )}

                {lecturePace && (
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm text-gray-500">강의 속도</p>
                      <p className="font-medium text-gray-900">{lecturePace}</p>
                    </div>
                  </div>
                )}

                {explanationStyle && (
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm text-gray-500">설명 방식</p>
                      <p className="font-medium text-gray-900">{explanationStyle}</p>
                    </div>
                  </div>
                )}

                {specialty && (
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4 sm:col-span-2">
                    <Star className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm text-gray-500">전문 영역</p>
                      <p className="font-medium text-gray-900">{specialty}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

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

            {/* 담당 강의 */}
            {lectures.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Video className="h-5 w-5 text-purple-600" />
                  담당 강의 ({lectures.length}개)
                </h2>

                <ul className="divide-y divide-gray-100">
                  {lectures.map((lecture) => (
                    <li key={lecture.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/admin/master-lectures/${lecture.id}`}
                        className="flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {lecture.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {lecture.totalEpisodes}회차
                            {lecture.difficultyLevel && ` · ${lecture.difficultyLevel}`}
                          </p>
                        </div>
                        {lecture.reviewScore !== null && (
                          <div className="flex items-center gap-1 text-sm text-yellow-600">
                            <Star className="h-4 w-4 fill-yellow-400" />
                            {lecture.reviewScore.toFixed(1)}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 오른쪽: 추천 대상 */}
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
                  <dt className="text-gray-500">플랫폼</dt>
                  <dd className="font-medium text-gray-900">{platform ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">담당 교과</dt>
                  <dd className="font-medium text-gray-900">
                    {subjectCategories.join(", ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">강의 수</dt>
                  <dd className="font-medium text-gray-900">{lectures.length}개</dd>
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
