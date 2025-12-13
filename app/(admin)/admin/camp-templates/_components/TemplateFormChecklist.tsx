"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/atoms";

type TemplateFormChecklistProps = {
  name?: string;
  programType: string;
  compact?: boolean;
};

export function TemplateFormChecklist({
  name,
  programType,
  compact = false,
}: TemplateFormChecklistProps) {
  const items = [
    {
      id: "name",
      label: "템플릿 이름",
      checked: !!(name && name.trim().length > 0),
      description: "템플릿의 이름을 입력해주세요",
    },
    {
      id: "program_type",
      label: "프로그램 유형",
      checked: !!programType && programType.trim().length > 0,
      description: "프로그램 유형을 선택해주세요 (윈터캠프, 썸머캠프, 파이널캠프, 기타)",
    },
  ];

  const completed = items.filter((item) => item.checked).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">기본 정보</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {completed}/{total}
            </span>
            <ProgressBar
              value={percentage}
              max={100}
              autoColor={true}
              size="sm"
              className="w-24"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보 체크리스트</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              완료: <span className="font-semibold">{completed}/{total}</span>
            </span>
            <div className="flex items-center gap-2">
              <ProgressBar
                value={percentage}
                max={100}
                autoColor={true}
                size="sm"
                className="w-32"
              />
              <span className="text-sm font-medium text-gray-900">{percentage}%</span>
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {item.checked ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                className={cn(
                  "text-sm font-medium",
                  item.checked ? "text-gray-900" : "text-gray-700"
                )}
                >
                  {item.label}
                </span>
              </div>
              {item.description && !item.checked && (
                <p className="text-xs text-gray-700">{item.description}</p>
              )}
            </div>
          </li>
        ))}
        </ul>
      </div>
    </div>
  );
}

