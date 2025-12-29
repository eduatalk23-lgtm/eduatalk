type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ExistingBlocksListProps = {
  blocks: Block[];
  onDeleteBlock: (blockId: string) => void;
  isPending: boolean;
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function ExistingBlocksList({
  blocks,
  onDeleteBlock,
  isPending,
}: ExistingBlocksListProps) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-xs text-gray-600">
          이 블록 세트에는 등록된 시간 블록이 없습니다. 아래에서 추가해주세요.
        </p>
      </div>
    );
  }

  // 요일별로 그룹화
  const blocksByDay = blocks.reduce(
    (acc, block) => {
      const day = block.day_of_week;
      if (!acc[day]) acc[day] = [];
      acc[day].push(block);
      return acc;
    },
    {} as Record<number, Block[]>
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        등록된 시간 블록 ({blocks.length}개)
      </h3>
      <div className="space-y-2">
        {Object.entries(blocksByDay).map(([day, dayBlocks]) => (
          <div key={day} className="space-y-1">
            {dayBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-900">
                    {DAY_NAMES[Number(day)]}요일:
                  </span>{" "}
                  <span className="text-xs text-gray-600">
                    {block.start_time} ~ {block.end_time}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteBlock(block.id)}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
