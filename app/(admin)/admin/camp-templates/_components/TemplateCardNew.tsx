"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CampTemplate } from "@/lib/types/plan";
import { deleteCampTemplateAction, updateCampTemplateStatusAction } from "@/lib/domains/camp/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { TemplateCard } from "@/app/(student)/plan/_shared/PlanCard";

type TemplateCardProps = {
  template: CampTemplate;
};

export function TemplateCardComponent({ template }: TemplateCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"draft" | "active" | "archived">((template.status as "draft" | "active" | "archived") ?? "draft");
  const [isChangingStatus, setIsChangingStatus] = useState(false);

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
        setShowDeleteDialog(false);
        setIsDeleting(false);
        router.push("/admin/camp-templates");
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

  const handleStatusChange = async (e: React.MouseEvent, newStatus: "draft" | "active" | "archived") => {
    e.preventDefault();
    e.stopPropagation();
    
    if (currentStatus === newStatus) return;
    
    setIsChangingStatus(true);
    try {
      const result = await updateCampTemplateStatusAction(template.id, newStatus);
      if (result.success) {
        setCurrentStatus(newStatus);
        toast.showSuccess(
          newStatus === "active" 
            ? "템플릿이 활성화되었습니다." 
            : "템플릿이 초안 상태로 변경되었습니다."
        );
        router.refresh();
      } else {
        toast.showError(result.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("상태 변경 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "상태 변경에 실패했습니다.";
      toast.showError(errorMessage);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const statusActions = (
    <>
      {currentStatus === "draft" && (
        <button
          onClick={(e) => handleStatusChange(e, "active")}
          disabled={isChangingStatus}
          className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="활성화"
        >
          {isChangingStatus ? "변경 중..." : "활성화"}
        </button>
      )}
      {currentStatus === "active" && (
        <>
          <button
            onClick={(e) => handleStatusChange(e, "draft")}
            disabled={isChangingStatus}
            className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="초안으로 변경"
          >
            {isChangingStatus ? "변경 중..." : "초안"}
          </button>
          <button
            onClick={(e) => handleStatusChange(e, "archived")}
            disabled={isChangingStatus}
            className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="보관"
          >
            {isChangingStatus ? "변경 중..." : "보관"}
          </button>
        </>
      )}
      {currentStatus === "archived" && (
        <button
          onClick={(e) => handleStatusChange(e, "draft")}
          disabled={isChangingStatus}
          className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="초안으로 복원"
        >
          {isChangingStatus ? "변경 중..." : "복원"}
        </button>
      )}
      <button
        onClick={handleDelete}
        className="opacity-0 transition-opacity group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
        title="템플릿 삭제"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <>
      <TemplateCard
        title={template.name}
        subtitle={template.program_type}
        description={template.description}
        href={`/admin/camp-templates/${template.id}`}
        status={currentStatus}
        createdAt={template.created_at ?? undefined}
        actions={statusActions}
        className="group"
      />

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
          <p className="text-sm text-gray-700">
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

