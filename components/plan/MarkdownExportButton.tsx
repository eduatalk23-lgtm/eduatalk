"use client";

/**
 * 마크다운 내보내기 버튼 컴포넌트
 *
 * 플랜 그룹의 마크다운을 생성하고 뷰어 모달을 표시합니다.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  borderDefault,
  bgSurface,
} from "@/lib/utils/darkMode";
import { FileText, X, Loader2 } from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

export interface MarkdownExportButtonProps {
  planGroupId: string;
  planGroupName?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function MarkdownExportButton({
  planGroupId,
  planGroupName,
  className,
  variant = "outline",
  size = "md",
}: MarkdownExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkdown = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plan/${planGroupId}/export/markdown`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "마크다운 생성에 실패했습니다");
      }

      setMarkdown(data.data.markdown);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [planGroupId]);

  const handleClick = useCallback(() => {
    if (markdown) {
      setIsOpen(true);
    } else {
      fetchMarkdown();
    }
  }, [markdown, fetchMarkdown]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 버튼 스타일
  const buttonStyles = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700",
    outline: cn(
      "border",
      borderDefault,
      textSecondary,
      "hover:bg-gray-100 dark:hover:bg-gray-800"
    ),
    ghost: cn(textSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800"),
  };

  const sizeStyles = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2.5 text-base",
  };

  return (
    <>
      {/* 내보내기 버튼 */}
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg font-medium transition",
          buttonStyles[variant],
          sizeStyles[size],
          isLoading && "cursor-not-allowed opacity-70",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        <span>{isLoading ? "생성 중..." : "마크다운 내보내기"}</span>
      </button>

      {/* 에러 메시지 */}
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {/* 마크다운 뷰어 모달 */}
      {isOpen && markdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          <div
            className={cn(
              "relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl",
              bgSurface
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div
              className={cn(
                "flex items-center justify-between border-b px-6 py-4",
                borderDefault
              )}
            >
              <h2 className={cn("text-lg font-semibold", textPrimary)}>
                {planGroupName || "플랜"} - 마크다운 내보내기
              </h2>
              <button
                onClick={handleClose}
                className={cn(
                  "rounded-lg p-2 transition",
                  textSecondary,
                  "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6">
              <MarkdownViewer
                markdown={markdown}
                title={planGroupName}
                maxHeight="60vh"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
