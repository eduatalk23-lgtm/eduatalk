"use client";

import { useState, useRef } from "react";
import { Dialog, DialogFooter } from "@/components/organisms/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";

type ExcelImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<{ success: boolean; message: string; errors?: string[] }>;
  title?: string;
  description?: string;
};

export default function ExcelImportDialog({
  open,
  onOpenChange,
  onImport,
  title = "Excel 파일 업로드",
  description = "Excel 파일을 선택하여 데이터를 업로드하세요. 기존 데이터는 모두 삭제되고 새 데이터로 교체됩니다.",
}: ExcelImportDialogProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Excel 파일만 허용
      const validExtensions = [".xlsx", ".xls"];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      
      if (!validExtensions.includes(fileExtension)) {
        toast.showError("Excel 파일(.xlsx, .xls)만 업로드 가능합니다.");
        return;
      }

      // 파일 크기 제한 (50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast.showError("파일 크기는 50MB를 초과할 수 없습니다.");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.showError("파일을 선택해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await onImport(selectedFile);
      
      if (result.success) {
        toast.showSuccess(result.message);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onOpenChange(false);
      } else {
        toast.showError(result.message);
        if (result.errors && result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      }
    } catch (error) {
      toast.showError(
        error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="excel-file-input"
            className="block text-body-2-bold text-[var(--text-secondary)]"
          >
            Excel 파일 선택
          </label>
          <input
            id="excel-file-input"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="block w-full text-body-2 text-[var(--text-tertiary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-body-2 file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          {selectedFile && (
            <p className="text-body-2 text-[var(--text-secondary)]">
              선택된 파일: <span className="font-medium">{selectedFile.name}</span> (
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-900/30 p-3">
          <p className="text-body-2 text-warning-800 dark:text-warning-200">
            <strong>주의:</strong> 업로드된 데이터는 기존 데이터를 모두 삭제하고 새로 추가합니다.
            중요한 데이터는 미리 백업해주세요.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          isLoading={isLoading}
          disabled={!selectedFile || isLoading}
        >
          업로드
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

