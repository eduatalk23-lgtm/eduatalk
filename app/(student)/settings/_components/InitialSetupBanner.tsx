"use client";

import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import type { StudentFormData } from "../types";

type InitialSetupBannerProps = {
  formData: StudentFormData;
};

/**
 * 초기 설정 모드 배너
 * 필수 필드 완성도를 표시합니다.
 */
export function InitialSetupBanner({ formData }: InitialSetupBannerProps) {
  // 필수 필드 체크
  const requiredFields = [
    { key: "name", label: "이름", value: formData.name },
    { key: "grade", label: "학년", value: formData.grade },
    { key: "birth_date", label: "생년월일", value: formData.birth_date },
  ];

  const completedCount = requiredFields.filter((field) => field.value).length;
  const totalCount = requiredFields.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-6 md:p-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-indigo-900">
            환영합니다! 👋
          </h2>
          <p className="mt-1 text-sm text-indigo-700">
            학습 계획을 시작하기 위해 기본 정보를 입력해주세요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-indigo-900">진행 상황</span>
            <span className="text-indigo-700">
              {completedCount}/{totalCount}
            </span>
          </div>
          <ProgressBar value={progress} className="h-2" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-indigo-900">필수 항목</p>
          <div className="flex flex-col gap-2">
            {requiredFields.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                    field.value
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-indigo-300 bg-white"
                  )}
                >
                  {field.value && (
                    <svg
                      className="h-2.5 w-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={cn(
                    field.value ? "text-indigo-900" : "text-indigo-600"
                  )}
                >
                  {field.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

