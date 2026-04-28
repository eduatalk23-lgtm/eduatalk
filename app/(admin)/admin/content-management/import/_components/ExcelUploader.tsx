"use client";

/**
 * Excel 파일 업로더 컴포넌트
 *
 * 콘텐츠 유형 선택 + 파일 업로드 + 템플릿 다운로드
 */

import { useRef, useState } from "react";
import Button from "@/components/atoms/Button";
import { downloadMasterBooksTemplate } from "@/lib/domains/master-content/actions/books/export";
import { downloadMasterLecturesTemplate } from "@/lib/domains/master-content/actions/lectures/export";
import { useToast } from "@/components/ui/ToastProvider";
import type { ContentType } from "@/lib/domains/content-research/types";

interface ExcelUploaderProps {
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
}

export function ExcelUploader({
  contentType,
  onContentTypeChange,
  onFileUpload,
  isLoading,
}: ExcelUploaderProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = [".xlsx", ".xls"];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      toast.showError("Excel 파일(.xlsx, .xls)만 업로드 가능합니다.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.showError("파일 크기는 50MB를 초과할 수 없습니다.");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.showError("파일을 선택해주세요.");
      return;
    }
    await onFileUpload(selectedFile);
  };

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const buffer = contentType === "book"
        ? await downloadMasterBooksTemplate()
        : await downloadMasterLecturesTemplate();

      const uint8Array = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
      const blob = new Blob([uint8Array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = contentType === "book" ? "교재관리_양식.xlsx" : "강의관리_양식.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.showSuccess("템플릿 파일을 다운로드했습니다.");
    } catch (error) {
      toast.showError("템플릿 다운로드에 실패했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
      {/* 콘텐츠 유형 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          콘텐츠 유형 선택
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contentType"
              value="book"
              checked={contentType === "book"}
              onChange={() => onContentTypeChange("book")}
              className="w-4 h-4 text-blue-600"
            />
            <span className="flex items-center gap-1">
              📚 교재
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contentType"
              value="lecture"
              checked={contentType === "lecture"}
              onChange={() => onContentTypeChange("lecture")}
              className="w-4 h-4 text-blue-600"
            />
            <span className="flex items-center gap-1">
              🎬 강의
            </span>
          </label>
        </div>
      </div>

      {/* 필수 필드 안내 */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h4 className="font-medium text-yellow-800 mb-2">
          AI 플랜 생성 필수 필드
        </h4>
        {contentType === "book" ? (
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>title</strong> (교재명) - 필수</li>
            <li>• <strong>subject</strong> (과목) - AI 추론 가능</li>
            <li>• <strong>subject_category</strong> (과목 카테고리) - AI 추론 가능</li>
            <li>• <strong>total_pages</strong> (총 페이지) - 필수</li>
            <li>• <strong>difficulty_level</strong> (난이도) - AI 추론 가능</li>
          </ul>
        ) : (
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>title</strong> (강의명) - 필수</li>
            <li>• <strong>subject</strong> (과목) - AI 추론 가능</li>
            <li>• <strong>subject_category</strong> (과목 카테고리) - AI 추론 가능</li>
            <li>• <strong>total_episodes</strong> (총 강의수) - 필수</li>
            <li>• <strong>total_duration</strong> (총 시간, 분) - 필수</li>
            <li>• <strong>difficulty_level</strong> (난이도) - AI 추론 가능</li>
          </ul>
        )}
        <p className="text-xs text-yellow-600 mt-2">
          ※ 누락된 필드는 제목을 기반으로 AI가 추정값을 제안합니다.
        </p>
      </div>

      {/* 템플릿 다운로드 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900">템플릿 다운로드</p>
          <p className="text-sm text-gray-600">
            필수 필드가 포함된 Excel 템플릿을 사용하세요.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          isLoading={isDownloading}
        >
          템플릿 다운로드
        </Button>
      </div>

      {/* 파일 업로드 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Excel 파일 선택
        </label>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="flex-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {selectedFile && (
          <p className="text-sm text-gray-600 mt-2">
            선택된 파일: <span className="font-medium">{selectedFile.name}</span>
            ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* 업로드 버튼 */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || isLoading}
          isLoading={isLoading}
        >
          {isLoading ? "분석 중..." : "파일 분석 시작"}
        </Button>
      </div>
    </div>
  );
}
