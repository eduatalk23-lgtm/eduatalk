"use client";

import { ChecklistItem, getCampTemplateChecklist, getChecklistCompletion, groupChecklistByCategory } from "@/lib/utils/campTemplateValidation";
import { CampTemplate } from "@/lib/types/plan";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/atoms";

type TemplateChecklistProps = {
  template: CampTemplate;
  compact?: boolean;
};

export function TemplateChecklist({ template, compact = false }: TemplateChecklistProps) {
  const items = getCampTemplateChecklist(template);
  const { completed, total, percentage } = getChecklistCompletion(items);
  const grouped = groupChecklistByCategory(items);

  const categoryLabels = {
    basic: "기본 정보",
    template_data: "템플릿 데이터",
    wizard_data: "템플릿 설정",
  };

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">필수요소 점검</h3>
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
          <h2 className="text-lg font-semibold text-gray-900">필수요소 점검</h2>
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

        <div className="flex flex-col gap-6">
        {/* 기본 정보 */}
        {grouped.basic.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {categoryLabels.basic}
            </h3>
            <ul className="flex flex-col gap-2">
              {grouped.basic.map((item) => (
                <ChecklistItemComponent key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}

        {/* 템플릿 데이터 */}
        {grouped.template_data.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {categoryLabels.template_data}
            </h3>
            <ul className="flex flex-col gap-2">
              {grouped.template_data.map((item) => (
                <ChecklistItemComponent key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}

        {/* 템플릿 설정 */}
        {grouped.wizard_data.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {categoryLabels.wizard_data}
            </h3>
            <ul className="flex flex-col gap-2">
              {grouped.wizard_data.map((item) => (
                <ChecklistItemComponent key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}
        </div>

        {percentage === 100 && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              모든 필수 항목이 완료되었습니다.
            </p>
          </div>
        )}

        {percentage < 100 && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">
              {total - completed}개의 항목이 아직 완료되지 않았습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

type ChecklistItemComponentProps = {
  item: ChecklistItem;
};

function ChecklistItemComponent({ item }: ChecklistItemComponentProps) {
  return (
    <li className="flex items-start gap-3">
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
  );
}

