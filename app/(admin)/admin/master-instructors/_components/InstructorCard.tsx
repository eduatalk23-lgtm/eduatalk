"use client";

import Link from "next/link";
import { Star, Users, BookOpen, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

interface InstructorCardProps {
  instructor: {
    id: string;
    name: string;
    platform: string | null;
    subjectCategories: string[];
    teachingStyle: string | null;
    difficultyFocus: string | null;
    reviewScore: number | null;
    reviewCount: number;
    targetStudents: string[];
    strengths: string[];
  };
}

/**
 * 강사 카드 컴포넌트
 */
export function InstructorCard({ instructor }: InstructorCardProps) {
  const {
    id,
    name,
    platform,
    subjectCategories,
    teachingStyle,
    difficultyFocus,
    reviewScore,
    reviewCount,
    targetStudents,
    strengths,
  } = instructor;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* 헤더: 이름 + 플랫폼 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {name}
          </h3>
          {platform && (
            <p className="text-sm text-gray-600">{platform}</p>
          )}
        </div>

        {/* 리뷰 점수 */}
        {reviewScore !== null && (
          <div className="flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1">
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

      {/* 교과 태그 */}
      {subjectCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {subjectCategories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* 스타일 정보 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {teachingStyle && (
          <div className="flex items-center gap-2 text-gray-600">
            <BookOpen className="h-4 w-4 text-gray-400" />
            <span>{teachingStyle}</span>
          </div>
        )}
        {difficultyFocus && (
          <div className="flex items-center gap-2 text-gray-600">
            <Gauge className="h-4 w-4 text-gray-400" />
            <span>{difficultyFocus}</span>
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

      {/* 강점 */}
      {strengths.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <ul className="space-y-1">
            {strengths.slice(0, 2).map((strength, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-green-500">+</span>
                <span className="line-clamp-1">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 상세보기 버튼 */}
      <Link
        href={`/admin/master-instructors/${id}`}
        className="mt-auto inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        상세보기
      </Link>
    </div>
  );
}

/**
 * 강사 카드 스켈레톤
 */
export function InstructorCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded mt-1" />
        </div>
        <div className="h-7 w-16 bg-yellow-100 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-blue-100 rounded-full" />
        <div className="h-5 w-12 bg-blue-100 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-5 w-20 bg-gray-100 rounded" />
        <div className="h-5 w-20 bg-gray-100 rounded" />
      </div>
      <div className="h-10 w-full bg-indigo-100 rounded-lg mt-auto" />
    </div>
  );
}
