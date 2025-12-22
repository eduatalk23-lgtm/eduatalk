"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import TemplateBlockForm from "../../_components/TemplateBlockForm";
import { useToast } from "@/components/ui/ToastProvider";

type TemplateBlockSetDetailProps = {
  templateId: string;
  blockSet: {
    id: string;
    name: string;
    description?: string | null;
  };
  blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  isSelected: boolean;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export default function TemplateBlockSetDetail({
  templateId,
  blockSet,
  blocks,
  isSelected,
}: TemplateBlockSetDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBlockChange = useCallback(async () => {
    router.refresh();
  }, [router]);

  const handleDelete = async () => {
    if (!confirm(`"${blockSet.name}" 세트를 삭제하시겠습니까? 포함된 모든 블록도 함께 삭제됩니다.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { deleteTenantBlockSet } = await import("@/lib/domains/tenant");
      const formData = new FormData();
      formData.append("id", blockSet.id);
      await deleteTenantBlockSet(formData);
      toast.showSuccess("블록 세트가 삭제되었습니다.");
      router.push(`/admin/camp-templates/${templateId}/time-management`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "블록 세트 삭제에 실패했습니다.";
      toast.showError(errorMessage);
      setIsDeleting(false);
    }
  };

  const handleBlockDelete = async (blockId: string) => {
    if (!confirm("이 블록을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const { deleteTenantBlock } = await import("@/lib/domains/tenant");
      const formData = new FormData();
      formData.append("id", blockId);
      await deleteTenantBlock(formData);
      toast.showSuccess("블록이 삭제되었습니다.");
      router.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "블록 삭제에 실패했습니다.";
      toast.showError(errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* 블록 세트 정보 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{blockSet.name}</h2>
              {isSelected && (
                <span className="inline-block px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded">
                  선택됨
                </span>
              )}
            </div>
            {blockSet.description && (
              <p className="text-sm text-gray-600">{blockSet.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "삭제 중..." : "세트 삭제"}
          </button>
        </div>

        {/* 블록 목록 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">시간 블록</h3>
            <button
              type="button"
              onClick={() => setShowBlockForm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + 블록 추가
            </button>
          </div>

          {blocks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {weekdayLabels[block.day_of_week]}
                    </div>
                    <div className="text-xs text-gray-600">
                      {block.start_time} ~ {block.end_time}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBlockDelete(block.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="블록 삭제"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-500">등록된 시간 블록이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 블록 추가 폼 */}
      {showBlockForm && (
        <TemplateBlockForm
          blockSetId={blockSet.id}
          onClose={() => setShowBlockForm(false)}
          onBlockChange={handleBlockChange}
        />
      )}
    </div>
  );
}

