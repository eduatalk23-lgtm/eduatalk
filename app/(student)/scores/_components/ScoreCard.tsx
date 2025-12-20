"use client";

import { memo } from "react";
import type { InternalScore } from "@/lib/data/studentScores";
import { getGradeColor } from "@/lib/constants/colors";
import { BaseScoreCard } from "./BaseScoreCard";
import { cn } from "@/lib/cn";
import {
  textMutedVar,
  textPrimaryVar,
  borderDefaultVar,
} from "@/lib/utils/darkMode";

type ScoreCardProps = {
  score: InternalScore;
  subjectGroupName?: string;
  subjectName?: string;
  subjectTypeName?: string;
  onEdit: (score: InternalScore) => void;
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
  const gradeColor = getGradeColor(score.rank_grade);

  // 등급 배지
  const gradeBadge =
    score.rank_grade !== null ? (
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-[var(--elevation-1)]",
          gradeColor.badge
        )}
      >
        {score.rank_grade}
      </div>
    ) : null;

  // 기간 배지
  const periodBadge = (
    <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-200 dark:ring-blue-800">
      {score.grade}학년 {score.semester}학기
    </span>
  );

  // 성적 정보 필드
  const scoreFields = (
    <>
      <div className="flex flex-col gap-1">
        <span className={cn("text-xs font-medium", textMutedVar)}>원점수</span>
        <span className={cn("text-base font-semibold", textPrimaryVar)}>
          {score.raw_score != null ? score.raw_score.toLocaleString() : "-"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className={cn("text-xs font-medium", textMutedVar)}>학점수</span>
        <span className={cn("text-base font-semibold", textPrimaryVar)}>
          {score.credit_hours !== null ? score.credit_hours : "-"}
        </span>
      </div>
      {score.avg_score !== null && (
        <div className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", textMutedVar)}>과목평균</span>
          <span className={cn("text-base font-semibold", textPrimaryVar)}>
            {score.avg_score}
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
          <span className={cn("text-xs", textMutedVar)}>과목명</span>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            {subjectName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className={cn("text-xs", textMutedVar)}>교과</span>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            {subjectGroupName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className={cn("text-xs", textMutedVar)}>과목 유형</span>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            {subjectTypeName || "-"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className={cn("text-xs", textMutedVar)}>학년/학기</span>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            {score.grade}학년 {score.semester}학기
          </p>
        </div>
      </div>

      {/* 성적 정보 */}
      <div className={cn("flex flex-col gap-4 border-t pt-4", borderDefaultVar)}>
        <h3 className={cn("text-sm font-semibold", textPrimaryVar)}>성적 정보</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textMutedVar)}>등급</span>
            <div className="flex items-center gap-2">
              {score.rank_grade !== null && (
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    gradeColor.badge
                  )}
                >
                  {score.rank_grade}
                </div>
              )}
              {score.rank_grade === null && (
                <span className={cn("text-sm font-medium", textPrimaryVar)}>-</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textMutedVar)}>원점수</span>
            <p className={cn("text-sm font-medium", textPrimaryVar)}>
              {score.raw_score != null ? score.raw_score : "-"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textMutedVar)}>학점수</span>
            <p className={cn("text-sm font-medium", textPrimaryVar)}>
              {score.credit_hours !== null ? score.credit_hours : "-"}
            </p>
          </div>
          {score.avg_score !== null && (
            <div className="flex flex-col gap-1">
              <span className={cn("text-xs", textMutedVar)}>과목평균</span>
              <p className={cn("text-sm font-medium", textPrimaryVar)}>
                {score.avg_score}
              </p>
            </div>
          )}
          {score.std_dev !== null && (
            <div className="flex flex-col gap-1">
              <span className={cn("text-xs", textMutedVar)}>표준편차</span>
              <p className={cn("text-sm font-medium", textPrimaryVar)}>
                {score.std_dev}
              </p>
            </div>
          )}
          {score.total_students !== null && (
            <div className="flex flex-col gap-1">
              <span className={cn("text-xs", textMutedVar)}>수강자수</span>
              <p className={cn("text-sm font-medium", textPrimaryVar)}>
                {score.total_students}명
              </p>
            </div>
          )}
          {score.rank_grade !== null && (
            <div className="flex flex-col gap-1">
              <span className={cn("text-xs", textMutedVar)}>석차등급</span>
              <p className={cn("text-sm font-medium", textPrimaryVar)}>
                {score.rank_grade}등급
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
      subjectName={subjectName || undefined}
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

