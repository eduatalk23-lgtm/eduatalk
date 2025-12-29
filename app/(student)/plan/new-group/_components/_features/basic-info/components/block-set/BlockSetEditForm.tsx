import { TimeBlockAdder } from "./TimeBlockAdder";
import { ExistingBlocksList } from "./ExistingBlocksList";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BlockSetEditFormProps = {
  blockSetName: string;
  originalName: string;
  onBlockSetNameChange: (name: string) => void;
  onUpdateName: () => void;
  existingBlocks: Block[];
  selectedWeekdays: number[];
  blockStartTime: string;
  blockEndTime: string;
  onToggleWeekday: (day: number) => void;
  onSelectAll: () => void;
  onSelectWeekdays: () => void;
  onSelectWeekends: () => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onAddBlocks: () => void;
  onDeleteBlock: (blockId: string) => void;
  onCancel: () => void;
  isPending: boolean;
};

export function BlockSetEditForm({
  blockSetName,
  originalName,
  onBlockSetNameChange,
  onUpdateName,
  existingBlocks,
  selectedWeekdays,
  blockStartTime,
  blockEndTime,
  onToggleWeekday,
  onSelectAll,
  onSelectWeekdays,
  onSelectWeekends,
  onStartTimeChange,
  onEndTimeChange,
  onAddBlocks,
  onDeleteBlock,
  onCancel,
  isPending,
}: BlockSetEditFormProps) {
  const isNameChanged = blockSetName.trim() !== originalName;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
      {/* 블록 세트 이름 수정 */}
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-gray-900">
          블록 세트 이름
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
            value={blockSetName}
            onChange={(e) => onBlockSetNameChange(e.target.value)}
          />
          <button
            type="button"
            onClick={onUpdateName}
            disabled={isPending || !blockSetName.trim() || !isNameChanged}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? "저장 중..." : "이름 저장"}
          </button>
        </div>
      </div>

      {/* 현재 블록 목록 */}
      <ExistingBlocksList
        blocks={existingBlocks}
        onDeleteBlock={onDeleteBlock}
        isPending={isPending}
      />

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
        onAddBlock={onAddBlocks}
        buttonText="블록 추가"
      />

      {/* 취소 버튼 */}
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        취소(목록으로)
      </button>
    </div>
  );
}
