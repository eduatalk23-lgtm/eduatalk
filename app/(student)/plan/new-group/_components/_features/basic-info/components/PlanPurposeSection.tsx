import { memo } from "react";
import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { WizardData, TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { FieldErrors } from "../../../hooks/useWizardValidation";
import { FieldError } from "../../../common/FieldError";
import { cn } from "@/lib/cn";

type Step1FieldName = keyof NonNullable<TemplateLockedFields["step1"]>;

const planPurposes: Array<{ value: "내신대비" | "모의고사(수능)" | ""; label: string }> = [
  { value: "내신대비", label: "내신대비" },
  { value: "모의고사(수능)", label: "모의고사(수능)" },
];

interface PlanPurposeSectionProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  toggleFieldControl: (fieldName: Step1FieldName, enabled?: boolean) => void;
  canStudentInputPlanPurpose: boolean;
  isDisabled: (condition?: boolean) => boolean;
  lockedFields: Record<string, boolean | undefined>;
  fieldErrors?: FieldErrors;
}

function PlanPurposeSectionComponent({
  data,
  onUpdate,
  editable,
  isCampMode,
  isTemplateMode,
  toggleFieldControl,
  canStudentInputPlanPurpose,
  isDisabled,
  lockedFields,
  fieldErrors,
}: PlanPurposeSectionProps) {
  return (
    <CollapsibleSection
      title="플랜 목적 *"
      defaultOpen={true}
      studentInputAllowed={lockedFields.allow_student_plan_purpose === true}
      onStudentInputToggle={(enabled) =>
        toggleFieldControl("allow_student_plan_purpose", enabled)
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
                  if (isCampMode && !canStudentInputPlanPurpose) return;
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
  );
}

export const PlanPurposeSection = memo(PlanPurposeSectionComponent);
