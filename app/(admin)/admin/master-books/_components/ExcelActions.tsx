"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/ToastProvider";
import { exportMasterBooksToExcel, downloadMasterBooksTemplate } from "@/app/(admin)/actions/masterBooks/export";
import { importMasterBooksFromExcel } from "@/app/(admin)/actions/masterBooks/import";
import Button from "@/components/atoms/Button";

// ExcelImportDialog는 무거운 라이브러리를 사용할 수 있으므로 동적 로드
const ExcelImportDialog = dynamic(
  () => import("@/components/admin/ExcelImportDialog"),
  { ssr: false }
);

export default function ExcelActions() {
  const toast = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const buffer = await exportMasterBooksToExcel();
      // Buffer를 Uint8Array로 변환 (브라우저 환경 호환)
      const uint8Array = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
      const blob = new Blob([uint8Array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `교재관리_${new Date().toISOString().split("T")[0]}.xlsx`;
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
      const buffer = await downloadMasterBooksTemplate();
      // Buffer를 Uint8Array로 변환 (브라우저 환경 호환)
      const uint8Array = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
      const blob = new Blob([uint8Array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "교재관리_양식.xlsx";
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
    const uint8Array = new Uint8Array(arrayBuffer);
    // importMasterBooksFromExcel는 Buffer | Uint8Array를 받음
    return importMasterBooksFromExcel(uint8Array);
  }

  return (
    <>
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

      <ExcelImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        title="교재 관리 Excel 업로드"
        description="Excel 파일을 선택하여 교재 데이터를 업로드하세요. 기존 데이터는 모두 삭제되고 새 데이터로 교체됩니다."
      />
    </>
  );
}

