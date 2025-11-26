"use client";

import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type TemplateWizardChecklistProps = {
  wizardData: Partial<WizardData>;
  compact?: boolean;
};

/**
 * 템플릿 생성/수정 위저드용 필수요소 체크리스트
 */
export function TemplateWizardChecklist({
  wizardData,
  compact = false,
}: TemplateWizardChecklistProps) {
  const lockedFields = wizardData.templateLockedFields?.step1 || {};

  // 학생 입력 허용 필드 확인 헬퍼
  const isStudentInputAllowed = (fieldName: string): boolean => {
    const allowFieldName = `allow_student_${fieldName}` as keyof typeof lockedFields;
    return lockedFields[allowFieldName] === true;
  };

  const items: Array<{
    id: string;
    label: string;
    checked: boolean;
    description?: string;
    category: "basic" | "wizard_data";
    isOptional?: boolean;
  }> = [];

  // 캠프 이름 (항상 필수)
  items.push({
    id: "name",
    label: "캠프 이름",
    checked: !!(wizardData.name && wizardData.name.trim().length > 0),
    description: "캠프 이름을 입력해주세요",
    category: "basic",
  });

  // 학습 기간 (학생 입력 허용이 아닐 때만 필수)
  if (!isStudentInputAllowed("period")) {
    items.push({
      id: "period",
      label: "학습 기간",
      checked: !!(
        wizardData.period_start &&
        wizardData.period_end &&
        wizardData.period_start.trim().length > 0 &&
        wizardData.period_end.trim().length > 0
      ),
      description: "학습 시작일과 종료일을 설정해주세요",
      category: "wizard_data",
    });
  } else {
    items.push({
      id: "period",
      label: "학습 기간",
      checked: true, // 학생 입력 허용이므로 선택사항으로 표시
      description: "학생이 입력할 항목입니다",
      category: "wizard_data",
      isOptional: true,
    });
  }

  // 블록 세트는 기본값 옵션이 추가되어 체크리스트에서 제외

  // 스케줄러 유형 (학생 입력 허용이 아닐 때만 필수)
  if (!isStudentInputAllowed("scheduler_type")) {
    items.push({
      id: "scheduler_type",
      label: "스케줄러 유형",
      checked: !!(wizardData.scheduler_type && wizardData.scheduler_type.trim().length > 0),
      description: "스케줄러 유형을 선택해주세요",
      category: "wizard_data",
    });
  } else {
    items.push({
      id: "scheduler_type",
      label: "스케줄러 유형",
      checked: true,
      description: "학생이 입력할 항목입니다",
      category: "wizard_data",
      isOptional: true,
    });
  }

  // 학생 수준 항목이 삭제되어 체크리스트에서 제외
  // 과목 배정은 학생 입력폼 제출 후 관리자 영역이므로 체크리스트에서 제외

  const requiredItems = items.filter((item) => !item.isOptional);
  const completedRequired = requiredItems.filter((item) => item.checked).length;
  const totalRequired = requiredItems.length;
  const percentage = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 100;

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">필수요소 점검</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">
              {completedRequired}/{totalRequired}
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  percentage === 100
                    ? "bg-green-500"
                    : percentage >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">필수요소 점검</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            완료: <span className="font-semibold">{completedRequired}/{totalRequired}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  percentage === 100
                    ? "bg-green-500"
                    : percentage >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900">{percentage}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* 템플릿 설정 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">템플릿 설정</h3>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {item.isOptional ? (
                    <Circle className="h-5 w-5 text-gray-300" />
                  ) : item.checked ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        item.isOptional
                          ? "text-gray-500"
                          : item.checked
                          ? "text-gray-900"
                          : "text-gray-600"
                      )}
                    >
                      {item.label}
                      {item.isOptional && (
                        <span className="ml-1 text-xs text-gray-400">(선택)</span>
                      )}
                    </span>
                  </div>
                  {item.description && !item.checked && !item.isOptional && (
                    <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                  )}
                  {item.isOptional && (
                    <p className="mt-1 text-xs text-gray-400 italic">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {percentage === 100 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            모든 필수 항목이 완료되었습니다.
          </p>
        </div>
      )}

      {percentage < 100 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800">
            {totalRequired - completedRequired}개의 필수 항목이 아직 완료되지 않았습니다.
          </p>
        </div>
      )}
    </div>
  );
}

