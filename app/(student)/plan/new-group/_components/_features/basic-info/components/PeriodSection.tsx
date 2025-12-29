import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { WizardData, TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { usePeriodCalculation } from "../hooks/usePeriodCalculation";
import { getTodayParts, formatDateString, addDaysToDate } from "@/lib/utils/date";
import { FieldErrors } from "../../../hooks/useWizardValidation";
import {
  PeriodInputTypeSelector,
  DdayInput,
  WeeksInput,
  DirectPeriodInput,
  AdditionalPeriodReallocation,
} from "./period";

type Step1FieldName = keyof NonNullable<TemplateLockedFields["step1"]>;

type PeriodSectionProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  periodCalculation: ReturnType<typeof usePeriodCalculation>;
  toggleFieldControl: (fieldName: Step1FieldName, enabled?: boolean) => void;
  canStudentInputPeriod: boolean;
  isFieldLocked: (fieldName: string) => boolean;
  isDisabled: (condition?: boolean) => boolean;
  lockedFields: Record<string, boolean | undefined>;
  showError: (message: string) => void;
  canStudentInputAdditionalPeriodReallocation: boolean;
  fieldErrors?: FieldErrors;
};

export function PeriodSection({
  data,
  onUpdate,
  editable,
  isCampMode,
  isTemplateMode,
  periodCalculation,
  toggleFieldControl,
  canStudentInputPeriod,
  isFieldLocked,
  isDisabled,
  lockedFields,
  showError,
  canStudentInputAdditionalPeriodReallocation,
  fieldErrors,
}: PeriodSectionProps) {
  const {
    periodInputType,
    ddayState,
    weeksState,
    directState,
    setPeriodInputType,
    setDdayState,
    setWeeksState,
    setDirectState,
    calculatePeriodFromWeeks,
    calculatePeriodFromDday,
  } = periodCalculation;

  // 오늘 날짜를 로컬 타임존 기준으로 가져오기
  const todayParts = getTodayParts();
  const today = formatDateString(
    todayParts.year,
    todayParts.month,
    todayParts.day
  );

  // 공통 비활성화 조건
  const periodFieldLocked =
    isFieldLocked("period_start") || isFieldLocked("period_end");
  const periodDisabled = isDisabled(
    periodFieldLocked || (isCampMode && !canStudentInputPeriod)
  );

  // D-day 입력 핸들러
  const handleDdayChange = (date: string) => {
    if (!editable) return;
    if (periodFieldLocked || (isCampMode && !canStudentInputPeriod)) return;

    setDdayState({ date, calculated: !!date });
    if (date) {
      calculatePeriodFromDday(date);
    } else {
      onUpdate({
        period_start: "",
        period_end: "",
        target_date: undefined,
      });
    }
  };

  // 주 단위 시작일 핸들러
  const handleWeeksStartDateChange = (startDate: string) => {
    if (!editable) return;
    if (periodFieldLocked || (isCampMode && !canStudentInputPeriod)) return;

    setWeeksState({ ...weeksState, startDate });
    if (startDate) {
      calculatePeriodFromWeeks(weeksState.weeks, startDate);
    } else {
      onUpdate({ period_start: "", period_end: "" });
    }
  };

  // 주 단위 주수 변경 핸들러
  const handleWeeksChange = (weeks: number) => {
    if (!editable) return;
    if (periodFieldLocked || (isCampMode && !canStudentInputPeriod)) return;

    setWeeksState({ ...weeksState, weeks });
    calculatePeriodFromWeeks(weeks, weeksState.startDate);
  };

  // 직접 입력 시작일 핸들러
  const handleDirectStartChange = (start: string) => {
    if (!editable) return;
    if (isFieldLocked("period_start") || (isCampMode && !canStudentInputPeriod))
      return;

    setDirectState({ ...directState, start });
    onUpdate({ period_start: start });

    // 종료일이 시작일보다 빠르면 초기화
    if (directState.end && start > directState.end) {
      setDirectState((prev: { start: string; end: string }) => ({
        ...prev,
        end: "",
      }));
      onUpdate({ period_end: "" });
    }
  };

  // 직접 입력 종료일 핸들러
  const handleDirectEndChange = (end: string) => {
    if (!editable) return;
    if (isFieldLocked("period_end") || (isCampMode && !canStudentInputPeriod))
      return;

    setDirectState({ ...directState, end });
    onUpdate({ period_end: end });
  };

  // 추가 기간 재배치 활성화 핸들러
  const handleEnableAdditionalPeriod = () => {
    const fourWeeksEndStr = addDaysToDate(data.period_start, 28);
    const originalEndStr =
      fourWeeksEndStr > data.period_end ? data.period_end : fourWeeksEndStr;

    onUpdate({
      additional_period_reallocation: {
        period_start: "",
        period_end: "",
        type: "additional_review",
        original_period_start: data.period_start,
        original_period_end: originalEndStr,
        review_of_review_factor: 0.25,
      },
    });
  };

  return (
    <CollapsibleSection
      title="학습 기간 *"
      defaultOpen={true}
      studentInputAllowed={
        data.templateLockedFields?.step1?.allow_student_period === true
      }
      onStudentInputToggle={(enabled) =>
        toggleFieldControl("allow_student_period", enabled)
      }
      showStudentInputToggle={isTemplateMode}
    >
      <div className="space-y-6">
        {/* 기간 입력 유형 선택 */}
        <PeriodInputTypeSelector
          currentType={periodInputType}
          onTypeChange={setPeriodInputType}
          disabled={!editable}
          isCampMode={isCampMode}
          canStudentInputPeriod={canStudentInputPeriod}
          isFieldLocked={periodFieldLocked}
        />

        {/* D-day 입력 */}
        {periodInputType === "dday" && (
          <DdayInput
            date={ddayState.date}
            calculated={ddayState.calculated}
            periodStart={data.period_start}
            periodEnd={data.period_end}
            minDate={today}
            disabled={periodDisabled}
            error={fieldErrors?.get("period_start")}
            onChange={handleDdayChange}
          />
        )}

        {/* 주 단위 입력 */}
        {periodInputType === "weeks" && (
          <WeeksInput
            startDate={weeksState.startDate}
            weeks={weeksState.weeks}
            periodEnd={data.period_end}
            minDate={today}
            disabled={periodDisabled}
            error={fieldErrors?.get("period_start")}
            onStartDateChange={handleWeeksStartDateChange}
            onWeeksChange={handleWeeksChange}
          />
        )}

        {/* 직접 입력 */}
        {periodInputType === "direct" && (
          <DirectPeriodInput
            startDate={directState.start}
            endDate={directState.end}
            minDate={today}
            startDisabled={isDisabled(
              isFieldLocked("period_start") ||
                (isCampMode && !canStudentInputPeriod)
            )}
            endDisabled={isDisabled(
              isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
            )}
            startError={fieldErrors?.get("period_start")}
            endError={fieldErrors?.get("period_end")}
            onStartChange={handleDirectStartChange}
            onEndChange={handleDirectEndChange}
          />
        )}

        {/* 추가 기간 학습 범위 재배치 (1730 Timetable) */}
        {data.scheduler_type === "1730_timetable" && (
          <AdditionalPeriodReallocation
            data={data.additional_period_reallocation}
            periodStart={data.period_start}
            periodEnd={data.period_end}
            isCampMode={isCampMode}
            isTemplateMode={isTemplateMode}
            canStudentInput={canStudentInputAdditionalPeriodReallocation}
            lockedFieldValue={
              lockedFields.allow_student_additional_period_reallocation
            }
            onToggleFieldControl={(enabled) =>
              toggleFieldControl(
                "allow_student_additional_period_reallocation",
                enabled
              )
            }
            onEnable={handleEnableAdditionalPeriod}
            onDisable={() =>
              onUpdate({ additional_period_reallocation: undefined })
            }
            onUpdate={(reallocationData) =>
              onUpdate({ additional_period_reallocation: reallocationData })
            }
            showError={showError}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
