"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * EditableField - 편집/읽기 모드 통합 필드
 * 
 * Phase 5.2에서 구현
 * Step 컴포넌트에서 mode에 따라 다른 UI 표시
 */

export type ViewMode = "edit" | "readonly";

export type EditableFieldProps = {
  label: string;
  value: string | number | null | undefined;
  mode?: ViewMode;
  onChange?: (value: string) => void;
  type?: "text" | "date" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
  locked?: boolean;
  placeholder?: string;
  required?: boolean;
  description?: string;
  emptyText?: string;
};

export const EditableField = React.memo(function EditableField({
  label,
  value,
  mode = "edit",
  onChange,
  type = "text",
  options,
  locked = false,
  placeholder,
  required = false,
  description,
  emptyText = "—",
}: EditableFieldProps) {
  const displayValue = value ?? emptyText;

  // 읽기 전용 모드
  if (mode === "readonly") {
    return (
      <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-lg text-gray-900">
          {type === "select" && options
            ? options.find((opt) => opt.value === value)?.label || displayValue
            : displayValue}
        </dd>
        {description && (
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        )}
      </div>
    );
  }

  // 편집 모드
  return (
    <div>
      <label
        className={cn(
          "block text-sm font-medium text-gray-800",
          required && "after:ml-0.5 after:text-red-500 after:content-['*']"
        )}
      >
        {label}
      </label>
        {description && (
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        )}
      {type === "select" && options ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={locked}
          className={cn(
            "mt-1 block w-full rounded-md border-gray-300 text-gray-900 shadow-sm",
            "focus:border-blue-500 focus:ring-blue-500",
            locked && "cursor-not-allowed bg-gray-100 text-gray-600"
          )}
        >
          <option value="">{placeholder || "선택하세요"}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={locked}
          placeholder={placeholder}
          className={cn(
            "mt-1 block w-full rounded-md border-gray-300 text-gray-900 placeholder:text-gray-600 shadow-sm",
            "focus:border-blue-500 focus:ring-blue-500",
            locked && "cursor-not-allowed bg-gray-100 text-gray-600"
          )}
        />
      )}
      {locked && (
        <p className="mt-1 text-xs text-amber-600">
          이 필드는 템플릿에서 고정되었습니다
        </p>
      )}
    </div>
  );
});

