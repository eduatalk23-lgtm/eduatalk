import { DateInput } from "../../../../common/DateInput";
import { FieldError } from "../../../../common/FieldError";

type DirectPeriodInputProps = {
  startDate: string;
  endDate: string;
  minDate: string;
  startDisabled: boolean;
  endDisabled: boolean;
  startError?: string;
  endError?: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
};

export function DirectPeriodInput({
  startDate,
  endDate,
  minDate,
  startDisabled,
  endDisabled,
  startError,
  endError,
  onStartChange,
  onEndChange,
}: DirectPeriodInputProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div data-field-id="period_start">
          <DateInput
            id="direct-start-date-input"
            label="시작일"
            value={startDate}
            onChange={onStartChange}
            disabled={startDisabled}
            min={minDate}
            error={startError}
            dataFieldId="period_start"
          />
          <FieldError error={startError} id="direct-start-date-input-error" />
        </div>
        <div data-field-id="period_end">
          <DateInput
            id="direct-end-date-input"
            label="종료일"
            value={endDate}
            onChange={onEndChange}
            disabled={endDisabled || !startDate}
            min={startDate || minDate}
            error={endError}
            dataFieldId="period_end"
          />
          <FieldError error={endError} id="direct-end-date-input-error" />
        </div>
      </div>
    </div>
  );
}
