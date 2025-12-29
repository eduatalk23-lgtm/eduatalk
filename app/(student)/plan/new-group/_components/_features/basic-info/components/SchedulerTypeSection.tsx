import { memo, useState, useCallback } from "react";
import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { WizardData, TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { FieldErrors } from "../../../hooks/useWizardValidation";
import { FieldError } from "../../../common/FieldError";
import { cn } from "@/lib/cn";

type Step1FieldName = keyof NonNullable<TemplateLockedFields["step1"]>;

const schedulerTypes = [
  { value: "1730_timetable", label: "1730 Timetable" },
] as const;

interface SchedulerTypeSectionProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  toggleFieldControl: (fieldName: Step1FieldName, enabled?: boolean) => void;
  canStudentInputSchedulerType: boolean;
  canStudentInputStudyReviewCycle: boolean;
  isDisabled: (condition?: boolean) => boolean;
  lockedFields: Record<string, boolean | undefined>;
  fieldErrors?: FieldErrors;
}

function SchedulerTypeSectionComponent({
  data,
  onUpdate,
  editable,
  isCampMode,
  isTemplateMode,
  toggleFieldControl,
  canStudentInputSchedulerType,
  canStudentInputStudyReviewCycle,
  isDisabled,
  lockedFields,
  fieldErrors,
}: SchedulerTypeSectionProps) {
  const [show1730Desc, setShow1730Desc] = useState(false);

  // 체크박스 렌더링 헬퍼 함수
  const renderStudentInputCheckbox = useCallback((fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return null;

    return (
      <label className="flex items-center gap-2 text-xs text-gray-800">
        <input
          type="checkbox"
          checked={lockedFields[fieldName] === true}
          onChange={() => toggleFieldControl(fieldName as Step1FieldName)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span>학생 입력 허용</span>
      </label>
    );
  }, [isTemplateMode, lockedFields, toggleFieldControl]);

  const handleSchedulerTypeChange = useCallback((typeValue: string) => {
    if (!editable) return;
    if (isCampMode && !canStudentInputSchedulerType) return;
    onUpdate({
      scheduler_type: (typeValue === "1730_timetable" || typeValue === "")
        ? typeValue
        : "" as WizardData["scheduler_type"],
      scheduler_options: undefined,
    });
    setShow1730Desc(false);
  }, [editable, isCampMode, canStudentInputSchedulerType, onUpdate]);

  const handleStudyDaysChange = useCallback((delta: number) => {
    if (!editable) return;
    if (isCampMode && !canStudentInputStudyReviewCycle) return;

    const currentStudyDays =
      data.scheduler_options?.study_days ??
      data.study_review_cycle?.study_days ??
      6;
    const newStudyDays = Math.min(6, Math.max(1, currentStudyDays + delta));
    const newReviewDays = 7 - newStudyDays;

    onUpdate({
      scheduler_options: {
        ...data.scheduler_options,
        study_days: newStudyDays,
        review_days: newReviewDays,
      },
      study_review_cycle: {
        study_days: newStudyDays,
        review_days: newReviewDays,
      },
    });
  }, [editable, isCampMode, canStudentInputStudyReviewCycle, data.scheduler_options, data.study_review_cycle, onUpdate]);

  const handleReviewDaysChange = useCallback((delta: number) => {
    if (!editable) return;
    if (isCampMode && !canStudentInputStudyReviewCycle) return;

    const currentReviewDays =
      data.scheduler_options?.review_days ??
      data.study_review_cycle?.review_days ??
      1;
    const newReviewDays = Math.min(6, Math.max(1, currentReviewDays + delta));
    const newStudyDays = 7 - newReviewDays;

    onUpdate({
      scheduler_options: {
        ...data.scheduler_options,
        study_days: newStudyDays,
        review_days: newReviewDays,
      },
      study_review_cycle: {
        study_days: newStudyDays,
        review_days: newReviewDays,
      },
    });
  }, [editable, isCampMode, canStudentInputStudyReviewCycle, data.scheduler_options, data.study_review_cycle, onUpdate]);

  const studyDays = data.scheduler_options?.study_days ?? data.study_review_cycle?.study_days ?? 6;
  const reviewDays = data.scheduler_options?.review_days ?? data.study_review_cycle?.review_days ?? 1;

  return (
    <CollapsibleSection
      title="스케줄러 유형 *"
      defaultOpen={false}
      studentInputAllowed={lockedFields.allow_student_scheduler_type === true}
      onStudentInputToggle={(enabled) =>
        toggleFieldControl("allow_student_scheduler_type", enabled)
      }
      showStudentInputToggle={isTemplateMode}
    >
      {/* 스케줄러 유형 선택 (한 줄) */}
      <div
        className={cn(
          "flex gap-2",
          isCampMode && !canStudentInputSchedulerType ? "opacity-60" : ""
        )}
        data-field-id="scheduler_type"
      >
        {schedulerTypes.map((type) => (
          <label
            key={type.value}
            className={cn(
              "flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors",
              isCampMode && !canStudentInputSchedulerType
                ? "cursor-not-allowed bg-gray-100"
                : "cursor-pointer hover:border-gray-300",
              data.scheduler_type === type.value
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-900",
              !!fieldErrors?.get("scheduler_type") &&
                data.scheduler_type !== type.value &&
                "border-red-500"
            )}
          >
            <input
              type="radio"
              name="scheduler_type"
              value={type.value}
              checked={data.scheduler_type === type.value}
              onChange={() => handleSchedulerTypeChange(type.value)}
              disabled={isDisabled(isCampMode && !canStudentInputSchedulerType)}
              className="hidden"
              aria-invalid={!!fieldErrors?.get("scheduler_type")}
              aria-describedby={fieldErrors?.get("scheduler_type") ? "scheduler_type-error" : undefined}
            />
            {type.label}
          </label>
        ))}
      </div>
      <FieldError
        error={fieldErrors?.get("scheduler_type")}
        id="scheduler_type-error"
      />
      {isCampMode && !canStudentInputSchedulerType && (
        <p className="text-xs text-gray-600">
          스케줄러 유형은 템플릿에서 고정되어 수정할 수 없습니다.
        </p>
      )}

      {data.scheduler_type === "1730_timetable" && (
        <div className="space-y-4">
          {/* 설명 토글 */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (!editable) return;
                setShow1730Desc(!show1730Desc);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <span>
                1730 Timetable 동작 방식 {show1730Desc ? "숨기기" : "보기"}
              </span>
              <span className="text-gray-900">
                {show1730Desc ? "▲" : "▼"}
              </span>
            </button>

            {show1730Desc && (
              <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                <h4 className="font-semibold text-blue-800">
                  1730 Timetable 동작 방식
                </h4>
                <ul className="flex flex-col gap-2 text-blue-800">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      주 단위로 학습과 복습을 체계적으로 관리하는
                      스케줄러입니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      기본적으로 <strong>6일 학습 + 1일 복습</strong> 패턴으로
                      구성됩니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      학습일에는 새로운 콘텐츠를 순환 배정하여 다양한 과목을
                      학습합니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      복습일에는 해당 주에 학습한 내용을 복습하여 학습 효과를
                      극대화합니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      학습일과 복습일의 비율을 조절하여 자신에게 맞는 학습
                      패턴을 설정할 수 있습니다. (학습일 + 복습일 = 7일)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      정기적인 복습을 통해 장기 기억 강화와 학습 내용의 완전한
                      이해를 도모합니다.
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* 옵션 */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                1730 Timetable 옵션
              </h3>
              {renderStudentInputCheckbox("allow_student_study_review_cycle")}
            </div>
            <div
              className={`flex flex-col gap-4 ${
                isCampMode && !canStudentInputStudyReviewCycle
                  ? "opacity-60"
                  : ""
              }`}
            >
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-gray-900">
                  학습일 수
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleStudyDaysChange(-1)}
                    disabled={isDisabled(
                      studyDays <= 1 ||
                      (isCampMode && !canStudentInputStudyReviewCycle)
                    )}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    −
                  </button>
                  <div className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-800">
                    {studyDays}일
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStudyDaysChange(1)}
                    disabled={isDisabled(
                      studyDays >= 6 ||
                      (isCampMode && !canStudentInputStudyReviewCycle)
                    )}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium text-gray-900">
                  복습일 수
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewDaysChange(-1)}
                    disabled={isDisabled(
                      reviewDays <= 1 ||
                      (isCampMode && !canStudentInputStudyReviewCycle)
                    )}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    −
                  </button>
                  <div className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-800">
                    {reviewDays}일
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReviewDaysChange(1)}
                    disabled={isDisabled(
                      reviewDays >= 6 ||
                      (isCampMode && !canStudentInputStudyReviewCycle)
                    )}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  학습일 + 복습일 = 7일로 고정됩니다. 복습일은 최소 1일이어야
                  합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

export const SchedulerTypeSection = memo(SchedulerTypeSectionComponent);
