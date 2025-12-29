import { WeekdaySelector } from "../WeekdaySelector";

type TimeBlockAdderProps = {
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
  buttonText?: string;
  disabled?: boolean;
};

export function TimeBlockAdder({
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
  buttonText = "블록 추가하기",
  disabled = false,
}: TimeBlockAdderProps) {
  const isAddDisabled =
    disabled ||
    selectedWeekdays.length === 0 ||
    !blockStartTime ||
    !blockEndTime;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">시간 블록 추가</h3>

      <WeekdaySelector
        selectedWeekdays={selectedWeekdays}
        onToggle={onToggleWeekday}
        onSelectAll={onSelectAll}
        onSelectWeekdays={onSelectWeekdays}
        onSelectWeekends={onSelectWeekends}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-gray-900">
            시작 시간
          </label>
          <input
            type="time"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            value={blockStartTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-gray-900">
            종료 시간
          </label>
          <input
            type="time"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            value={blockEndTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onAddBlock}
        disabled={isAddDisabled}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {buttonText}
      </button>
    </div>
  );
}
