import { DateInput } from "../../../../common/DateInput";
import { FieldError } from "../../../../common/FieldError";

type WeeksInputProps = {
  startDate: string;
  weeks: number;
  periodEnd: string;
  minDate: string;
  disabled: boolean;
  error?: string;
  onStartDateChange: (date: string) => void;
  onWeeksChange: (weeks: number) => void;
};

export function WeeksInput({
  startDate,
  weeks,
  periodEnd,
  minDate,
  disabled,
  error,
  onStartDateChange,
  onWeeksChange,
}: WeeksInputProps) {
  const handleDecrement = () => {
    const newWeeks = Math.max(4, weeks - 1);
    onWeeksChange(newWeeks);
  };

  const handleIncrement = () => {
    onWeeksChange(weeks + 1);
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6"
      data-field-id="period_start"
    >
      <DateInput
        id="weeks-start-date-input"
        label="시작일 입력"
        value={startDate}
        onChange={onStartDateChange}
        disabled={disabled}
        min={minDate}
        error={error}
        dataFieldId="period_start"
      />
      <FieldError error={error} id="weeks-start-date-input-error" />

      {startDate && (
        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium text-gray-900">
            학습 주수
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || weeks <= 4}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              -
            </button>
            <div className="min-w-[80px] text-center font-medium text-gray-900">
              {weeks}주
            </div>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={disabled}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              +
            </button>
          </div>
          <p className="text-xs text-gray-600">
            종료일: <span className="font-medium">{periodEnd || "자동 계산됨"}</span>
          </p>
        </div>
      )}
    </div>
  );
}
