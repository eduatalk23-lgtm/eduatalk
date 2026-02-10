"use client";

import { useController, type Control } from "react-hook-form";
import { cn } from "@/lib/cn";
import type { AdminStudentFormData } from "../../_types/studentFormTypes";

type ProfileInfoSectionProps = {
  control: Control<AdminStudentFormData>;
  studentEmail: string | null;
  disabled?: boolean;
};

export default function ProfileInfoSection({
  control,
  studentEmail,
  disabled,
}: ProfileInfoSectionProps) {
  const isActiveField = useController({
    name: "is_active",
    control,
  });

  const isActive = isActiveField.field.value ?? true;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">계정 정보</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              계정 (이메일)
            </label>
            <div className="rounded-lg border border-gray-300 bg-[rgb(var(--color-secondary-50))] px-3 py-2 text-sm text-[var(--text-disabled)]">
              {studentEmail ?? "-"}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              이메일은 수정할 수 없습니다.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              활성 상태
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => isActiveField.field.onChange(true)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                활성
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => isActiveField.field.onChange(false)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition",
                  !isActive
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                비활성
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
