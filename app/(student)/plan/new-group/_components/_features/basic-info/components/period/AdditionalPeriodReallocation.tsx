import { CollapsibleSection } from "../../../../_summary/CollapsibleSection";
import { DateInput } from "../../../../common/DateInput";
import { addDaysToDate } from "@/lib/utils/date";

type AdditionalPeriodReallocationData = {
  period_start: string;
  period_end: string;
  type: "additional_review";
  original_period_start: string;
  original_period_end: string;
  subjects?: string[];
  review_of_review_factor?: number;
};

type AdditionalPeriodReallocationProps = {
  data: AdditionalPeriodReallocationData | undefined;
  periodStart: string;
  periodEnd: string;
  isCampMode: boolean;
  isTemplateMode: boolean;
  canStudentInput: boolean;
  lockedFieldValue: boolean | undefined;
  onToggleFieldControl: (enabled: boolean) => void;
  onEnable: () => void;
  onDisable: () => void;
  onUpdate: (data: AdditionalPeriodReallocationData) => void;
  showError: (message: string) => void;
};

export function AdditionalPeriodReallocation({
  data,
  periodStart,
  periodEnd,
  isCampMode,
  isTemplateMode,
  canStudentInput,
  lockedFieldValue,
  onToggleFieldControl,
  onEnable,
  onDisable,
  onUpdate,
  showError,
}: AdditionalPeriodReallocationProps) {
  const isEnabled = !!data;
  const isDisabled = isCampMode && !canStudentInput;
  const isPeriodValid =
    periodStart &&
    periodEnd &&
    !isNaN(new Date(periodStart).getTime()) &&
    !isNaN(new Date(periodEnd).getTime());

  const handleCheckboxChange = (checked: boolean) => {
    if (isDisabled) return;

    if (checked) {
      if (!periodStart || !periodEnd) {
        showError("학습 기간을 먼저 입력해주세요.");
        return;
      }
      if (!isPeriodValid) {
        showError("유효하지 않은 날짜 형식입니다. 학습 기간을 다시 확인해주세요.");
        return;
      }
      onEnable();
    } else {
      onDisable();
    }
  };

  const handleStartDateChange = (newStartDate: string) => {
    if (isDisabled || !data) return;

    const minDate = periodEnd ? addDaysToDate(periodEnd, 1) : null;

    if (minDate && newStartDate < minDate) {
      showError("추가 기간 시작일은 학습 기간 종료일 다음날부터 가능합니다.");
      return;
    }

    let newEndDate = data.period_end || "";
    if (newEndDate && newEndDate < newStartDate) {
      newEndDate = addDaysToDate(newStartDate, 1);
    }

    onUpdate({
      ...data,
      period_start: newStartDate,
      period_end: newEndDate || addDaysToDate(newStartDate, 1),
    });
  };

  const handleEndDateChange = (newEndDate: string) => {
    if (isDisabled || !data) return;

    const minDate = data.period_start
      ? addDaysToDate(data.period_start, 1)
      : null;

    if (minDate && newEndDate < minDate) {
      showError("추가 기간 종료일은 추가 기간 시작일 다음날부터 가능합니다.");
      return;
    }

    onUpdate({
      ...data,
      period_end: newEndDate,
    });
  };

  const handleStudentToggle = (enabled: boolean) => {
    if (!isEnabled && enabled) {
      showError("재배치 사용을 먼저 체크해주세요.");
      return;
    }
    onToggleFieldControl(enabled);
  };

  return (
    <div>
      <CollapsibleSection
        title="추가 기간 학습 범위 재배치 (선택사항)"
        defaultOpen={isEnabled}
        studentInputAllowed={lockedFieldValue === true}
        onStudentInputToggle={handleStudentToggle}
        showStudentInputToggle={isTemplateMode && isEnabled}
        headerActions={
          <label
            className="flex items-center gap-2 text-xs text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              id="enable_additional_period"
              checked={isEnabled}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              disabled={isDisabled || !isPeriodValid}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className={isDisabled ? "text-gray-900" : ""}>
              재배치 사용
            </span>
          </label>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            추가 기간은 복습일로 계산되며, 학습 기간에 배정된 콘텐츠 범위를 추가
            기간에 다시 분할 배치합니다.
            <br />
            학습 기간 + 추가 기간이 전체 학습 기간이 됩니다.
          </p>

          {data && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
              <div className="grid grid-cols-2 gap-3">
                <DateInput
                  id="additional-period-start-input"
                  label="추가 기간 시작일"
                  labelClassName="text-xs"
                  value={data.period_start}
                  onChange={handleStartDateChange}
                  disabled={isDisabled}
                  min={periodEnd ? addDaysToDate(periodEnd, 1) : undefined}
                />
                <DateInput
                  id="additional-period-end-input"
                  label="추가 기간 종료일"
                  labelClassName="text-xs"
                  value={data.period_end}
                  onChange={handleEndDateChange}
                  disabled={isDisabled}
                  min={
                    data.period_start
                      ? addDaysToDate(data.period_start, 1)
                      : undefined
                  }
                />
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs text-blue-800">
                  <strong>재배치 범위:</strong> {data.original_period_start} ~{" "}
                  {data.original_period_end}
                </p>
                <p className="text-xs text-blue-800">
                  학습 기간의 콘텐츠를 추가 기간에 재배치하여 복습을 진행합니다.
                </p>
                <p className="text-xs text-blue-800">
                  복습 소요시간은 원본 학습 소요시간의 25%로 자동 계산됩니다.
                </p>
              </div>
            </div>
          )}

          {isDisabled && (
            <p className="text-xs text-gray-600">
              추가 기간 학습 범위 재배치는 템플릿에서 고정되어 수정할 수 없습니다.
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
