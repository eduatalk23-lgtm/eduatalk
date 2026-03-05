"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, X } from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import { uploadDriveFileAction } from "@/lib/domains/drive/actions/files";
import {
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  DRIVE_MAX_FILE_SIZE,
  type FileCategory,
} from "@/lib/domains/drive/types";
import { formatFileSize } from "@/lib/domains/drive/validation";

interface FileUploadModalProps {
  studentId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function FileUploadModal({
  studentId,
  onClose,
  onUploaded,
}: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory>("transcript");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > DRIVE_MAX_FILE_SIZE) {
      setError(`파일은 ${Math.floor(DRIVE_MAX_FILE_SIZE / 1024 / 1024)}MB 이하여야 합니다.`);
      return;
    }
    setSelectedFile(file);
  }

  function handleUpload() {
    if (!selectedFile) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await uploadDriveFileAction(formData, {
        studentId,
        category,
      });

      if (!result.success) {
        setError(result.error ?? "업로드에 실패했습니다.");
        return;
      }

      onUploaded();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">파일 업로드</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 카테고리 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            카테고리
          </label>
          <div className="flex gap-2">
            {FILE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "flex-1 py-2 text-sm rounded-lg border transition-colors",
                  category === cat
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                )}
              >
                {FILE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* 파일 선택 */}
        <div className="mb-4">
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf,.hwp,.doc,.docx"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
          >
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Upload className="w-8 h-8" />
                <p className="text-sm">파일을 선택하세요</p>
                <p className="text-xs">
                  최대 {Math.floor(DRIVE_MAX_FILE_SIZE / 1024 / 1024)}MB
                </p>
              </div>
            )}
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* 안내 */}
        <p className="text-xs text-gray-500 mb-4">
          업로드된 파일은 7일 후 자동 삭제됩니다.
        </p>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile}
            isLoading={isPending}
            className="flex-1"
          >
            업로드
          </Button>
        </div>
      </div>
    </div>
  );
}
