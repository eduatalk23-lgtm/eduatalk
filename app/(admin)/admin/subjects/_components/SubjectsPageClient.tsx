"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/ToastProvider";
import { exportSubjectsToExcel, downloadSubjectsTemplate } from "@/lib/domains/subject/actions/excel/export";
import { importSubjectsFromExcel } from "@/lib/domains/subject/actions/excel/import";
import CurriculumRevisionTabs from "./CurriculumRevisionTabs";
import Button from "@/components/atoms/Button";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

// ExcelImportDialog는 무거운 라이브러리를 사용할 수 있으므로 동적 로드
const ExcelImportDialog = dynamic(
  () => import("@/components/admin/ExcelImportDialog"),
  { ssr: false }
);

type SubjectsPageClientProps = {
  initialRevisions: CurriculumRevision[];
  initialGroups: SubjectGroup[];
  initialSubjectsMap: Record<string, Subject[]>;
  initialSubjectTypes: SubjectType[];
  initialRevisionId: string | null;
};

export default function SubjectsPageClient({
  initialRevisions,
  initialGroups,
  initialSubjectsMap,
  initialSubjectTypes,
  initialRevisionId,
}: SubjectsPageClientProps) {
  const toast = useToast();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(initialRevisionId);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  function handleRevisionChange(revisionId: string) {
    setSelectedRevisionId(revisionId);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const buffer = await exportSubjectsToExcel();
      // Buffer를 Uint8Array로 변환하여 Blob 생성
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `교과과목관리_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.showSuccess("Excel 파일을 다운로드했습니다.");
    } catch (error) {
      console.error("Excel 다운로드 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "Excel 파일 다운로드에 실패했습니다."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadTemplate() {
    setIsExporting(true);
    try {
      const buffer = await downloadSubjectsTemplate();
      // Buffer를 Uint8Array로 변환하여 Blob 생성
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "교과과목관리_양식.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.showSuccess("양식 파일을 다운로드했습니다.");
    } catch (error) {
      console.error("양식 다운로드 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "양식 파일 다운로드에 실패했습니다."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(file: File): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const arrayBuffer = await file.arrayBuffer();
    // Server Action에서 Buffer로 변환하기 위해 Uint8Array로 전달
    const uint8Array = new Uint8Array(arrayBuffer);
    // importSubjectsFromExcel는 Buffer | Uint8Array를 받음
    return importSubjectsFromExcel(uint8Array);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">교과/과목 관리</h1>
          <p className="text-sm text-gray-500">
            개정교육과정, 교과, 과목, 과목구분을 통합 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            isLoading={isExporting}
          >
            양식 다운로드
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isLoading={isExporting}
          >
            Excel 다운로드
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowImportDialog(true)}
          >
            Excel 업로드
          </Button>
        </div>
      </div>

      {initialRevisions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            개정교육과정이 없습니다. 개정교육과정을 생성해주세요.
          </p>
        </div>
      ) : (
        <CurriculumRevisionTabs
          revisions={initialRevisions}
          selectedRevisionId={selectedRevisionId}
          onRevisionChange={handleRevisionChange}
          initialGroups={initialGroups}
          initialSubjectsMap={initialSubjectsMap}
          initialSubjectTypes={initialSubjectTypes}
        />
      )}

      <ExcelImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        title="교과/과목 관리 Excel 업로드"
        description="Excel 파일을 선택하여 교과/과목 데이터를 업로드하세요. 기존 데이터는 모두 삭제되고 새 데이터로 교체됩니다."
      />
    </section>
  );
}

