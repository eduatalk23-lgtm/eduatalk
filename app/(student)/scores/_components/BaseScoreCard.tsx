"use client";

import { memo, useState, ReactNode } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

type BaseScoreCardProps<T extends { id: string; grade_score: number | null }> = {
  score: T;
  subjectGroupName?: string;
  subjectName?: string;
  subjectTypeName?: string;
  gradeBadge: ReactNode; // 등급 배지
  periodBadge: ReactNode; // 기간/시험 정보 배지
  scoreFields: ReactNode; // 성적 정보 필드들
  detailDialogContent: ReactNode; // 상세 다이얼로그 내용
  onEdit: (score: T) => void;
  onDelete: (scoreId: string) => void;
};

function BaseScoreCardComponent<T extends { id: string; grade_score: number | null }>({
  score,
  subjectGroupName,
  subjectTypeName,
  gradeBadge,
  periodBadge,
  scoreFields,
  detailDialogContent,
  onEdit,
  onDelete,
}: BaseScoreCardProps<T>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border bg-white shadow-sm transition-all duration-200 select-none cursor-pointer",
          "hover:shadow-md hover:border-indigo-200",
          isHovered && "shadow-md border-indigo-200"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          // 액션 버튼 클릭 시에는 다이얼로그를 열지 않음
          if ((e.target as HTMLElement).closest('[data-action-container]')) {
            return;
          }
          setIsDetailOpen(true);
        }}
      >
        <div className="flex flex-col gap-5 p-5 md:p-6">
          {/* 헤더: 과목명 및 등급 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {subjectName || "-"}
                </h3>
                {gradeBadge}
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
                {periodBadge}
              </div>
            </div>
          </div>

          {/* 성적 정보 그리드 */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            {scoreFields}
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
          {detailDialogContent}
          
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

export const BaseScoreCard = memo(BaseScoreCardComponent) as typeof BaseScoreCardComponent;

