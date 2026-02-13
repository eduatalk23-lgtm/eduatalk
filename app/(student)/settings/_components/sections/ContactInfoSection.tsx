"use client";

import { memo } from "react";
import { useSettings } from "../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { usePhoneValidation } from "../../_hooks/usePhoneValidation";
import { cn } from "@/lib/cn";
import {
  getFormLabelClasses,
  getFormInputClasses,
  getFormErrorClasses,
} from "@/lib/utils/darkMode";

function ContactInfoSection() {
  const { formData, errors, updateFormData, setErrors } = useSettings();
  const { handlePhoneChange } = usePhoneValidation(updateFormData, setErrors);

  return (
    <SectionCard
      title="연락처 정보"
      description="비상 연락을 위한 연락처 정보입니다"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={getFormLabelClasses()}>
            본인 연락처
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => {
              handlePhoneChange("phone")(e);
              if (errors.phone) {
                setErrors((prev) => ({ ...prev, phone: undefined }));
              }
            }}
            className={getFormInputClasses(!!errors.phone, false, false)}
            placeholder="010-0000-0000"
          />
          {errors.phone && (
            <p className={getFormErrorClasses()}>{errors.phone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={getFormLabelClasses()}>
            모 연락처
          </label>
          <input
            type="tel"
            value={formData.mother_phone}
            onChange={handlePhoneChange("mother_phone")}
            className={getFormInputClasses(false, false, false)}
            placeholder="010-0000-0000"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={getFormLabelClasses()}>
            부 연락처
          </label>
          <input
            type="tel"
            value={formData.father_phone}
            onChange={handlePhoneChange("father_phone")}
            className={getFormInputClasses(false, false, false)}
            placeholder="010-0000-0000"
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default memo(ContactInfoSection);

