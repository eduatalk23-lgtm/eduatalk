"use client";

import { useEffect, useState } from "react";
import { getTermsContentById } from "@/app/(superadmin)/actions/termsContents";
import type { TermsContent } from "@/lib/types/terms";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import Button from "@/components/atoms/Button";
import { isErrorResponse } from "@/lib/types/actionResponse";

type TermsPreviewProps = {
  contentId: string;
  onClose: () => void;
};

export function TermsPreview({ contentId, onClose }: TermsPreviewProps) {
  const [content, setContent] = useState<TermsContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContent();
  }, [contentId]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTermsContentById(contentId);
      if (result.success && result.data) {
        setContent(result.data);
      } else if (isErrorResponse(result)) {
        setError(result.error || result.message || "약관을 찾을 수 없습니다.");
      } else {
        setError("약관을 찾을 수 없습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="text-sm text-red-600">{error}</div>
        <Button onClick={onClose} className="mt-4" variant="outline" size="sm">
          닫기
        </Button>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">{content.title}</h2>
          <div className="text-xs text-gray-500">
            버전 {content.version} ·{" "}
            {new Date(content.created_at).toLocaleDateString("ko-KR")}
          </div>
        </div>
        <Button onClick={onClose} variant="outline" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="prose prose-sm max-w-none overflow-y-auto max-h-[600px] border border-gray-200 rounded-lg p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

