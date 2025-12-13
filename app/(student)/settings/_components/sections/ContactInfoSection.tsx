"use client";

import { memo } from "react";
import { useSettings } from "../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { usePhoneValidation } from "../../_hooks/usePhoneValidation";
import { cn } from "@/lib/cn";

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
          <label className="text-sm font-medium text-gray-700">
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
            className={cn(
              "rounded-lg border px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2",
              errors.phone
                ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
            )}
            placeholder="010-1234-5678"
          />
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            모 연락처
          </label>
          <input
            type="tel"
            value={formData.mother_phone}
            onChange={handlePhoneChange("mother_phone")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="010-1234-5678"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            부 연락처
          </label>
          <input
            type="tel"
            value={formData.father_phone}
            onChange={handlePhoneChange("father_phone")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="010-1234-5678"
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default memo(ContactInfoSection);

