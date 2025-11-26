"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { deleteCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { Trash2 } from "lucide-react";

type TemplateCardProps = {
  template: CampTemplate;
};

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCampTemplateAction(template.id);
      if (result.success) {
        toast.showSuccess("템플릿이 삭제되었습니다.");
        router.refresh();
        setShowDeleteDialog(false);
      } else {
        toast.showError(result.error || "템플릿 삭제에 실패했습니다.");
        setIsDeleting(false);
      }
    } catch (error) {
      console.error("템플릿 삭제 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "템플릿 삭제에 실패했습니다.";
      toast.showError(errorMessage);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="group relative rounded-lg border border-gray-200 bg-white p-6 transition hover:border-indigo-300 hover:shadow-md">
        <Link
          href={`/admin/camp-templates/${template.id}`}
          className="block"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {template.name}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {template.program_type}
              </p>
              {template.description && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                  {template.description}
                </p>
              )}
              <p className="mt-3 text-xs text-gray-400">
                {new Date(template.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <div className="ml-4 flex items-start gap-2">
              {template.status === "draft" && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  초안
                </span>
              )}
              {template.status === "active" && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  활성
                </span>
              )}
              {template.status === "archived" && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  보관
                </span>
              )}
              <button
                onClick={handleDelete}
                className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="템플릿 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Link>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="템플릿 삭제 확인"
        description={`정말로 "${template.name}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        variant="destructive"
        maxWidth="md"
      >
        <div className="py-4">
          <p className="text-sm text-gray-600">
            이 템플릿을 삭제하면 관련된 모든 데이터가 함께 삭제됩니다. 삭제된 템플릿은 복구할 수 없습니다.
          </p>
        </div>
        <DialogFooter>
          <button
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={confirmDelete}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "삭제 중..." : "삭제"}
          </button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

