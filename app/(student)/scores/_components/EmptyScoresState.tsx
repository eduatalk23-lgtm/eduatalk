"use client";

import { FileText, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";

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
      <div className="rounded-full bg-gray-100 p-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{message}</h3>
        <p className="text-sm text-gray-500">
          성적을 추가하여 학습 진행 상황을 관리하세요.
        </p>
      </div>
      {onAddClick && (
        <button
          onClick={onAddClick}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </Card>
  );
}









