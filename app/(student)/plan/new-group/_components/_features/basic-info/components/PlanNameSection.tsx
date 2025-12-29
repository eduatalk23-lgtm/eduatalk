import { memo } from "react";
import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { WizardData, TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { FieldErrors } from "../../../hooks/useWizardValidation";
import { FieldError } from "../../../common/FieldError";
import { getFieldErrorClasses } from "../../../common/fieldErrorUtils";
import { cn } from "@/lib/cn";

type Step1FieldName = keyof NonNullable<TemplateLockedFields["step1"]>;

interface PlanNameSectionProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  toggleFieldControl: (fieldName: Step1FieldName, enabled?: boolean) => void;
  canStudentInputName: boolean;
  checkFieldLocked: (fieldName: string) => boolean;
  isDisabled: (condition?: boolean) => boolean;
  lockedFields: Record<string, boolean | undefined>;
  fieldErrors?: FieldErrors;
}

function PlanNameSectionComponent({
  data,
  onUpdate,
  editable,
  isCampMode,
  isTemplateMode,
  toggleFieldControl,
  canStudentInputName,
  checkFieldLocked,
  isDisabled,
  lockedFields,
  fieldErrors,
}: PlanNameSectionProps) {
  return (
    <CollapsibleSection
      title={`${isCampMode ? "캠프 이름" : "플랜 이름"} *`}
      defaultOpen={true}
      studentInputAllowed={lockedFields.allow_student_name === true}
      onStudentInputToggle={(enabled) =>
        toggleFieldControl("allow_student_name", enabled)
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
            if (isCampMode && !canStudentInputName) return;
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
  );
}

export const PlanNameSection = memo(PlanNameSectionComponent);
