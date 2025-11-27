"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { getCurriculumRevisionsAction } from "@/app/(admin)/actions/contentMetadataActions";
import { exportSubjectsToExcel, downloadSubjectsTemplate } from "@/app/(admin)/actions/subjects/export";
import { importSubjectsFromExcel } from "@/app/(admin)/actions/subjects/import";
import CurriculumRevisionTabs from "./_components/CurriculumRevisionTabs";
import ExcelImportDialog from "@/components/admin/ExcelImportDialog";
import Button from "@/components/atoms/Button";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

export default function SubjectsPage() {
  const toast = useToast();
  const [revisions, setRevisions] = useState<CurriculumRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadRevisions();
  }, []);

  async function loadRevisions() {
    setLoading(true);
    try {
      const data = await getCurriculumRevisionsAction();
      setRevisions(data || []);
      // 첫 번째 개정교육과정을 기본으로 선택
      if (data && data.length > 0 && !selectedRevisionId) {
        setSelectedRevisionId(data[0].id);
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
      toast.showError("개정교육과정을 불러오는데 실패했습니다.");
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleRevisionChange(revisionId: string) {
    setSelectedRevisionId(revisionId);
  }

  function handleRefresh() {
    loadRevisions();
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const buffer = await exportSubjectsToExcel();
      const blob = new Blob([buffer], {
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
      const blob = new Blob([buffer], {
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
    return importSubjectsFromExcel(uint8Array as any);
  }

  const sortedRevisions = [...revisions].sort(
    (a, b) =>
      a.display_order - b.display_order || a.name.localeCompare(b.name)
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">교과/과목 관리</h1>
            <p className="mt-2 text-sm text-gray-500">
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
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          로딩 중...
        </div>
      ) : sortedRevisions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            개정교육과정이 없습니다. 개정교육과정을 생성해주세요.
          </p>
        </div>
      ) : (
        <CurriculumRevisionTabs
          revisions={sortedRevisions}
          selectedRevisionId={selectedRevisionId}
          onRevisionChange={handleRevisionChange}
          onRefresh={handleRefresh}
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
