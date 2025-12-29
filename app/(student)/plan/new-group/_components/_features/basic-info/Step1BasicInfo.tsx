import { useContext, memo } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BlockSetSection } from "./components/BlockSetSection";
import { PeriodSection } from "./components/PeriodSection";
import { PlanNameSection } from "./components/PlanNameSection";
import { PlanPurposeSection } from "./components/PlanPurposeSection";
import { SchedulerTypeSection } from "./components/SchedulerTypeSection";
import { useBlockSetManagement } from "./hooks/useBlockSetManagement";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeriodCalculation } from "./hooks/usePeriodCalculation";
import { FieldErrors } from "../../hooks/useWizardValidation";
import { isFieldLocked, toggleFieldControl as toggleFieldControlUtil, updateFieldLock } from "../../utils/fieldLockUtils";
import type { TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { PlanWizardContext } from "../../_context/PlanWizardContext";
import { useFieldPermission } from "../../hooks/useFieldPermission";

type Step1BasicInfoProps = {
  data?: WizardData;
  onUpdate?: (updates: Partial<WizardData>) => void;
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
  templateId?: string;
  isCampMode?: boolean;
  fieldErrors?: FieldErrors;
};

function Step1BasicInfoComponent({
  data: dataProp,
  onUpdate: onUpdateProp,
  blockSets,
  onBlockSetCreated,
  onBlockSetsLoaded,
  editable = true,
  isTemplateMode = false,
  templateId,
  isCampMode = false,
  fieldErrors: fieldErrorsProp,
}: Step1BasicInfoProps) {
  const { showError } = useToast();

  // Context에서 데이터 가져오기 (optional)
  const context = useContext(PlanWizardContext);
  const contextData = context?.state?.wizardData;
  const contextFieldErrors = context?.state?.fieldErrors;
  const contextUpdateData = context?.updateData;

  // Props 우선, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {});
  const fieldErrors = fieldErrorsProp ?? contextFieldErrors;

  // 템플릿 고정 필드
  const lockedFields = data?.templateLockedFields?.step1 || {};

  // 필드 권한 관리 훅
  const { getFieldPermission } = useFieldPermission({
    lockedFields,
    editable,
    isCampMode,
  });

  // 기간 계산 훅
  const periodCalculation = usePeriodCalculation({
    data: data ?? {} as WizardData,
    onUpdate,
    editable,
  });

  // 블록 세트 관리 훅
  const blockSetManagement = useBlockSetManagement({
    data: data ?? {} as WizardData,
    onUpdate,
    blockSets,
    onBlockSetCreated,
    onBlockSetsLoaded,
    isTemplateMode,
    isCampMode,
    templateId,
  });

  // 데이터 없으면 에러 메시지
  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 필드 고정 여부 확인 함수
  const checkFieldLocked = (fieldName: string) => {
    return isFieldLocked(fieldName, lockedFields, isCampMode);
  };

  // 템플릿 모드에서 학생 입력 허용 토글
  const toggleFieldControl = (fieldName: keyof NonNullable<TemplateLockedFields["step1"]>, enabled?: boolean) => {
    if (!isTemplateMode || !data) return;
    const currentLocked = data.templateLockedFields?.step1;
    const newLocked = toggleFieldControlUtil(fieldName, currentLocked, enabled);
    onUpdate(updateFieldLock(data, newLocked));
  };

  // 비활성화 여부 확인
  const isDisabled = (additionalCondition: boolean = false) => {
    return !editable || additionalCondition;
  };

  // 필드별 권한
  const canStudentInputName = getFieldPermission("allow_student_name");
  const canStudentInputPlanPurpose = getFieldPermission("allow_student_plan_purpose");
  const canStudentInputSchedulerType = getFieldPermission("allow_student_scheduler_type");
  const canStudentInputPeriod = getFieldPermission("allow_student_period");
  const canStudentInputBlockSetId = getFieldPermission("allow_student_block_set_id");
  const canStudentInputStudyReviewCycle = getFieldPermission("allow_student_study_review_cycle");
  const canStudentInputAdditionalPeriodReallocation = getFieldPermission("allow_student_additional_period_reallocation");

  return (
    <div className="space-y-6">
      {/* 헤더 */}
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

      {/* 플랜/캠프 이름 */}
      <PlanNameSection
        data={data}
        onUpdate={onUpdate}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        toggleFieldControl={toggleFieldControl}
        canStudentInputName={canStudentInputName}
        checkFieldLocked={checkFieldLocked}
        isDisabled={isDisabled}
        lockedFields={lockedFields}
        fieldErrors={fieldErrors}
      />

      {/* 플랜 목적 */}
      <PlanPurposeSection
        data={data}
        onUpdate={onUpdate}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        toggleFieldControl={toggleFieldControl}
        canStudentInputPlanPurpose={canStudentInputPlanPurpose}
        isDisabled={isDisabled}
        lockedFields={lockedFields}
        fieldErrors={fieldErrors}
      />

      {/* 학습 기간 */}
      <PeriodSection
        data={data}
        onUpdate={onUpdate}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        periodCalculation={periodCalculation}
        toggleFieldControl={toggleFieldControl}
        canStudentInputPeriod={canStudentInputPeriod}
        isFieldLocked={checkFieldLocked}
        isDisabled={isDisabled}
        lockedFields={lockedFields || {}}
        showError={showError}
        canStudentInputAdditionalPeriodReallocation={canStudentInputAdditionalPeriodReallocation}
        fieldErrors={fieldErrors}
      />

      {/* 스케줄러 유형 */}
      <SchedulerTypeSection
        data={data}
        onUpdate={onUpdate}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        toggleFieldControl={toggleFieldControl}
        canStudentInputSchedulerType={canStudentInputSchedulerType}
        canStudentInputStudyReviewCycle={canStudentInputStudyReviewCycle}
        isDisabled={isDisabled}
        lockedFields={lockedFields}
        fieldErrors={fieldErrors}
      />

      {/* 블록 세트 */}
      <BlockSetSection
        data={data}
        onUpdate={onUpdate}
        blockSets={blockSets}
        management={blockSetManagement}
        editable={editable}
        isCampMode={isCampMode}
        isTemplateMode={isTemplateMode}
        toggleFieldControl={toggleFieldControl}
        canStudentInputBlockSetId={canStudentInputBlockSetId}
        lockedFields={lockedFields}
      />
    </div>
  );
}

// React.memo로 최적화
export const Step1BasicInfo = memo(Step1BasicInfoComponent);
