"use client";

/**
 * 마크다운 뷰어 컴포넌트
 *
 * 마크다운 텍스트를 표시하고 복사 기능을 제공합니다.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
  bgSurface,
} from "@/lib/utils/darkMode";
import { Copy, Check, Download, FileText } from "lucide-react";

export interface MarkdownViewerProps {
  markdown: string;
  title?: string;
  className?: string;
  showCopyButton?: boolean;
  showDownloadButton?: boolean;
  maxHeight?: string;
}

export function MarkdownViewer({
  markdown,
  title,
  className,
  showCopyButton = true,
  showDownloadButton = true,
  maxHeight = "500px",
}: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "plan"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, title]);

  if (!markdown) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border p-8",
          borderDefault,
          bgSurface,
          className
        )}
      >
        <FileText className={cn("h-12 w-12 mb-3", textMuted)} />
        <p className={cn("text-sm", textMuted)}>마크다운 내용이 없습니다</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col rounded-lg border", borderDefault, className)}>
      {/* 헤더 */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          borderDefault,
          bgSurface
        )}
      >
        <div className="flex items-center gap-2">
          <FileText className={cn("h-5 w-5", textSecondary)} />
          <span className={cn("font-medium", textPrimary)}>
            {title || "마크다운 미리보기"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                "border",
                borderDefault,
                textSecondary,
                "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="클립보드에 복사"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>복사</span>
                </>
              )}
            </button>
          )}
          {showDownloadButton && (
            <button
              onClick={handleDownload}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                "border",
                borderDefault,
                textSecondary,
                "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="파일로 다운로드"
            >
              <Download className="h-4 w-4" />
              <span>다운로드</span>
            </button>
          )}
        </div>
      </div>

      {/* 마크다운 내용 */}
      <div
        className={cn(
          "overflow-auto p-4 font-mono text-sm",
          "bg-gray-50 dark:bg-gray-900",
          textPrimary
        )}
        style={{ maxHeight }}
      >
        <pre className="whitespace-pre-wrap break-words">{markdown}</pre>
      </div>
    </div>
  );
}
