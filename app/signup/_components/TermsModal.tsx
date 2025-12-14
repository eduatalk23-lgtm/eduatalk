"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import type { TermsContentType } from "@/lib/types/terms";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "@/components/atoms/Button";

type TermsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: TermsContentType;
  title: string;
};

export function TermsModal({
  open,
  onOpenChange,
  contentType,
  title,
}: TermsModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadContent();
    } else {
      // 모달이 닫힐 때 상태 초기화
      setContent(null);
      setError(null);
    }
  }, [open, contentType]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/terms/${contentType}`);
      if (!response.ok) {
        throw new Error(`약관 조회 실패: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.content) {
        setContent(data.content);
      } else {
        setError("약관 내용을 불러올 수 없습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="2xl">
      <DialogContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">로딩 중...</div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-sm text-red-600">{error}</div>
            <Button onClick={loadContent} variant="outline" size="sm">
              다시 시도
            </Button>
          </div>
        )}

        {content && !loading && !error && (
          <div className="prose prose-sm max-w-none overflow-y-auto max-h-[60vh]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </DialogContent>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>닫기</Button>
      </DialogFooter>
    </Dialog>
  );
}

