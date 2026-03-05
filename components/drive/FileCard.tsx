"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, FileText, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { FILE_CATEGORY_LABELS, type DriveFile } from "@/lib/domains/drive/types";
import { getAttachmentExpiryInfo } from "@/lib/domains/chat/attachmentExpiry";
import { formatFileSize, isImageType, getFileTypeLabel, sanitizeFileName } from "@/lib/domains/drive/validation";
import { deleteDriveFileAction } from "@/lib/domains/drive/actions/files";

interface FileCardProps {
  file: DriveFile;
  signedUrl?: string;
  readOnly?: boolean;
  onDelete?: () => void;
  onDownload?: () => void;
}

export function FileCard({ file, signedUrl, readOnly, onDelete, onDownload }: FileCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const expiry = getAttachmentExpiryInfo(file.created_at);
  const isImage = isImageType(file.mime_type);
  const isPdf = file.mime_type === "application/pdf";
  const canPreview = isImage || isPdf;

  function handleDelete() {
    if (!confirm("파일을 삭제하시겠습니까?")) return;
    startDelete(async () => {
      await deleteDriveFileAction(file.id);
      onDelete?.();
    });
  }

  const uploaderLabel =
    file.uploaded_by_role === "parent"
      ? "학부모"
      : file.uploaded_by_role === "admin"
        ? "관리자"
        : null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        {/* 아이콘 / 썸네일 */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            canPreview
              ? "bg-blue-50 dark:bg-blue-900/30 cursor-pointer"
              : "bg-gray-100 dark:bg-gray-700"
          )}
          onClick={() => canPreview && signedUrl && setShowPreview(true)}
        >
          {isImage ? (
            <ImageIcon className="w-5 h-5 text-blue-500" />
          ) : isPdf ? (
            <FileText className="w-5 h-5 text-red-500" />
          ) : (
            <FileText className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* 파일 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
            {file.original_name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{FILE_CATEGORY_LABELS[file.category]}</span>
            <span>·</span>
            <span>{formatFileSize(file.size_bytes)}</span>
            <span>·</span>
            <span>{getFileTypeLabel(file.mime_type)}</span>
            {uploaderLabel && (
              <>
                <span>·</span>
                <span>{uploaderLabel} 업로드</span>
              </>
            )}
          </div>
        </div>

        {/* 만료 뱃지 */}
        {expiry.level !== "safe" && (
          <span
            className={cn(
              "flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full",
              expiry.level === "critical"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
            )}
          >
            {expiry.label}
          </span>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {signedUrl && (
            <a
              href={signedUrl}
              download={sanitizeFileName(file.original_name)}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="다운로드"
              onClick={() => onDownload?.()}
            >
              <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </a>
          )}
          {!readOnly && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              title="삭제"
            >
              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && signedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowPreview(false)}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={signedUrl}
              alt={file.original_name}
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
          ) : isPdf ? (
            <div
              className="w-full max-w-4xl h-[85vh] rounded-lg overflow-hidden bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={signedUrl}
                title={file.original_name}
                className="w-full h-full border-0"
              />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
