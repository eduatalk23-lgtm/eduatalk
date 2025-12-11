"use client";

type WeekdaySelectorProps = {
  selectedWeekdays: number[];
  onToggle: (day: number) => void;
  onSelectAll: () => void;
  onSelectWeekdays: () => void;
  onSelectWeekends: () => void;
  disabled?: boolean;
};

export function WeekdaySelector({
  selectedWeekdays,
  onToggle,
  onSelectAll,
  onSelectWeekdays,
  onSelectWeekends,
  disabled = false,
}: WeekdaySelectorProps) {
  const days = [
    { value: 0, label: "일" },
    { value: 1, label: "월" },
    { value: 2, label: "화" },
    { value: 3, label: "수" },
    { value: 4, label: "목" },
    { value: 5, label: "금" },
    { value: 6, label: "토" },
  ];

  return (
    <div className="mb-4">
      <label className="mb-2 block text-xs font-medium text-gray-900">
        추가할 요일 선택
      </label>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={onSelectWeekdays}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          평일
        </button>
        <button
          type="button"
          onClick={onSelectWeekends}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          주말
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {days.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => onToggle(day.value)}
            disabled={disabled}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              selectedWeekdays.includes(day.value)
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            {day.label}요일
          </button>
        ))}
      </div>
    </div>
  );
}
