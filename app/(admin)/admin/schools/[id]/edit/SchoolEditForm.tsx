"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSchool, deleteSchool } from "@/app/(admin)/actions/schoolActions";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { SchoolUpsertForm } from "../_components/SchoolUpsertForm";

type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  school_code?: string | null;
  region_id?: string | null;
  region: string | null;
  address?: string | null;
  postal_code?: string | null;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  category?: string | null;
  university_type?: string | null;
  university_ownership?: string | null;
  campus_name?: string | null;
};

type SchoolEditFormProps = {
  school: School;
  regions: Array<{ id: string; name: string }>;
};

export function SchoolEditForm({ school, regions }: SchoolEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await updateSchool(formData);
        if (result.success) {
          toast.showSuccess("학교 정보가 수정되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 수정에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 수정 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 수정에 실패했습니다."
        );
      }
    });
  }

  function handleDeleteClick() {
    setShowDeleteDialog(true);
  }

  function handleDeleteConfirm() {
    setShowDeleteDialog(false);
    startTransition(async () => {
      try {
        const result = await deleteSchool(school.id);
        if (result.success) {
          toast.showSuccess("학교가 삭제되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 삭제 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 삭제에 실패했습니다."
        );
      }
    });
  }

  return (
    <>
      <SchoolUpsertForm
        defaultValues={school}
        regions={regions}
        onSubmit={handleSubmit}
        submitButtonText="저장하기"
        isPending={isPending}
        showDeleteButton={true}
        onDelete={handleDeleteClick}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="학교 삭제 확인"
        description={`정말로 "${school.name}" 학교를 삭제하시겠습니까?`}
        variant="destructive"
        maxWidth="md"
      >
        <div className="py-4">
          <p className="text-sm text-gray-600">
            이 작업은 되돌릴 수 없으며, 학교의 모든 정보가 삭제됩니다.
          </p>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-red-400"
          >
            {isPending ? "삭제 중..." : "삭제하기"}
          </button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

