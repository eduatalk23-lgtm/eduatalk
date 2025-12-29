type AddedBlock = {
  day: number;
  startTime: string;
  endTime: string;
};

type AddedBlocksListProps = {
  blocks: AddedBlock[];
  onRemoveBlock: (index: number) => void;
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function AddedBlocksList({ blocks, onRemoveBlock }: AddedBlocksListProps) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          추가된 블록 ({blocks.length}개)
        </h3>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="text-sm text-gray-600">
                {DAY_NAMES[block.day]}요일 {block.startTime} ~ {block.endTime}
              </span>
              <button
                type="button"
                onClick={() => onRemoveBlock(index)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
