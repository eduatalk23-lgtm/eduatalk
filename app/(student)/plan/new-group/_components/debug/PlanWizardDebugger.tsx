"use client";

import { useState, useMemo } from "react";
import { usePlanWizard } from "../_context/PlanWizardContext";
import { validateStep } from "../utils/planValidation";
import type { WizardData } from "@/lib/schemas/planWizardSchema";

/**
 * PlanWizardDebugger Props
 */
type PlanWizardDebuggerProps = {
  isAdminMode: boolean;
  isTemplateMode: boolean;
  isCampMode: boolean;
};

/**
 * PlanWizardDebugger
 * 
 * 관리자 모드 또는 개발 환경에서만 표시되는 디버깅 패널입니다.
 * 현재 wizardData의 전체 JSON과 검증 결과를 실시간으로 표시합니다.
 */
export function PlanWizardDebugger({
  isAdminMode,
  isTemplateMode,
  isCampMode,
}: PlanWizardDebuggerProps) {
  const { state } = usePlanWizard();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"data" | "validation">("data");

  // 검증 결과 계산 (메모이제이션)
  const validationResult = useMemo(() => {
    return validateStep(
      state.currentStep,
      state.wizardData,
      isTemplateMode,
      isCampMode
    );
  }, [state.currentStep, state.wizardData, isTemplateMode, isCampMode]);

  // JSON 문자열 포맷팅 (메모이제이션)
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(state.wizardData, null, 2);
    } catch (error) {
      return `JSON 직렬화 오류: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [state.wizardData]);

  // 개발 환경 또는 관리자 모드에서만 표시
  const shouldShow = process.env.NODE_ENV === "development" || isAdminMode;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-300 bg-white shadow-lg">
      {/* 토글 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-gray-100 px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-200"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          디버깅 패널 {isOpen ? "접기" : "펼치기"}
          {state.isDirty && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
              변경됨
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 패널 내용 */}
      {isOpen && (
        <div className="max-h-96 overflow-auto border-t border-gray-200">
          {/* 탭 */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setSelectedTab("data")}
              className={`px-4 py-2 text-sm font-medium ${
                selectedTab === "data"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              WizardData
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("validation")}
              className={`px-4 py-2 text-sm font-medium ${
                selectedTab === "validation"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              검증 결과
            </button>
          </div>

          {/* 탭 내용 */}
          <div className="p-4">
            {selectedTab === "data" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    현재 WizardData (Step {state.currentStep})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formattedJson);
                    }}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                  >
                    복사
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-800">
                  {formattedJson}
                </pre>
                <div className="text-xs text-gray-500">
                  <p>Draft ID: {state.draftGroupId || "없음"}</p>
                  <p>변경 사항: {state.isDirty ? "있음" : "없음"}</p>
                  <p>제출 중: {state.isSubmitting ? "예" : "아니오"}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Step {state.currentStep} 검증 결과
                </h3>

                {/* 검증 통과 여부 */}
                <div
                  className={`rounded-lg p-3 ${
                    validationResult.isValid
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  <p className="font-medium">
                    {validationResult.isValid ? "✓ 검증 통과" : "✗ 검증 실패"}
                  </p>
                </div>

                {/* 에러 목록 */}
                {validationResult.errors.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-red-800">
                      에러 ({validationResult.errors.length}개)
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 경고 목록 */}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-yellow-800">
                      경고 ({validationResult.warnings.length}개)
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-700">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 필드별 에러 */}
                {validationResult.fieldErrors.size > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-red-800">
                      필드별 에러 ({validationResult.fieldErrors.size}개)
                    </h4>
                    <ul className="space-y-1 text-sm text-red-700">
                      {Array.from(validationResult.fieldErrors.entries()).map(
                        ([field, error]) => (
                          <li key={field} className="rounded bg-red-50 p-2">
                            <span className="font-medium">{field}:</span> {error}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {/* 검증 통과 시 메시지 */}
                {validationResult.isValid &&
                  validationResult.errors.length === 0 &&
                  validationResult.warnings.length === 0 && (
                    <p className="text-sm text-gray-600">
                      모든 검증을 통과했습니다.
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


