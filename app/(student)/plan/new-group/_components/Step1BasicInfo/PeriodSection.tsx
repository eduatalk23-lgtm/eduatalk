import { CollapsibleSection } from "../_summary/CollapsibleSection";
import { WizardData } from "../PlanGroupWizard";
import { usePeriodCalculation } from "./hooks/usePeriodCalculation";
import { getTodayParts, formatDateString, addDaysToDate } from "@/lib/utils/date";

type PeriodSectionProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  periodCalculation: ReturnType<typeof usePeriodCalculation>;
  toggleFieldControl: (fieldName: string) => void;
  canStudentInputPeriod: boolean;
  isFieldLocked: (fieldName: string) => boolean;
  isDisabled: (condition?: boolean) => boolean;
  lockedFields: Record<string, boolean | undefined>;
  showError: (message: string) => void;
  canStudentInputAdditionalPeriodReallocation: boolean;
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

  // 오늘 날짜를 로컬 타임존 기준으로 가져오기 (타임존 문제 방지)
  const todayParts = getTodayParts();
  const today = formatDateString(
    todayParts.year,
    todayParts.month,
    todayParts.day
  );

  return (
    <CollapsibleSection
      title="학습 기간 *"
      defaultOpen={true}
      studentInputAllowed={
        data.templateLockedFields?.step1?.allow_student_period === true
      }
      onStudentInputToggle={(enabled) =>
        toggleFieldControl("allow_student_period")
      }
      showStudentInputToggle={isTemplateMode}
    >
      {/* 기간 입력 유형 선택 */}
      <div
        className={`flex flex-wrap gap-2 ${
          isFieldLocked("period_start") ||
          isFieldLocked("period_end") ||
          (isCampMode && !canStudentInputPeriod)
            ? "opacity-60"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setPeriodInputType("dday")}
          disabled={isDisabled(
            isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
          )}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            periodInputType === "dday"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-800 hover:bg-gray-50"
          } ${
            isDisabled(
              isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
            )
              ? "cursor-not-allowed opacity-60"
              : ""
          }`}
        >
          D-day
        </button>
        <button
          type="button"
          onClick={() => setPeriodInputType("weeks")}
          disabled={isDisabled(
            isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
          )}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            periodInputType === "weeks"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-800 hover:bg-gray-50"
          } ${
            isDisabled(
              isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
            )
              ? "cursor-not-allowed opacity-60"
              : ""
          }`}
        >
          주 단위
        </button>
        <button
          type="button"
          onClick={() => setPeriodInputType("direct")}
          disabled={isDisabled(
            isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
          )}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            periodInputType === "direct"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-800 hover:bg-gray-50"
          } ${
            isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
              ? "cursor-not-allowed opacity-60"
              : ""
          }`}
        >
          직접 선택
        </button>
      </div>
      {(isFieldLocked("period_start") || isFieldLocked("period_end")) && (
        <p className="text-xs text-gray-600">
          학습 기간은 템플릿에서 고정되어 있습니다.
        </p>
      )}
      {isCampMode && !canStudentInputPeriod && (
        <p className="text-xs text-gray-600">
          학습 기간은 템플릿에서 고정되어 수정할 수 없습니다.
        </p>
      )}

      {/* D-day 입력 */}
      {periodInputType === "dday" && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <label className="block text-sm font-medium text-gray-800">
            시험일 입력
          </label>
          <input
            type="date"
            className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
                ? "cursor-not-allowed bg-gray-100 opacity-60"
                : ""
            }`}
            value={ddayState.date}
            onChange={(e) => {
              if (!editable) return;
              if (
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
              )
                return;
              const date = e.target.value;
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
            }}
            disabled={isDisabled(
              isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
            )}
            min={today}
          />
          {ddayState.calculated && data.period_start && data.period_end && (
            <div className="flex flex-col gap-1 rounded-lg bg-white p-3">
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <div className="font-medium text-gray-800">학습 기간</div>
                <div>
                  시작일:{" "}
                  <span className="font-medium">{data.period_start}</span>
                </div>
                <div>
                  종료일:{" "}
                  <span className="font-medium">{data.period_end}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주 단위 입력 */}
      {periodInputType === "weeks" && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <label className="block text-sm font-medium text-gray-900">
            시작일 입력
          </label>
          <input
            type="date"
            className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
                ? "cursor-not-allowed bg-gray-100 opacity-60"
                : ""
            }`}
            value={weeksState.startDate}
            onChange={(e) => {
              if (!editable) return;
              if (
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
              )
                return;
              const startDate = e.target.value;
              setWeeksState({ ...weeksState, startDate });
              if (startDate) {
                calculatePeriodFromWeeks(weeksState.weeks, startDate);
              } else {
                onUpdate({ period_start: "", period_end: "" });
              }
            }}
            disabled={isDisabled(
              isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
            )}
            min={today}
          />

          {weeksState.startDate && (
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-900">
                학습 주수
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!editable) return;
                    if (
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    )
                      return;
                    const newWeeks = Math.max(4, weeksState.weeks - 1);
                    setWeeksState({ ...weeksState, weeks: newWeeks });
                    calculatePeriodFromWeeks(newWeeks, weeksState.startDate);
                  }}
                  disabled={isDisabled(
                    weeksState.weeks <= 4 ||
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                  )}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  -
                </button>
                <div className="min-w-[80px] text-center font-medium text-gray-900">
                  {weeksState.weeks}주
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!editable) return;
                    if (
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    )
                      return;
                    const newWeeks = weeksState.weeks + 1;
                    setWeeksState({ ...weeksState, weeks: newWeeks });
                    calculatePeriodFromWeeks(newWeeks, weeksState.startDate);
                  }}
                  disabled={isDisabled(
                    isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                  )}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-600">
                종료일:{" "}
                <span className="font-medium">
                  {data.period_end || "자동 계산됨"}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 직접 입력 */}
      {periodInputType === "direct" && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-800">
              시작일
            </label>
            <input
              type="date"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
                isFieldLocked("period_start") ||
                (isCampMode && !canStudentInputPeriod)
                  ? "cursor-not-allowed bg-gray-100 opacity-60"
                  : ""
              }`}
              value={directState.start}
              onChange={(e) => {
                if (!editable) return;
                if (
                  isFieldLocked("period_start") ||
                  (isCampMode && !canStudentInputPeriod)
                )
                  return;
                const start = e.target.value;
                setDirectState({ ...directState, start });
                onUpdate({ period_start: start });

                // 종료일이 시작일보다 빠르면 초기화
                if (directState.end && start > directState.end) {
                  setDirectState((prev) => ({ ...prev, end: "" }));
                  onUpdate({ period_end: "" });
                }
              }}
              disabled={isDisabled(
                isFieldLocked("period_start") ||
                  (isCampMode && !canStudentInputPeriod)
              )}
              min={today}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-800">
              종료일
            </label>
            <input
              type="date"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
                  ? "cursor-not-allowed bg-gray-100 opacity-60"
                  : ""
              }`}
              value={directState.end}
              onChange={(e) => {
                if (!editable) return;
                if (
                  isFieldLocked("period_end") ||
                  (isCampMode && !canStudentInputPeriod)
                )
                  return;
                const end = e.target.value;
                setDirectState({ ...directState, end });
                onUpdate({ period_end: end });
              }}
              disabled={isDisabled(
                !directState.start ||
                  isFieldLocked("period_end") ||
                  (isCampMode && !canStudentInputPeriod)
              )}
              min={directState.start || today}
            />
          </div>
        </div>
      )}
      
      {/* 추가 기간 학습 범위 재배치 (1730 Timetable) */}
      {data.scheduler_type === "1730_timetable" && (
        <div>
          <CollapsibleSection
            title="추가 기간 학습 범위 재배치 (선택사항)"
            defaultOpen={!!data.additional_period_reallocation}
            studentInputAllowed={
              lockedFields.allow_student_additional_period_reallocation === true
            }
            onStudentInputToggle={(enabled) => {
              if (!data.additional_period_reallocation && enabled) {
                showError("재배치 사용을 먼저 체크해주세요.");
                return;
              }
              toggleFieldControl("allow_student_additional_period_reallocation");
            }}
            showStudentInputToggle={
              isTemplateMode && !!data.additional_period_reallocation
            }
            headerActions={
              <label
                className="flex items-center gap-2 text-xs text-gray-800"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  id="enable_additional_period"
                  checked={!!data.additional_period_reallocation}
                  onChange={(e) => {
                    if (
                      isCampMode &&
                      !canStudentInputAdditionalPeriodReallocation
                    )
                      return;
                    if (e.target.checked) {
                      if (!data.period_start || !data.period_end) {
                        showError("학습 기간을 먼저 입력해주세요.");
                        e.target.checked = false;
                        return;
                      }
                      if (!data.period_start || !data.period_end) {
                        showError(
                          "유효하지 않은 날짜 형식입니다. 학습 기간을 다시 확인해주세요."
                        );
                        e.target.checked = false;
                        return;
                      }

                      const fourWeeksEndStr = addDaysToDate(
                        data.period_start,
                        28
                      );
                      const originalEndStr =
                        fourWeeksEndStr > data.period_end
                          ? data.period_end
                          : fourWeeksEndStr;

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
                    } else {
                      onUpdate({ additional_period_reallocation: undefined });
                    }
                  }}
                  disabled={
                    (isCampMode &&
                      !canStudentInputAdditionalPeriodReallocation) ||
                    !data.period_start ||
                    !data.period_end ||
                    isNaN(new Date(data.period_start).getTime()) ||
                    isNaN(new Date(data.period_end).getTime())
                  }
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span
                  className={
                    isCampMode && !canStudentInputAdditionalPeriodReallocation
                      ? "text-gray-900"
                      : ""
                  }
                >
                  재배치 사용
                </span>
              </label>
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                추가 기간은 복습일로 계산되며, 학습 기간에 배정된 콘텐츠
                범위를 추가 기간에 다시 분할 배치합니다.
                <br />
                학습 기간 + 추가 기간이 전체 학습 기간이 됩니다.
              </p>

              {data.additional_period_reallocation && (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-900">
                        추가 기간 시작일
                      </label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                            ? "cursor-not-allowed bg-gray-100 opacity-60"
                            : ""
                        }`}
                        value={
                          data.additional_period_reallocation.period_start
                        }
                        min={
                          data.period_end
                            ? addDaysToDate(data.period_end, 1)
                            : undefined
                        }
                        onChange={(e) => {
                          if (
                            isCampMode &&
                            !canStudentInputAdditionalPeriodReallocation
                          )
                            return;

                          const newStartDate = e.target.value;
                          const minDate = data.period_end
                            ? addDaysToDate(data.period_end, 1)
                            : null;

                          if (minDate && newStartDate < minDate) {
                            showError(
                              "추가 기간 시작일은 학습 기간 종료일 다음날부터 가능합니다."
                            );
                            return;
                          }

                          let newEndDate =
                            data.additional_period_reallocation?.period_end || "";
                          if (newEndDate && newEndDate < newStartDate) {
                            newEndDate = addDaysToDate(newStartDate, 1);
                          }

                          onUpdate({
                            additional_period_reallocation: {
                              ...data.additional_period_reallocation!,
                              period_start: newStartDate,
                              period_end: newEndDate || addDaysToDate(newStartDate, 1),
                            },
                          });
                        }}
                        disabled={
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-900">
                        추가 기간 종료일
                      </label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none ${
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                            ? "cursor-not-allowed bg-gray-100 opacity-60"
                            : ""
                        }`}
                        value={data.additional_period_reallocation.period_end}
                        min={
                          data.additional_period_reallocation.period_start
                            ? addDaysToDate(
                                data.additional_period_reallocation
                                  .period_start,
                                1
                              )
                            : undefined
                        }
                        onChange={(e) => {
                          if (
                            isCampMode &&
                            !canStudentInputAdditionalPeriodReallocation
                          )
                            return;

                          const newEndDate = e.target.value;
                          const minDate = data.additional_period_reallocation
                            ?.period_start
                            ? addDaysToDate(
                                data.additional_period_reallocation!
                                  .period_start,
                                1
                              )
                            : null;

                          if (minDate && newEndDate < minDate) {
                            showError(
                              "추가 기간 종료일은 추가 기간 시작일 다음날부터 가능합니다."
                            );
                            return;
                          }

                          onUpdate({
                            additional_period_reallocation: {
                              ...data.additional_period_reallocation!,
                              period_end: newEndDate,
                            },
                          });
                        }}
                        disabled={
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs text-blue-800">
                      <strong>재배치 범위:</strong>{" "}
                      {
                        data.additional_period_reallocation
                          .original_period_start
                      }{" "}
                      ~{" "}
                      {
                        data.additional_period_reallocation
                          .original_period_end
                      }
                    </p>
                    <p className="text-xs text-blue-800">
                      학습 기간의 콘텐츠를 추가 기간에 재배치하여 복습을
                      진행합니다.
                    </p>
                    <p className="text-xs text-blue-800">
                      복습 소요시간은 원본 학습 소요시간의 25%로 자동
                      계산됩니다.
                    </p>
                  </div>
                </div>
              )}

              {isCampMode && !canStudentInputAdditionalPeriodReallocation && (
                <p className="text-xs text-gray-600">
                  추가 기간 학습 범위 재배치는 템플릿에서 고정되어 수정할 수
                  없습니다.
                </p>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </CollapsibleSection>
  );
}
