"use client";

import { memo, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { MockScore } from "@/lib/data/studentScores";
import { getGradeColor } from "@/lib/scores/gradeColors";
import { Dialog } from "@/components/ui/Dialog";
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
  const [isHovered, setIsHovered] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const gradeColor = getGradeColor(score.grade_score);

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border bg-white shadow-sm transition-all duration-200 select-none",
          "hover:shadow-md hover:border-indigo-200",
          isHovered && "shadow-md border-indigo-200"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col gap-5 p-5 md:p-6">
          {/* 헤더: 과목명 및 등급 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {subjectName || "-"}
                </h3>
                {score.grade_score !== null && (
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0 shadow-sm",
                      gradeColor.badge
                    )}
                  >
                    {score.grade_score}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {subjectGroupName && (
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                    {subjectGroupName}
                  </span>
                )}
                {subjectTypeName && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    {subjectTypeName}
                  </span>
                )}
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                  {score.grade}학년 {new Date(score.exam_date).getMonth() + 1}월 {score.exam_title}
                </span>
              </div>
            </div>
          </div>

          {/* 성적 정보 그리드 */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
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
          </div>

          {/* 우상단 액션 버튼 (호버 시 표시) */}
          {isHovered && (
            <div
              data-action-container
              className="absolute top-3 right-3 flex gap-1.5 z-10"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(score);
                }}
                className="rounded-lg bg-white p-2 text-gray-600 shadow-md ring-1 ring-gray-200 transition-all hover:bg-indigo-50 hover:text-indigo-600 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="수정"
                title="수정"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(score.id);
                }}
                className="rounded-lg bg-white p-2 text-gray-600 shadow-md ring-1 ring-gray-200 transition-all hover:bg-red-50 hover:text-red-600 hover:ring-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="삭제"
                title="삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 상세보기 다이얼로그 */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        title="성적 상세 정보"
        maxWidth="lg"
      >
        <div className="flex flex-col gap-6">
          {/* 기본 정보 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-gray-500">과목명</span>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {subjectName || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">교과</span>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {subjectGroupName || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">과목 유형</span>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {subjectTypeName || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">학년/회차/시험유형</span>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {score.grade}학년 {new Date(score.exam_date).getMonth() + 1}월 {score.exam_title}
              </p>
            </div>
          </div>

          {/* 성적 정보 */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">성적 정보</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <span className="text-xs text-gray-500">등급</span>
                <div className="mt-1 flex items-center gap-2">
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
                <div>
                  <span className="text-xs text-gray-500">표준점수</span>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {score.standard_score}
                  </p>
                </div>
              )}
              {score.percentile !== null && (
                <div>
                  <span className="text-xs text-gray-500">백분위</span>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {score.percentile}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              onClick={() => {
                setIsDetailOpen(false);
                onEdit(score);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              수정
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export const MockScoreCard = memo(MockScoreCardComponent);

