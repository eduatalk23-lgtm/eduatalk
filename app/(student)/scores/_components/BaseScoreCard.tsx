"use client";

import { memo, useState, ReactNode } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { bgSurface, textPrimary, textSecondary, textMuted, borderDefault, bgPage } from "@/lib/utils/darkMode";

type BaseScoreCardProps<T extends { id: string; grade_score?: number | null }> = {
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

function BaseScoreCardComponent<T extends { id: string; grade_score?: number | null }>({
  score,
  subjectGroupName,
  subjectName,
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
          "group relative rounded-xl border shadow-[var(--elevation-1)] transition-base select-none cursor-pointer",
          bgSurface,
          borderDefault,
          "hover:shadow-[var(--elevation-4)] hover:border-indigo-200 dark:hover:border-indigo-700",
          isHovered && "shadow-[var(--elevation-4)] border-indigo-200 dark:border-indigo-700"
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
                <h3 className={cn("text-lg font-bold truncate", textPrimary)}>
                  {subjectName || "-"}
                </h3>
                {gradeBadge}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {subjectGroupName && (
                  <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", bgPage, textSecondary, borderDefault)}>
                    {subjectGroupName}
                  </span>
                )}
                {subjectTypeName && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800">
                    {subjectTypeName}
                  </span>
                )}
                {periodBadge}
              </div>
            </div>
          </div>

          {/* 성적 정보 그리드 */}
          <div className={cn("grid grid-cols-2 gap-3 border-t pt-4", borderDefault)}>
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
                className={cn(
                  "rounded-lg p-2 shadow-[var(--elevation-4)] ring-1 transition-base focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  bgSurface,
                  textSecondary,
                  borderDefault,
                  "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:ring-indigo-300 dark:hover:ring-indigo-700"
                )}
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
                className={cn(
                  "rounded-lg p-2 shadow-[var(--elevation-4)] ring-1 transition-base focus:outline-none focus:ring-2 focus:ring-red-500",
                  bgSurface,
                  textSecondary,
                  borderDefault,
                  "hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:ring-red-300 dark:hover:ring-red-700"
                )}
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
          <div className={cn("flex justify-end gap-3 border-t pt-4", borderDefault)}>
            <button
              onClick={() => setIsDetailOpen(false)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-semibold transition",
                bgSurface,
                borderDefault,
                textSecondary,
                "hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
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

