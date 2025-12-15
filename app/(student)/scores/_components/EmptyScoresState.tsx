"use client";

import { FileText, Plus } from "lucide-react";
import { Card } from "@/components/molecules/Card";
import { textPrimary, textMuted, bgPage } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type EmptyScoresStateProps = {
  onAddClick?: () => void;
  message?: string;
  actionLabel?: string;
};

export function EmptyScoresState({
  onAddClick,
  message = "등록된 성적이 없습니다.",
  actionLabel = "성적 추가하기",
}: EmptyScoresStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className={cn("rounded-full p-4", bgPage)}>
        <FileText className={cn("h-8 w-8", textMuted)} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={cn("text-lg font-semibold", textPrimary)}>{message}</h3>
        <p className={cn("text-sm", textMuted)}>
          성적을 추가하여 학습 진행 상황을 관리하세요.
        </p>
      </div>
      {onAddClick && (
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </Card>
  );
}









