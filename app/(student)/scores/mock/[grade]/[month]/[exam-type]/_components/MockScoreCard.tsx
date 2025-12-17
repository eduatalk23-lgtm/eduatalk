"use client";

import { memo } from "react";
import { MockScore } from "@/lib/data/studentScores";
import { getGradeColor } from "@/lib/constants/colors";
import { BaseScoreCard } from "@/app/(student)/scores/_components/BaseScoreCard";
import { cn } from "@/lib/cn";

type MockScoreCardProps = {
  score: MockScore;
  subjectGroupName?: string;
  subjectName?: string;
  subjectTypeName?: string;
  onEdit: (score: MockScore) => void;
  onDelete: (scoreId: string) => void;
};

function MockScoreCardComponent({
  score,
  subjectGroupName,
  subjectName,
  subjectTypeName,
  onEdit,
  onDelete,
}: MockScoreCardProps) {
  const gradeColor = getGradeColor(score.grade_score);

  // 등급 배지
  const gradeBadge =
    score.grade_score !== null ? (
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-[var(--elevation-1)]",
          gradeColor.badge
        )}
      >
        {score.grade_score}
      </div>
    ) : null;

  // 기간 배지
  const periodBadge = (
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
      {score.grade}학년 {new Date(score.exam_date).getMonth() + 1}월 {score.exam_title}
    </span>
  );

  // 성적 정보 필드
  const scoreFields = (
    <>
      {score.standard_score !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">표준점수</span>
          <span className="text-base font-semibold text-gray-900">
            {score.standard_score.toLocaleString()}
          </span>
        </div>
      )}
      {score.percentile !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">백분위</span>
          <span className="text-base font-semibold text-gray-900">
            {score.percentile}%
          </span>
        </div>
      )}
      {score.standard_score === null && score.percentile === null && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">표준점수</span>
            <span className="text-base font-semibold text-gray-900">-</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">백분위</span>
            <span className="text-base font-semibold text-gray-900">-</span>
          </div>
        </>
      )}
    </>
  );

  // 상세 다이얼로그 내용
  const detailDialogContent = (
    <>
      {/* 기본 정보 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">과목명</span>
          <p className="text-sm font-medium text-gray-900">
            {subjectName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">교과</span>
          <p className="text-sm font-medium text-gray-900">
            {subjectGroupName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">과목 유형</span>
          <p className="text-sm font-medium text-gray-900">
            {subjectTypeName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">학년/회차/시험유형</span>
          <p className="text-sm font-medium text-gray-900">
            {score.grade}학년 {new Date(score.exam_date).getMonth() + 1}월 {score.exam_title}
          </p>
        </div>
      </div>

      {/* 성적 정보 */}
      <div className="flex flex-col gap-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">성적 정보</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">등급</span>
            <div className="flex items-center gap-2">
              {score.grade_score !== null && (
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    gradeColor.badge
                  )}
                >
                  {score.grade_score}
                </div>
              )}
              {score.grade_score === null && (
                <span className="text-sm font-medium text-gray-900">-</span>
              )}
            </div>
          </div>
          {score.standard_score !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">표준점수</span>
              <p className="text-sm font-medium text-gray-900">
                {score.standard_score}
              </p>
            </div>
          )}
          {score.percentile !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">백분위</span>
              <p className="text-sm font-medium text-gray-900">
                {score.percentile}%
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <BaseScoreCard
      score={score}
      subjectGroupName={subjectGroupName}
      subjectName={subjectName}
      subjectTypeName={subjectTypeName}
      gradeBadge={gradeBadge}
      periodBadge={periodBadge}
      scoreFields={scoreFields}
      detailDialogContent={detailDialogContent}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

export const MockScoreCard = memo(MockScoreCardComponent);

