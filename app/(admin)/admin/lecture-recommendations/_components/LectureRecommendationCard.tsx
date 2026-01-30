"use client";

import Link from "next/link";
import { Star, Users, Video, Monitor, Clock } from "lucide-react";
import type { RecommendedLecture } from "@/lib/domains/plan/llm/actions/coldStart/persistence";

interface LectureRecommendationCardProps {
  lecture: RecommendedLecture;
}

/**
 * 강의 추천 카드 컴포넌트
 */
export function LectureRecommendationCard({ lecture }: LectureRecommendationCardProps) {
  const {
    id,
    title,
    instructorName,
    platform,
    totalEpisodes,
    totalDuration,
    subjectCategory,
    subject,
    difficultyLevel,
    reviewScore,
    reviewCount,
    targetStudents,
  } = lecture;

  // 추천 이유 추출
  const reasons = lecture.recommendationMetadata?.recommendation?.reasons ?? [];

  // 총 시간 포맷팅
  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
    }
    return `${mins}분`;
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* 헤더: 제목 + 평점 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {title}
          </h3>
          {instructorName && (
            <p className="text-sm text-gray-600 mt-1">{instructorName}</p>
          )}
        </div>

        {/* 리뷰 점수 */}
        {reviewScore !== null && (
          <div className="flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 flex-shrink-0">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-700">
              {reviewScore.toFixed(1)}
            </span>
            {reviewCount > 0 && (
              <span className="text-xs text-gray-500">
                ({reviewCount.toLocaleString()})
              </span>
            )}
          </div>
        )}
      </div>

      {/* 교과/과목/난이도 태그 */}
      <div className="flex flex-wrap gap-1.5">
        {subjectCategory && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {subjectCategory}
          </span>
        )}
        {subject && subject !== subjectCategory && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
            {subject}
          </span>
        )}
        {difficultyLevel && (
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            {difficultyLevel}
          </span>
        )}
      </div>

      {/* 플랫폼 + 강의 정보 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {platform && (
          <div className="flex items-center gap-2 text-gray-600">
            <Monitor className="h-4 w-4 text-gray-400" />
            <span>{platform}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-600">
          <Video className="h-4 w-4 text-gray-400" />
          <span>{totalEpisodes}회차</span>
        </div>
        {totalDuration && (
          <div className="flex items-center gap-2 text-gray-600 col-span-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>총 {formatDuration(totalDuration)}</span>
          </div>
        )}
      </div>

      {/* 대상 학생 */}
      {targetStudents.length > 0 && (
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {targetStudents.slice(0, 3).map((target, idx) => (
              <span
                key={idx}
                className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700"
              >
                {target}
              </span>
            ))}
            {targetStudents.length > 3 && (
              <span className="text-xs text-gray-500">
                +{targetStudents.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 추천 이유 */}
      {reasons.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <ul className="space-y-1">
            {reasons.slice(0, 2).map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-green-500">+</span>
                <span className="line-clamp-1">{reason.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 상세보기 버튼 */}
      <Link
        href={`/admin/lecture-recommendations/${id}`}
        className="mt-auto inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        상세보기
      </Link>
    </div>
  );
}

/**
 * 강의 카드 스켈레톤
 */
export function LectureRecommendationCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded mt-1" />
        </div>
        <div className="h-7 w-16 bg-yellow-100 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-blue-100 rounded-full" />
        <div className="h-5 w-12 bg-purple-100 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-5 w-20 bg-gray-100 rounded" />
        <div className="h-5 w-16 bg-gray-100 rounded" />
      </div>
      <div className="h-10 w-full bg-indigo-100 rounded-lg mt-auto" />
    </div>
  );
}
