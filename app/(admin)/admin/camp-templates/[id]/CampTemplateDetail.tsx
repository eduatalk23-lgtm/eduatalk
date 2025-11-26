"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { getCampInvitationsForTemplate, deleteCampTemplateAction, updateCampTemplateStatusAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { StudentInvitationForm } from "./StudentInvitationForm";
import { CampInvitationList } from "./CampInvitationList";
import { TemplateChecklist } from "../_components/TemplateChecklist";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { Trash2 } from "lucide-react";

type CampTemplateDetailProps = {
  template: CampTemplate;
};

export function CampTemplateDetail({ template }: CampTemplateDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"draft" | "active" | "archived">(template.status);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // 초대 목록 로드 (useCallback으로 메모이제이션)
  const loadInvitations = useCallback(async () => {
    try {
      setLoadingInvitations(true);
      const result = await getCampInvitationsForTemplate(template.id);
      if (result.success) {
        setInvitations(result.invitations || []);
      } else {
        // 에러가 발생한 경우 빈 배열로 처리
        setInvitations([]);
        toast.showError("초대 목록을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("초대 목록 로드 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "초대 목록을 불러오는데 실패했습니다.";
      // 템플릿이 없는 경우는 조용히 처리
      if (errorMessage.includes("템플릿을 찾을 수 없습니다")) {
        setInvitations([]);
      } else {
        toast.showError(errorMessage);
      }
    } finally {
      setLoadingInvitations(false);
    }
  }, [template.id, toast]);

  // 초기 로드
  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // 초대 발송 후 목록 새로고침 (useCallback으로 메모이제이션)
  const handleInvitationSent = useCallback(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleStatusChange = async (newStatus: "draft" | "active" | "archived") => {
    if (currentStatus === newStatus) return;
    
    setIsChangingStatus(true);
    try {
      const result = await updateCampTemplateStatusAction(template.id, newStatus);
      if (result.success) {
        setCurrentStatus(newStatus);
        toast.showSuccess(
          newStatus === "active" 
            ? "템플릿이 활성화되었습니다." 
            : newStatus === "draft"
            ? "템플릿이 초안 상태로 변경되었습니다."
            : "템플릿이 보관되었습니다."
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCampTemplateAction(template.id);
      if (result.success) {
        toast.showSuccess("템플릿이 삭제되었습니다.");
        setShowDeleteDialog(false); // 다이얼로그 닫기
        // router.push 대신 router.replace 사용하여 히스토리에서 제거
        router.replace("/admin/camp-templates");
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
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">{template.name}</h1>
            <p className="text-sm text-gray-500">{template.program_type}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/camp-templates"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              목록으로
            </Link>
            <Link
              href={`/admin/camp-templates/${template.id}/participants`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              참여자 목록
            </Link>
            <Link
              href={`/admin/camp-templates/${template.id}/edit`}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              수정하기
            </Link>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
          </div>
        </div>

        {/* 필수요소 점검 */}
        <TemplateChecklist template={template} />

        {/* 템플릿 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">템플릿 정보</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">상태</label>
              <div className="mt-1 flex items-center gap-3">
                {currentStatus === "draft" && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                    초안
                  </span>
                )}
                {currentStatus === "active" && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    활성
                  </span>
                )}
                {currentStatus === "archived" && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    보관
                  </span>
                )}
                {/* 상태 변경 버튼 */}
                {currentStatus !== "archived" && (
                  <button
                    onClick={() => handleStatusChange(currentStatus === "draft" ? "active" : "draft")}
                    disabled={isChangingStatus}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isChangingStatus 
                      ? "변경 중..." 
                      : currentStatus === "draft" 
                      ? "활성화" 
                      : "초안으로 변경"}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">생성일</label>
              <p className="mt-1 text-sm text-gray-600">
                {new Date(template.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
            {template.description && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">설명</label>
                <p className="mt-1 text-sm text-gray-600">{template.description}</p>
              </div>
            )}
            {template.camp_start_date && (
              <div>
                <label className="text-sm font-medium text-gray-700">캠프 시작일</label>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(template.camp_start_date).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
            {template.camp_end_date && (
              <div>
                <label className="text-sm font-medium text-gray-700">캠프 종료일</label>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(template.camp_end_date).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
            {template.camp_location && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">캠프 장소</label>
                <p className="mt-1 text-sm text-gray-600">{template.camp_location}</p>
              </div>
            )}
          </div>
        </div>

        {/* 발송된 초대 목록 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">발송된 초대</h2>
            <Link
              href={`/admin/camp-templates/${template.id}/participants`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              참여자 관리 →
            </Link>
          </div>
          <CampInvitationList 
            invitations={invitations} 
            loading={loadingInvitations}
            templateId={template.id}
            onRefresh={handleInvitationSent}
          />
        </div>

        {/* 학생 초대 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">학생 초대</h2>
          <StudentInvitationForm 
            templateId={template.id} 
            templateStatus={template.status}
            onInvitationSent={handleInvitationSent} 
          />
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
          <p className="text-sm text-gray-600">
            이 템플릿을 삭제하면 관련된 모든 데이터가 함께 삭제됩니다. 삭제된 템플릿은 복구할 수 없습니다.
          </p>
          {invitations.length > 0 && (
            <div className="mt-4 rounded-lg bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800">
                ⚠️ 이 템플릿에 {invitations.length}개의 초대가 연결되어 있습니다.
              </p>
            </div>
          )}
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
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "삭제 중..." : "삭제"}
          </button>
        </DialogFooter>
      </Dialog>
    </section>
  );
}

