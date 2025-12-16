"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormFieldType = "text" | "number" | "select" | "textarea";

type FormFieldOption = {
  value: string;
  label: string;
};

type FormField = {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  colSpan?: 1 | 2; // md:col-span-1 or md:col-span-2
  options?: FormFieldOption[]; // for select type
  min?: number; // for number type
};

type ContentEditFormProps<T extends Record<string, string | number | null | undefined>> = {
  title: string;
  initialData: T;
  fields: FormField[];
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
};

export function ContentEditForm<T extends Record<string, string | number | null | undefined>>({
  title,
  initialData,
  fields,
  onSubmit,
  onCancel,
  isSaving = false,
}: ContentEditFormProps<T>) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      const value = initialData[field.name];
      initial[field.name] = value !== null && value !== undefined ? String(value) : "";
    });
    return initial;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value);
      });

      await onSubmit(formDataObj);
      router.refresh();
    } catch (error) {
      console.error("폼 제출 실패:", error);
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    const reset: Record<string, string> = {};
    fields.forEach((field) => {
      const value = initialData[field.name];
      reset[field.name] = value !== null && value !== undefined ? String(value) : "";
    });
    setFormData(reset);
    onCancel();
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || "";
    const colSpanClass = field.colSpan === 2 ? "md:col-span-2" : "";

    switch (field.type) {
      case "text":
        return (
          <div key={field.name} className={`flex flex-col gap-1 ${colSpanClass}`}>
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              name={field.name}
              type="text"
              required={field.required}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        );

      case "number":
        return (
          <div key={field.name} className={`flex flex-col gap-1 ${colSpanClass}`}>
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              name={field.name}
              type="number"
              required={field.required}
              min={field.min}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        );

      case "select":
        return (
          <div key={field.name} className={`flex flex-col gap-1 ${colSpanClass}`}>
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              name={field.name}
              required={field.required}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case "textarea":
        return (
          <div key={field.name} className={`flex flex-col gap-1 ${colSpanClass}`}>
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              name={field.name}
              required={field.required}
              rows={3}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => renderField(field))}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

