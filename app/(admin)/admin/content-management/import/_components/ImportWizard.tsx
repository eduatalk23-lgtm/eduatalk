"use client";

/**
 * Import Wizard - 단계별 일괄 등록 워크플로우
 *
 * Step 1: 콘텐츠 유형 선택 + Excel 업로드
 * Step 2: 검증 결과 확인 + AI 추천 적용
 * Step 3: 최종 확인 및 등록
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ExcelUploader } from "./ExcelUploader";
import { ValidationResults } from "./ValidationResults";
import { ImportConfirmation } from "./ImportConfirmation";
import {
  validateImportData,
  applyAISuggestionsToRows,
  type ContentType,
  type BulkImportValidationResult,
} from "@/lib/domains/content-research";
import { importMasterBooksFromExcel } from "@/lib/domains/master-content/actions/books/import";
import { importMasterLecturesFromExcel } from "@/lib/domains/master-content/actions/lectures/import";
import * as XLSX from "xlsx";

type Step = "upload" | "validate" | "confirm";

interface ParsedRow {
  originalData: Record<string, unknown>;
  aiSuggestions?: Record<string, unknown>;
  appliedData: Record<string, unknown>;
  selected: boolean;
}

export function ImportWizard() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [contentType, setContentType] = useState<ContentType>("book");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationResult, setValidationResult] = useState<BulkImportValidationResult | null>(null);

  // Step 1: Excel 파일 파싱 및 검증
  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      // Excel 파싱
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (rows.length === 0) {
        toast.showError("Excel 파일에 데이터가 없습니다.");
        setIsLoading(false);
        return;
      }

      // 서버에서 검증
      const result = await validateImportData(rows, contentType, {
        useAI: true,
        maxAIRequests: 50,
      });

      if (!result.success || !result.result) {
        toast.showError(result.error ?? "검증 실패");
        setIsLoading(false);
        return;
      }

      // 검증 결과를 ParsedRow 형태로 변환
      const parsed: ParsedRow[] = result.result.rows.map((row) => ({
        originalData: row.originalData,
        aiSuggestions: row.aiSuggestions,
        appliedData: row.enrichedData ?? row.originalData,
        selected: row.status !== "invalid",
      }));

      setParsedRows(parsed);
      setValidationResult(result.result);
      setStep("validate");
      toast.showSuccess(`${rows.length}개 행 분석 완료`);
    } catch (error) {
      console.error("Import error:", error);
      toast.showError(error instanceof Error ? error.message : "파일 처리 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  }, [contentType, toast]);

  // Step 2: AI 추천 적용
  const handleApplySuggestion = useCallback((rowIndex: number, field: string) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex || !row.aiSuggestions) return row;

        const suggestion = row.aiSuggestions[field];
        if (suggestion === undefined) return row;

        return {
          ...row,
          appliedData: {
            ...row.appliedData,
            [field]: suggestion,
          },
        };
      })
    );
  }, []);

  // 모든 AI 추천 일괄 적용
  const handleApplyAllSuggestions = useCallback(() => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (!row.aiSuggestions) return row;

        const newAppliedData = { ...row.appliedData };
        for (const [field, value] of Object.entries(row.aiSuggestions)) {
          if (newAppliedData[field] === undefined || newAppliedData[field] === null || newAppliedData[field] === "") {
            newAppliedData[field] = value;
          }
        }

        return { ...row, appliedData: newAppliedData };
      })
    );
    toast.showSuccess("모든 AI 추천값이 적용되었습니다.");
  }, [toast]);

  // 행 선택/해제
  const handleToggleRow = useCallback((rowIndex: number) => {
    setParsedRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex ? { ...row, selected: !row.selected } : row
      )
    );
  }, []);

  // Step 3: 최종 Import
  const handleFinalImport = useCallback(async () => {
    const selectedRows = parsedRows.filter((row) => row.selected);

    if (selectedRows.length === 0) {
      toast.showError("등록할 항목을 선택해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      // appliedData를 Excel 버퍼로 변환
      const worksheet = XLSX.utils.json_to_sheet(selectedRows.map((r) => r.appliedData));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      const uint8Array = new Uint8Array(buffer);

      // 콘텐츠 유형에 따라 Import
      const result = contentType === "book"
        ? await importMasterBooksFromExcel(uint8Array)
        : await importMasterLecturesFromExcel(uint8Array);

      if ("error" in result) {
        toast.showError(result.error ?? "등록 실패");
      } else {
        toast.showSuccess(`${selectedRows.length}개 콘텐츠가 등록되었습니다.`);
        router.push("/admin/content-management");
        router.refresh();
      }
    } catch (error) {
      console.error("Final import error:", error);
      toast.showError(error instanceof Error ? error.message : "등록 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  }, [contentType, parsedRows, router, toast]);

  // 이전 단계로
  const handleBack = useCallback(() => {
    if (step === "validate") {
      setStep("upload");
      setParsedRows([]);
      setValidationResult(null);
    } else if (step === "confirm") {
      setStep("validate");
    }
  }, [step]);

  // 다음 단계로
  const handleNext = useCallback(() => {
    if (step === "validate") {
      setStep("confirm");
    }
  }, [step]);

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4">
        <StepIndicator
          number={1}
          label="파일 업로드"
          isActive={step === "upload"}
          isComplete={step !== "upload"}
        />
        <div className="w-12 h-0.5 bg-gray-200" />
        <StepIndicator
          number={2}
          label="검증 및 AI 추천"
          isActive={step === "validate"}
          isComplete={step === "confirm"}
        />
        <div className="w-12 h-0.5 bg-gray-200" />
        <StepIndicator
          number={3}
          label="확인 및 등록"
          isActive={step === "confirm"}
          isComplete={false}
        />
      </div>

      {/* Step Content */}
      {step === "upload" && (
        <ExcelUploader
          contentType={contentType}
          onContentTypeChange={setContentType}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
        />
      )}

      {step === "validate" && validationResult && (
        <ValidationResults
          result={validationResult}
          parsedRows={parsedRows}
          contentType={contentType}
          onApplySuggestion={handleApplySuggestion}
          onApplyAllSuggestions={handleApplyAllSuggestions}
          onToggleRow={handleToggleRow}
          onBack={handleBack}
          onNext={handleNext}
        />
      )}

      {step === "confirm" && (
        <ImportConfirmation
          parsedRows={parsedRows.filter((r) => r.selected)}
          contentType={contentType}
          onBack={handleBack}
          onConfirm={handleFinalImport}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// Step Indicator Component
function StepIndicator({
  number,
  label,
  isActive,
  isComplete,
}: {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
          ${isComplete ? "bg-green-500 text-white" : ""}
          ${isActive ? "bg-blue-600 text-white" : ""}
          ${!isActive && !isComplete ? "bg-gray-200 text-gray-500" : ""}
        `}
      >
        {isComplete ? "✓" : number}
      </div>
      <span
        className={`text-xs ${isActive ? "text-blue-600 font-medium" : "text-gray-500"}`}
      >
        {label}
      </span>
    </div>
  );
}
