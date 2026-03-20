"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface ImageUploaderProps {
  /** Server Action으로 업로드 후 URL 반환 */
  onUpload: (file: File) => Promise<string>;
  /** 업로드 완료 후 URL 전달 */
  onComplete: (url: string) => void;
  onCancel: () => void;
}

export function ImageUploader({
  onUpload,
  onComplete,
  onCancel,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("JPG, PNG, WebP, GIF만 지원합니다.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
        return;
      }

      setUploading(true);
      try {
        const url = await onUpload(file);
        onComplete(url);
      } catch {
        setError("업로드에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, onComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="relative p-4">
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-2 right-2 p-1 rounded text-secondary-400 hover:text-secondary-600"
      >
        <X className="w-4 h-4" />
      </button>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex flex-col items-center gap-2 py-6 px-4 rounded-lg border-2 border-dashed cursor-pointer",
          "border-secondary-300 dark:border-secondary-600",
          "hover:border-primary-400 dark:hover:border-primary-500 transition-colors",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-secondary-400" />
        )}
        <p className="text-sm text-secondary-500">
          {uploading ? "업로드 중..." : "클릭 또는 드래그하여 이미지 업로드"}
        </p>
        <p className="text-xs text-secondary-400">
          JPG, PNG, WebP, GIF · 최대 {MAX_SIZE_MB}MB
        </p>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
