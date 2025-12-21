"use client";

import { useEffect, useState } from "react";
import { getTermsContents } from "@/app/(superadmin)/actions/termsContents";
import type { TermsContent, TermsContentType } from "@/lib/types/terms";
import Button from "@/components/atoms/Button";
import { Plus, Eye, Edit, CheckCircle, XCircle } from "lucide-react";
import { isErrorResponse } from "@/lib/types/actionResponse";

type TermsContentListProps = {
  contentType: TermsContentType;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onCreateNew: () => void;
};

export function TermsContentList({
  contentType,
  onEdit,
  onPreview,
  onCreateNew,
}: TermsContentListProps) {
  const [contents, setContents] = useState<TermsContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContents();
  }, [contentType]);

  const loadContents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTermsContents(contentType);
      if (result.success && result.data) {
        setContents(result.data);
      } else if (isErrorResponse(result)) {
        setError(result.error || result.message || "약관 목록을 불러오는데 실패했습니다.");
      } else {
        setError("약관 목록을 불러오는데 실패했습니다.");
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
        <Button
          onClick={loadContents}
          className="mt-4"
          variant="outline"
          size="sm"
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">버전 목록</h2>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          새 버전 생성
        </Button>
      </div>

      {contents.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8">
          등록된 약관이 없습니다. 새 버전을 생성해주세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contents.map((content) => (
            <div
              key={content.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    버전 {content.version}
                  </span>
                  {content.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3" />
                      활성
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <XCircle className="w-3 h-3" />
                      비활성
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">{content.title}</div>
                <div className="text-xs text-gray-500">
                  생성일: {new Date(content.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onPreview(content.id)}
                  variant="outline"
                  size="sm"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onEdit(content.id)}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

