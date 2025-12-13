"use client";

import { memo } from "react";
import { SchoolScore } from "@/lib/data/studentScores";
import { getGradeColor } from "@/lib/scores/gradeColors";
import { BaseScoreCard } from "./BaseScoreCard";
import { cn } from "@/lib/cn";

type ScoreCardProps = {
  score: SchoolScore;
  subjectGroupName?: string;
  subjectName?: string;
  subjectTypeName?: string;
  onEdit: (score: SchoolScore) => void;
  onDelete: (scoreId: string) => void;
};

function ScoreCardComponent({
  score,
  subjectGroupName,
  subjectName,
  subjectTypeName,
  onEdit,
  onDelete,
}: ScoreCardProps) {
  const gradeColor = getGradeColor(score.grade_score);

  // 등급 배지
  const gradeBadge =
    score.grade_score !== null ? (
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-sm",
          gradeColor.badge
        )}
      >
        {score.grade_score}
      </div>
    ) : null;

  // 기간 배지
  const periodBadge = (
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
      {score.grade}학년 {score.semester}학기
    </span>
  );

  // 성적 정보 필드
  const scoreFields = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">원점수</span>
        <span className="text-base font-semibold text-gray-900">
          {score.raw_score != null ? score.raw_score.toLocaleString() : "-"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">학점수</span>
        <span className="text-base font-semibold text-gray-900">
          {score.credit_hours !== null ? score.credit_hours : "-"}
        </span>
      </div>
      {score.subject_average !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">과목평균</span>
          <span className="text-base font-semibold text-gray-900">
            {score.subject_average}
          </span>
        </div>
      )}
      {score.class_rank !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">반 석차</span>
          <span className="text-base font-semibold text-gray-900">
            {score.class_rank}등
          </span>
        </div>
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
            {subjectName || score.subject_name || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">교과</span>
          <p className="text-sm font-medium text-gray-900">
            {subjectGroupName || score.subject_group || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">과목 유형</span>
          <p className="text-sm font-medium text-gray-900">
            {subjectTypeName || score.subject_type || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">학년/학기</span>
          <p className="text-sm font-medium text-gray-900">
            {score.grade}학년 {score.semester}학기
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
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">원점수</span>
            <p className="text-sm font-medium text-gray-900">
              {score.raw_score != null ? score.raw_score : "-"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">학점수</span>
            <p className="text-sm font-medium text-gray-900">
              {score.credit_hours !== null ? score.credit_hours : "-"}
            </p>
          </div>
          {score.subject_average !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">과목평균</span>
              <p className="text-sm font-medium text-gray-900">
                {score.subject_average}
              </p>
            </div>
          )}
          {score.standard_deviation !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">표준편차</span>
              <p className="text-sm font-medium text-gray-900">
                {score.standard_deviation}
              </p>
            </div>
          )}
          {score.total_students !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">수강자수</span>
              <p className="text-sm font-medium text-gray-900">
                {score.total_students}명
              </p>
            </div>
          )}
          {score.rank_grade !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">석차등급</span>
              <p className="text-sm font-medium text-gray-900">
                {score.rank_grade}등급
              </p>
            </div>
          )}
          {score.class_rank !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">반 석차</span>
              <p className="text-sm font-medium text-gray-900">
                {score.class_rank}등
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
      subjectName={subjectName || score.subject_name}
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

export const ScoreCard = memo(ScoreCardComponent);

