"use client";

/**
 * 생성 방법 선택 섹션 컴포넌트
 */

import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textSecondary,
  borderInput,
} from "@/lib/utils/darkMode";
import { Layers } from "lucide-react";
import { useSelection, useFlow } from "../../_context/PlanCreationContext";
import { CREATION_METHODS, type CreationMethod } from "../../_context/types";
import { MethodCard } from "./MethodCard";

export function MethodSelectionSection() {
  const { selectedStudentIds, selectedMethod, selectMethod } = useSelection();
  const { setStep, startCreation } = useFlow();

  const handleMethodSelect = (method: CreationMethod) => {
    selectMethod(method);
  };

  const handleStartCreation = () => {
    if (!selectedMethod) return;
    startCreation();
  };

  return (
    <section
      className={cn(
        "rounded-xl border p-6",
        bgSurface,
        borderInput
      )}
    >
      {/* 섹션 헤더 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className={cn("text-lg font-semibold", textPrimary)}>
            2단계: 생성 방법 선택
          </h2>
          <p className={cn("text-sm", textSecondary)}>
            {selectedStudentIds.size}명의 학생에게 적용할 플랜 생성 방법을 선택하세요
          </p>
        </div>
      </div>

      {/* 방법 카드 그리드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREATION_METHODS.map((method) => (
          <MethodCard
            key={method.id}
            method={method}
            isSelected={selectedMethod === method.id}
            onSelect={() => handleMethodSelect(method.id)}
          />
        ))}
      </div>

      {/* 선택된 방법 정보 및 시작 버튼 */}
      {selectedMethod && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/20">
          <div>
            <p className={cn("font-medium", textPrimary)}>
              <span className="text-purple-600 dark:text-purple-400">
                {CREATION_METHODS.find((m) => m.id === selectedMethod)?.name}
              </span>{" "}
              방법을 선택했습니다
            </p>
            <p className={cn("text-sm", textSecondary)}>
              {selectedStudentIds.size}명의 학생에게 플랜을 생성합니다
            </p>
          </div>
          <button
            onClick={handleStartCreation}
            className={cn(
              "rounded-lg px-6 py-2.5 font-semibold text-white transition",
              "bg-purple-600 hover:bg-purple-700",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            )}
          >
            생성 시작
          </button>
        </div>
      )}
    </section>
  );
}
