"use client";

import { useController, type Control } from "react-hook-form";
import { cn } from "@/lib/cn";
import ProviderBadge, { toAuthProvider, formatRelativeTime } from "@/components/ui/ProviderBadge";
import type { AdminStudentFormData } from "../../_types/studentFormTypes";

type ProfileInfoSectionProps = {
  control: Control<AdminStudentFormData>;
  studentEmail: string | null;
  authProvider?: string;
  lastSignInAt?: string | null;
  disabled?: boolean;
};

export default function ProfileInfoSection({
  control,
  studentEmail,
  authProvider,
  lastSignInAt,
  disabled,
}: ProfileInfoSectionProps) {
  const isActiveField = useController({
    name: "is_active",
    control,
  });

  const isActive = isActiveField.field.value ?? true;
  const provider = toAuthProvider(authProvider ?? "email");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">계정 정보</h3>
        <div className="flex flex-col gap-4">
          {/* 이메일 */}
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

          {/* 로그인 방식 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              로그인 방식
            </label>
            <div className="flex items-center gap-3">
              <ProviderBadge provider={provider} />
              {lastSignInAt && (
                <span className="text-xs text-gray-500">
                  최근 로그인: {formatRelativeTime(lastSignInAt)}
                </span>
              )}
            </div>
          </div>

          {/* 활성 상태 */}
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
