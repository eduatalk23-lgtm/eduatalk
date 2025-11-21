"use client";

import { isValidBlock } from "@/lib/blocks/statistics";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type InvalidBlockWarningProps = {
  blocks: Block[];
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function InvalidBlockWarning({ blocks }: InvalidBlockWarningProps) {
  const invalidBlocks = blocks.filter((block) => !isValidBlock(block));

  if (invalidBlocks.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900 mb-1">
            잘못된 시간 블록이 발견되었습니다
          </h3>
          <p className="text-sm text-amber-800 mb-3">
            종료 시간이 시작 시간보다 작거나 같은 블록이 {invalidBlocks.length}개 있습니다.
            이러한 블록은 통계 계산에서 제외됩니다.
          </p>
          <div className="space-y-1">
            {invalidBlocks.map((block) => (
              <div
                key={block.id}
                className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded"
              >
                {DAYS[block.day_of_week]}요일: {block.start_time} ~ {block.end_time}
                {" (종료 시간이 시작 시간보다 작거나 같음)"}
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-3">
            타임테이블에서 해당 블록을 클릭하여 수정하거나 삭제해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

