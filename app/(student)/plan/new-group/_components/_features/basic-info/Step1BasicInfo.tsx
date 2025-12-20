import { useState, useContext, memo } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BlockSetSection } from "./components/BlockSetSection";
import { PeriodSection } from "./components/PeriodSection";
import { useBlockSetManagement } from "./hooks/useBlockSetManagement";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog } from "@/components/ui/Dialog";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { BlockSetTimeline } from "../../_components/BlockSetTimeline";
import { CollapsibleSection } from "../../_summary/CollapsibleSection";

import {
  formatDateFromDate,
  parseDateString as parseDateStringUtil,
  getTodayParts,
  formatDateString,
  addDaysToDate,
} from "@/lib/utils/date";
import { usePeriodCalculation } from "./hooks/usePeriodCalculation";
import { FieldErrors } from "../../hooks/useWizardValidation";
import { FieldError } from "../../_components/FieldError";
import { getFieldErrorClasses } from "../../_components/fieldErrorUtils";
import { cn } from "@/lib/cn";
import { isFieldLocked, toggleFieldControl as toggleFieldControlUtil, updateFieldLock } from "../../utils/fieldLockUtils";
import type { TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { PlanWizardContext } from "../../_context/PlanWizardContext";
import { useFieldPermission } from "../../hooks/useFieldPermission";

type Step1BasicInfoProps = {
  data?: WizardData; // Optional: usePlanWizard에서 가져올 수 있음
  onUpdate?: (updates: Partial<WizardData>) => void; // Optional: usePlanWizard에서 가져올 수 있음
  blockSets: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  onBlockSetCreated?: (blockSet: { id: string; name: string }) => void;
  onBlockSetsLoaded?: (
    blockSets: Array<{
      id: string;
      name: string;
      blocks?: Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      }>;
    }>
  ) => void;
  editable?: boolean;
  campTemplateInfo?: {
    name: string;
    program_type: string;
  };
  isTemplateMode?: boolean;
  templateId?: string; // 템플릿 ID (템플릿 모드일 때 필요)
  // 템플릿 고정 필드 관련
  isCampMode?: boolean; // 학생 모드에서 고정 필드 수정 방지
  fieldErrors?: FieldErrors;
};



const planPurposes: Array<{ value: "내신대비" | "모의고사(수능)" | ""; label: string }> = [
  { value: "내신대비", label: "내신대비" },
  { value: "모의고사(수능)", label: "모의고사(수능)" },
];

const schedulerTypes = [
  { value: "1730_timetable", label: "1730 Timetable" },
] as const;

function Step1BasicInfoComponent({
  data: dataProp,
  onUpdate: onUpdateProp,
  blockSets,
  onBlockSetCreated,
  onBlockSetsLoaded,
  editable = true,
  campTemplateInfo,
  isTemplateMode = false,
  templateId,
  isCampMode = false,
  fieldErrors: fieldErrorsProp,
}: Step1BasicInfoProps) {
  const { showError } = useToast();
  
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기) - optional
  // Context가 없으면 props만 사용
  const context = useContext(PlanWizardContext);
  const contextData = context?.state?.wizardData;
  const contextFieldErrors = context?.state?.fieldErrors;
  const contextUpdateData = context?.updateData;
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
  const fieldErrors = fieldErrorsProp ?? contextFieldErrors;

  // data가 없으면 에러 메시지 표시
  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 템플릿 고정 필드 확인
  // templateLockedFields가 없거나 step1이 없으면 빈 객체로 초기화 (모든 필드 입력 가능)
  const lockedFields = data.templateLockedFields?.step1 || {};

  // 필드가 고정되어 있는지 확인 (공통 유틸리티 사용)
  const checkFieldLocked = (fieldName: string) => {
    return isFieldLocked(fieldName, lockedFields, isCampMode);
  };

  // 템플릿 모드에서 학생 입력 허용 토글 (공통 유틸리티 사용)
  const toggleFieldControl = (fieldName: keyof NonNullable<TemplateLockedFields["step1"]>) => {
    if (!isTemplateMode || !data) return;

    const currentLocked = data.templateLockedFields?.step1;
    const newLocked = toggleFieldControlUtil(fieldName, currentLocked);
    onUpdate(updateFieldLock(data, newLocked));
  };

  // 체크박스 렌더링 헬퍼 함수
  const renderStudentInputCheckbox = (fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return null;

    return (
      <label className="flex items-center gap-2 text-xs text-gray-800">
        <input
          type="checkbox"
          checked={lockedFields[fieldName] === true}
          onChange={() => toggleFieldControl(fieldName)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span>학생 입력 허용</span>
      </label>
    );
  };

  // editable={false}일 때 모든 필드 비활성화
  const isDisabled = (additionalCondition: boolean = false) => {
    return !editable || additionalCondition;
  };

  // 필드 권한 관리 훅 사용
  const { getFieldPermission } = useFieldPermission({
    lockedFields,
    editable,
    isCampMode,
  });

  // 각 필드별 입력 가능 여부 (useFieldPermission 훅 사용)
  const canStudentInputName = getFieldPermission("allow_student_name");
  const canStudentInputPlanPurpose = getFieldPermission("allow_student_plan_purpose");
  const canStudentInputSchedulerType = getFieldPermission("allow_student_scheduler_type");
  const canStudentInputPeriod = getFieldPermission("allow_student_period");
  const canStudentInputBlockSetId = getFieldPermission("allow_student_block_set_id");
  const canStudentInputStudentLevel = getFieldPermission("allow_student_student_level");
  const canStudentInputSubjectAllocations = getFieldPermission("allow_student_subject_allocations");
  const canStudentInputStudyReviewCycle = getFieldPermission("allow_student_study_review_cycle");
  const canStudentInputAdditionalPeriodReallocation = getFieldPermission("allow_student_additional_period_reallocation");

  // 오늘 날짜를 로컬 타임존 기준으로 가져오기 (타임존 문제 방지)
  const todayParts = getTodayParts();
  const today = formatDateString(
    todayParts.year,
    todayParts.month,
    todayParts.day
  );


  /* Period calculation hook */
  const periodCalculation = usePeriodCalculation({ data, onUpdate, editable });

  /* block set state removed as it is now in useBlockSetManagement hook */
  const blockSetManagement = useBlockSetManagement({
    data,
    onUpdate,
    blockSets,
    onBlockSetCreated,
    onBlockSetsLoaded,
    isTemplateMode,
    isCampMode,
    templateId,
  });

  const [show1730Desc, setShow1730Desc] = useState(false);

  // Restore show1730Desc since it wasn't moved to the hook?
  // Checking `useBlockSetManagement.ts`... it does not have show1730Desc.
  // I need to keep show1730Desc here or add it to hook.
  // It's related to scheduler type, not block sets. So I keep it here.

  // Oops, I deleted it in the previous step? No, I am replacing the block set state block.
  // I should check if I am deleting show1730Desc.
  // In previous view, lines 241-253 contained `show1730Desc`.
  // My hook does NOT contain `show1730Desc`.
  // So I must re-declare `show1730Desc` here.



  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">
          {isCampMode ? "캠프 기본 정보" : "플랜 기본 정보"}
        </h2>
        <p className="text-sm text-gray-600">
          {isCampMode
            ? "캠프의 목적과 기간, 스케줄러 유형을 설정해주세요."
            : "플랜의 목적과 기간, 스케줄러 유형을 설정해주세요."}
        </p>
      </div>

      {/* 플랜/캠프 이름 (필수) */}
      <CollapsibleSection
        title={`${isCampMode ? "캠프 이름" : "플랜 이름"} *`}
        defaultOpen={true}
        studentInputAllowed={lockedFields.allow_student_name === true}
        onStudentInputToggle={(enabled) =>
          toggleFieldControl("allow_student_name")
        }
        showStudentInputToggle={isTemplateMode}
      >
        <div className="flex flex-col gap-1" data-field-id="plan_name">
          <label
            htmlFor="plan_name"
            className="block text-sm font-medium text-gray-800"
          >
            {isCampMode ? "캠프 이름" : "플랜 이름"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="plan_name"
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:outline-none",
              getFieldErrorClasses(
                "border-gray-300 focus:border-gray-900",
                !!fieldErrors?.get("plan_name")
              ),
              (!editable && !isCampMode) ||
                checkFieldLocked("name") ||
                (isCampMode && !canStudentInputName)
                ? "cursor-not-allowed bg-gray-100 opacity-60"
                : ""
            )}
            placeholder="예: 1학기 중간고사 대비"
            value={data.name || ""}
            onChange={(e) => {
              if (!editable) return;
              onUpdate({ name: e.target.value });
            }}
            disabled={isDisabled(
              checkFieldLocked("name") ||
              (isCampMode && !canStudentInputName)
            )}
            required
            aria-invalid={!!fieldErrors?.get("plan_name")}
            aria-describedby={fieldErrors?.get("plan_name") ? "plan_name-error" : undefined}
          />
          <FieldError
            error={fieldErrors?.get("plan_name")}
            id="plan_name-error"
          />
          {checkFieldLocked("name") && (
            <p className="text-xs text-gray-600">
              이 필드는 템플릿에서 고정되어 있습니다.
            </p>
          )}
          {isCampMode && !canStudentInputName && (
            <p className="text-xs text-gray-600">
              이 필드는 템플릿에서 고정되어 수정할 수 없습니다.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* 플랜 목적 */}
      <CollapsibleSection
        title="플랜 목적 *"
        defaultOpen={true}
        studentInputAllowed={lockedFields.allow_student_plan_purpose === true}
        onStudentInputToggle={(enabled) =>
          toggleFieldControl("allow_student_plan_purpose")
        }
        showStudentInputToggle={isTemplateMode}
      >
        <div
          className={
            !editable || !canStudentInputPlanPurpose ? "opacity-60" : ""
          }
          data-field-id="plan_purpose"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {planPurposes.map((purpose) => (
              <label
                key={purpose.value}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                  !editable || !canStudentInputPlanPurpose
                    ? "cursor-not-allowed bg-gray-100"
                    : "cursor-pointer hover:border-gray-300",
                  data.plan_purpose === purpose.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-800",
                  !!fieldErrors?.get("plan_purpose") &&
                    data.plan_purpose !== purpose.value &&
                    "border-red-500"
                )}
              >
                <input
                  type="radio"
                  name="plan_purpose"
                  value={purpose.value}
                  checked={data.plan_purpose === purpose.value}
                  onChange={() => {
                    if (!editable) return;
                    onUpdate({ 
                      plan_purpose: (purpose.value === "내신대비" || purpose.value === "모의고사(수능)" || purpose.value === "")
                        ? purpose.value
                        : "" as WizardData["plan_purpose"]
                    });
                  }}
                  disabled={isDisabled(
                    isCampMode && !canStudentInputPlanPurpose
                  )}
                  className="hidden"
                  aria-invalid={!!fieldErrors?.get("plan_purpose")}
                  aria-describedby={fieldErrors?.get("plan_purpose") ? "plan_purpose-error" : undefined}
                />
                {purpose.label}
              </label>
            ))}
          </div>
          <FieldError
            error={fieldErrors?.get("plan_purpose")}
            id="plan_purpose-error"
          />
          {isCampMode && !canStudentInputPlanPurpose && (
            <p className="text-xs text-gray-600">
              이 필드는 템플릿에서 고정되어 수정할 수 없습니다.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* 학습 기간 (스케줄러 유형보다 먼저) */}
      <PeriodSection
        data={data}
        onUpdate={onUpdate}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        periodCalculation={periodCalculation}
        toggleFieldControl={toggleFieldControl as (fieldName: string) => void}
        canStudentInputPeriod={canStudentInputPeriod}
        isFieldLocked={checkFieldLocked}
        isDisabled={isDisabled}
        lockedFields={lockedFields || {}}
        showError={showError}
        canStudentInputAdditionalPeriodReallocation={
          canStudentInputAdditionalPeriodReallocation
        }
        fieldErrors={fieldErrors}
      />




      {/* 스케줄러 유형 */}
      <CollapsibleSection
        title="스케줄러 유형 *"
        defaultOpen={false}
        studentInputAllowed={lockedFields.allow_student_scheduler_type === true}
        onStudentInputToggle={(enabled) =>
          toggleFieldControl("allow_student_scheduler_type")
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
                  onChange={() => {
                    if (!editable) return;
                    if (isCampMode && !canStudentInputSchedulerType) return;
                    onUpdate({
                      scheduler_type: (type.value === "1730_timetable" || type.value === "")
                        ? type.value
                        : "" as WizardData["scheduler_type"],
                      scheduler_options: undefined, // 유형 변경 시 옵션 초기화
                    });
                    // 유형 변경 시 설명도 초기화
                    setShow1730Desc(false);
                  }}
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
                      onClick={() => {
                        if (!editable) return;
                        if (isCampMode && !canStudentInputStudyReviewCycle)
                          return;
                        const currentStudyDays =
                          data.scheduler_options?.study_days ??
                          data.study_review_cycle?.study_days ??
                          6;
                        const newStudyDays = Math.max(1, currentStudyDays - 1);
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
                      }}
                      disabled={isDisabled(
                        (data.scheduler_options?.study_days ??
                          data.study_review_cycle?.study_days ??
                          6) <= 1 ||
                        (isCampMode && !canStudentInputStudyReviewCycle)
                      )}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      −
                    </button>
                    <div className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-800">
                      {data.scheduler_options?.study_days ??
                        data.study_review_cycle?.study_days ??
                        6}
                      일
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editable) return;
                        if (isCampMode && !canStudentInputStudyReviewCycle)
                          return;
                        const currentStudyDays =
                          data.scheduler_options?.study_days ??
                          data.study_review_cycle?.study_days ??
                          6;
                        const newStudyDays = Math.min(6, currentStudyDays + 1);
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
                      }}
                      disabled={isDisabled(
                        (data.scheduler_options?.study_days ??
                          data.study_review_cycle?.study_days ??
                          6) >= 6 ||
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
                      onClick={() => {
                        if (!editable) return;
                        if (isCampMode && !canStudentInputStudyReviewCycle)
                          return;
                        const currentReviewDays =
                          data.scheduler_options?.review_days ??
                          data.study_review_cycle?.review_days ??
                          1;
                        const newReviewDays = Math.max(
                          1,
                          currentReviewDays - 1
                        );
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
                      }}
                      disabled={isDisabled(
                        (data.scheduler_options?.review_days ??
                          data.study_review_cycle?.review_days ??
                          1) <= 1 ||
                        (isCampMode && !canStudentInputStudyReviewCycle)
                      )}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      −
                    </button>
                    <div className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-800">
                      {data.scheduler_options?.review_days ??
                        data.study_review_cycle?.review_days ??
                        1}
                      일
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editable) return;
                        if (isCampMode && !canStudentInputStudyReviewCycle)
                          return;
                        const currentReviewDays =
                          data.scheduler_options?.review_days ??
                          data.study_review_cycle?.review_days ??
                          1;
                        const newReviewDays = Math.min(
                          6,
                          currentReviewDays + 1
                        );
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
                      }}
                      disabled={isDisabled(
                        (data.scheduler_options?.review_days ??
                          data.study_review_cycle?.review_days ??
                          1) >= 6 ||
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

      {/* 블록 세트 섹션 */}
      <BlockSetSection
        data={data}
        onUpdate={onUpdate}
        blockSets={blockSets}
        management={blockSetManagement}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        toggleFieldControl={toggleFieldControl as (fieldName: string) => void}
        canStudentInputBlockSetId={canStudentInputBlockSetId}
        lockedFields={lockedFields}
      />

    </div>
  );
}

// React.memo로 최적화: props가 변경되지 않으면 리렌더링 방지
export const Step1BasicInfo = memo(Step1BasicInfoComponent);
