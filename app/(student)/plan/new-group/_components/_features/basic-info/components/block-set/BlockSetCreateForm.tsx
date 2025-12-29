import { TimeBlockAdder } from "./TimeBlockAdder";
import { AddedBlocksList } from "./AddedBlocksList";

type AddedBlock = {
  day: number;
  startTime: string;
  endTime: string;
};

type BlockSetCreateFormProps = {
  blockSetName: string;
  onBlockSetNameChange: (name: string) => void;
  selectedWeekdays: number[];
  blockStartTime: string;
  blockEndTime: string;
  onToggleWeekday: (day: number) => void;
  onSelectAll: () => void;
  onSelectWeekdays: () => void;
  onSelectWeekends: () => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onAddBlock: () => void;
  addedBlocks: AddedBlock[];
  onRemoveBlock: (index: number) => void;
  onCancel: () => void;
  onCreate: () => void;
  isPending: boolean;
};

export function BlockSetCreateForm({
  blockSetName,
  onBlockSetNameChange,
  selectedWeekdays,
  blockStartTime,
  blockEndTime,
  onToggleWeekday,
  onSelectAll,
  onSelectWeekdays,
  onSelectWeekends,
  onStartTimeChange,
  onEndTimeChange,
  onAddBlock,
  addedBlocks,
  onRemoveBlock,
  onCancel,
  onCreate,
  isPending,
}: BlockSetCreateFormProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
      {/* 블록 세트 이름 */}
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-gray-900">
          블록 세트 이름
        </label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
          placeholder="예: 평일 학습 블록"
          value={blockSetName}
          onChange={(e) => onBlockSetNameChange(e.target.value)}
        />
      </div>

      {/* 시간 블록 추가 */}
      <TimeBlockAdder
        selectedWeekdays={selectedWeekdays}
        blockStartTime={blockStartTime}
        blockEndTime={blockEndTime}
        onToggleWeekday={onToggleWeekday}
        onSelectAll={onSelectAll}
        onSelectWeekdays={onSelectWeekdays}
        onSelectWeekends={onSelectWeekends}
        onStartTimeChange={onStartTimeChange}
        onEndTimeChange={onEndTimeChange}
        onAddBlock={onAddBlock}
        buttonText="블록 추가하기"
      />

      {/* 추가된 블록 목록 */}
      <AddedBlocksList
        blocks={addedBlocks}
        onRemoveBlock={onRemoveBlock}
      />

      {/* 생성 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isPending || !blockSetName.trim()}
          className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isPending ? "생성 중..." : "블록 세트 생성"}
        </button>
      </div>
    </div>
  );
}
