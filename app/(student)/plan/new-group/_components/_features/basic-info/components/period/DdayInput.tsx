import { DateInput } from "../../../../common/DateInput";
import { FieldError } from "../../../../common/FieldError";

type DdayInputProps = {
  date: string;
  calculated: boolean;
  periodStart: string;
  periodEnd: string;
  minDate: string;
  disabled: boolean;
  error?: string;
  onChange: (date: string) => void;
};

export function DdayInput({
  date,
  calculated,
  periodStart,
  periodEnd,
  minDate,
  disabled,
  error,
  onChange,
}: DdayInputProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6"
      data-field-id="period_start"
    >
      <DateInput
        id="dday-date-input"
        label="시험일 입력"
        value={date}
        onChange={onChange}
        disabled={disabled}
        min={minDate}
        error={error}
        dataFieldId="period_start"
      />
      <FieldError error={error} id="dday-date-input-error" />
      {calculated && periodStart && periodEnd && (
        <div className="flex flex-col gap-1 rounded-lg bg-white p-3">
          <div className="flex flex-col gap-1 text-sm text-gray-600">
            <div className="font-medium text-gray-800">학습 기간</div>
            <div>
              시작일: <span className="font-medium">{periodStart}</span>
            </div>
            <div>
              종료일: <span className="font-medium">{periodEnd}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
