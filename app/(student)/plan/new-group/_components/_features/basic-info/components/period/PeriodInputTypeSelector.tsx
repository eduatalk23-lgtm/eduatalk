type PeriodInputType = "dday" | "weeks" | "direct";

type PeriodInputTypeSelectorProps = {
  currentType: PeriodInputType;
  onTypeChange: (type: PeriodInputType) => void;
  disabled: boolean;
  isCampMode: boolean;
  canStudentInputPeriod: boolean;
  isFieldLocked: boolean;
};

export function PeriodInputTypeSelector({
  currentType,
  onTypeChange,
  disabled,
  isCampMode,
  canStudentInputPeriod,
  isFieldLocked,
}: PeriodInputTypeSelectorProps) {
  const isDisabled = disabled || isFieldLocked || (isCampMode && !canStudentInputPeriod);

  const getButtonClassName = (type: PeriodInputType) => {
    const isSelected = currentType === type;
    const baseClasses = "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors";
    const selectedClasses = isSelected
      ? "border-gray-900 bg-gray-900 text-white"
      : "border-gray-300 text-gray-800 hover:bg-gray-50";
    const disabledClasses = isDisabled ? "cursor-not-allowed opacity-60" : "";

    return `${baseClasses} ${selectedClasses} ${disabledClasses}`;
  };

  return (
    <>
      <div
        className={`flex flex-wrap gap-2 ${isFieldLocked || (isCampMode && !canStudentInputPeriod) ? "opacity-60" : ""}`}
      >
        <button
          type="button"
          onClick={() => onTypeChange("dday")}
          disabled={isDisabled}
          className={getButtonClassName("dday")}
        >
          D-day
        </button>
        <button
          type="button"
          onClick={() => onTypeChange("weeks")}
          disabled={isDisabled}
          className={getButtonClassName("weeks")}
        >
          주 단위
        </button>
        <button
          type="button"
          onClick={() => onTypeChange("direct")}
          disabled={isDisabled}
          className={getButtonClassName("direct")}
        >
          직접 선택
        </button>
      </div>
      {isFieldLocked && (
        <p className="text-xs text-gray-600">
          학습 기간은 템플릿에서 고정되어 있습니다.
        </p>
      )}
      {isCampMode && !canStudentInputPeriod && !isFieldLocked && (
        <p className="text-xs text-gray-600">
          학습 기간은 템플릿에서 고정되어 수정할 수 없습니다.
        </p>
      )}
    </>
  );
}
