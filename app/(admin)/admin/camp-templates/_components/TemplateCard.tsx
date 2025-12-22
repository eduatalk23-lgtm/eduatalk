"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { deleteCampTemplateAction, updateCampTemplateStatusAction } from "@/lib/domains/camp/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { MoreVertical } from "lucide-react";
import { getUserFacingMessage } from "@/lib/errors";

type TemplateCardProps = {
  template: CampTemplate;
};

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"draft" | "active" | "archived">(template.status);
  const [isChangingStatus, setIsChangingStatus] = useState(false);


  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCampTemplateAction(template.id);
      if (result.success) {
        toast.showSuccess("템플릿이 삭제되었습니다.");
        setShowDeleteDialog(false); // 다이얼로그 먼저 닫기
        setIsDeleting(false); // 상태 리셋
        // 현재 URL로 리다이렉트하여 서버 컴포넌트를 다시 렌더링
        // revalidatePath가 호출되었으므로 최신 데이터가 로드됨
        router.push("/admin/camp-templates");
        router.refresh();
      } else {
        toast.showError(result.error || "템플릿 삭제에 실패했습니다.");
        setIsDeleting(false);
      }
    } catch (error) {
      console.error("템플릿 삭제 실패:", error);
      const errorMessage = getUserFacingMessage(error);
      toast.showError(errorMessage);
      setIsDeleting(false);
    }
  };


  const handleStatusChange = async (newStatus: "draft" | "active" | "archived") => {
    if (currentStatus === newStatus) {
      return;
    }
    
    setIsChangingStatus(true);
    try {
      const result = await updateCampTemplateStatusAction(template.id, newStatus);
      if (result.success) {
        setCurrentStatus(newStatus);
        toast.showSuccess(
          newStatus === "active" 
            ? "템플릿이 활성화되었습니다." 
            : newStatus === "archived"
            ? "템플릿이 보관되었습니다."
            : "템플릿이 초안 상태로 변경되었습니다."
        );
        router.refresh();
      } else {
        toast.showError(result.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("상태 변경 실패:", error);
      const errorMessage = getUserFacingMessage(error);
      toast.showError(errorMessage);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const getStatusBadge = () => {
    if (currentStatus === "draft") {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
          초안
        </span>
      );
    }
    if (currentStatus === "active") {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
          활성
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
        보관
      </span>
    );
  };

  return (
    <>
      <div className="group relative rounded-lg border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md">
        <div className="flex items-center gap-4 md:gap-6">
          {/* 본문 정보 - 가로 배치 */}
          <Link
            href={`/admin/camp-templates/${template.id}`}
            className="flex flex-1 items-center gap-3 md:gap-6 min-w-0"
          >
            {/* 이름 */}
            <div className="flex-shrink-0 min-w-[120px] md:min-w-[150px]">
              <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">
                {template.name}
              </h3>
            </div>

            {/* 유형 */}
            <div className="flex-shrink-0 hidden sm:block">
              <p className="text-xs md:text-sm text-gray-700 whitespace-nowrap">
                {template.program_type}
              </p>
            </div>

            {/* 설명 */}
            {template.description && (
              <div className="flex-1 min-w-0 hidden md:block">
                <p className="text-sm text-gray-600 truncate">
                  {template.description}
                </p>
              </div>
            )}

            {/* 날짜 */}
            <div className="flex-shrink-0 ml-auto">
              <p className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(template.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </Link>

          {/* 상태 배지 및 드롭다운 메뉴 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {getStatusBadge()}
            
            {/* 드롭다운 메뉴 */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                title="더보기"
              >
                <MoreVertical className="h-5 w-5" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                {/* 상태 변경 옵션 */}
                {currentStatus === "draft" && (
                  <DropdownMenu.Item
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStatusChange("active");
                    }}
                    disabled={isChangingStatus}
                  >
                    {isChangingStatus ? "변경 중..." : "활성화"}
                  </DropdownMenu.Item>
                )}
                {currentStatus === "active" && (
                  <>
                    <DropdownMenu.Item
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStatusChange("draft");
                      }}
                      disabled={isChangingStatus}
                    >
                      {isChangingStatus ? "변경 중..." : "초안으로 변경"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStatusChange("archived");
                      }}
                      disabled={isChangingStatus}
                    >
                      {isChangingStatus ? "변경 중..." : "보관"}
                    </DropdownMenu.Item>
                  </>
                )}
                {currentStatus === "archived" && (
                  <DropdownMenu.Item
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStatusChange("draft");
                    }}
                    disabled={isChangingStatus}
                  >
                    {isChangingStatus ? "변경 중..." : "초안으로 복원"}
                  </DropdownMenu.Item>
                )}

                {/* 구분선 */}
                <DropdownMenu.Separator />

                {/* 삭제 옵션 */}
                <DropdownMenu.Item
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteClick();
                  }}
                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  삭제
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
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

