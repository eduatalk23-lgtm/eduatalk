"use client";

import { Network } from "lucide-react";

export function ConnectionEmptyState({ hasRecords }: { hasRecords: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Network className="h-10 w-10 text-[var(--text-tertiary)]" />
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        {hasRecords ? "감지된 연결이 없습니다" : "기록 데이터가 없습니다"}
      </p>
      <p className="max-w-[260px] text-xs text-[var(--text-tertiary)]">
        {hasRecords
          ? "AI 진단을 실행하거나 스토리라인을 연결하면 영역 간 관계가 표시됩니다"
          : "세특/창체를 입력하면 자동으로 영역 간 연결이 감지됩니다"}
      </p>
    </div>
  );
}
