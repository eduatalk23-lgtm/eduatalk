"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanGroup } from "@/lib/types/plan";

interface TemplateSelectorProps {
  templates: PlanGroup[];
}

export function TemplateSelector({ templates }: TemplateSelectorProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleContinue = () => {
    if (selectedId) {
      router.push(`/plan/content-add/${selectedId}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleSelect(template.id)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedId === template.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {template.name ?? "이름 없음"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatDate(template.period_start)} ~ {formatDate(template.period_end)}
                </p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  template.status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {template.status === "active" ? "활성" : template.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!selectedId}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          다음
        </button>
      </div>
    </div>
  );
}
