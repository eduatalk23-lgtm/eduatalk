"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import {
  getCampInvitationsForTemplate,
  getCampInvitationsForTemplateWithPaginationAction,
  deleteCampTemplateAction,
  updateCampTemplateStatusAction,
  copyCampTemplateAction,
} from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { StudentInvitationForm } from "./StudentInvitationForm";
import { CampInvitationList } from "./CampInvitationList";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { Trash2, Copy } from "lucide-react";
import {
  planPurposeLabels,
  schedulerTypeLabels,
} from "@/lib/constants/planLabels";
import { usePagination } from "@/lib/hooks/usePagination";
import type { CampInvitation } from "@/lib/types/plan";

type CampTemplateDetailProps = {
  template: CampTemplate;
  templateBlockSet?: {
    id: string;
    name: string;
    blocks: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  } | null;
};

const weekdayLabels = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
];

export function CampTemplateDetail({
  template,
  templateBlockSet,
}: CampTemplateDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 템플릿 데이터를 변수로 추출하여 반복 접근 최적화 및 타입 안전성 확보
  const templateData = template.template_data;
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [invitations, setInvitations] = useState<CampInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [invitationTotal, setInvitationTotal] = useState(0);
  
  // 필터 상태 (URL searchParams와 동기화)
  const [invitationFilters, setInvitationFilters] = useState<{
    search?: string;
    status?: string;
  }>({
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
  });
  
  // 페이지네이션 훅 사용
  const {
    page: invitationPage,
    pageSize: invitationPageSize,
    setPage: setInvitationPage,
    setPageSize: setInvitationPageSize,
    adjustPageAfterDeletion,
  } = usePagination({
    initialPage: 1,
    initialPageSize: 20,
    onPageChange: (page, pageSize) => {
      loadInvitations(page, pageSize);
    },
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<
    "draft" | "active" | "archived"
  >(template.status);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // 초대 목록 로드 (useCallback으로 메모이제이션)
  // toast는 Context에서 제공되는 안정적인 객체이므로 의존성에서 제외
  const loadInvitations = useCallback(async (page: number, pageSize: number, filters?: { search?: string; status?: string }) => {
    // 삭제 중이면 실행하지 않음
    if (isDeleting) {
      return;
    }

    try {
      setLoadingInvitations(true);
      const result = await getCampInvitationsForTemplateWithPaginationAction(
        template.id,
        page,
        pageSize,
        filters
      );
      if (result.success) {
        setInvitations(result.invitations || []);
        setInvitationTotal(result.total || 0);
      } else {
        // 에러가 발생한 경우 빈 배열로 처리
        setInvitations([]);
        setInvitationTotal(0);
        toast.showError("초대 목록을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("초대 목록 로드 실패:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "초대 목록을 불러오는데 실패했습니다.";
      // 템플릿이 없는 경우는 조용히 처리
      if (errorMessage.includes("템플릿을 찾을 수 없습니다")) {
        setInvitations([]);
        setInvitationTotal(0);
      } else {
        toast.showError(errorMessage);
      }
    } finally {
      setLoadingInvitations(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, isDeleting]);

  // URL searchParams 변경 감지 및 필터 동기화
  useEffect(() => {
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    setInvitationFilters({ search, status });
  }, [searchParams]);

  // 필터 변경 시 초대 목록 다시 로드
  useEffect(() => {
    if (!isDeleting) {
      loadInvitations(invitationPage, invitationPageSize, invitationFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, isDeleting, invitationFilters]);

  // 초기 로드 (template.id와 isDeleting만 의존하여 불필요한 재호출 방지)
  useEffect(() => {
    if (!isDeleting) {
      loadInvitations(invitationPage, invitationPageSize, invitationFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, isDeleting]);

  // 페이지 변경 핸들러 (usePagination 훅에서 자동 처리됨)
  const handleInvitationPageChange = useCallback((newPage: number) => {
    setInvitationPage(newPage);
  }, [setInvitationPage]);

  // 페이지 크기 변경 핸들러 (usePagination 훅에서 자동 처리됨)
  const handleInvitationPageSizeChange = useCallback((newPageSize: number) => {
    setInvitationPageSize(newPageSize);
  }, [setInvitationPageSize]);

  // 초대 발송 후 목록 새로고침 (페이지를 1로 리셋)
  const handleInvitationSent = useCallback(() => {
    setInvitationPage(1);
    // 필터 유지하면서 새로고침
    loadInvitations(1, invitationPageSize, invitationFilters);
  }, [setInvitationPage, invitationPageSize, invitationFilters, loadInvitations]);

  // 초대 삭제 후 목록 새로고침 (페이지 조정)
  const handleDeleteInvitations = useCallback((deletedCount: number) => {
    adjustPageAfterDeletion(deletedCount, invitationTotal);
    loadInvitations(invitationPage, invitationPageSize, invitationFilters);
  }, [adjustPageAfterDeletion, invitationTotal, invitationPage, invitationPageSize, invitationFilters, loadInvitations]);
  
  // 필터 변경 핸들러
  const handleFilterChange = useCallback((filters: { search?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // 필터 파라미터 업데이트
    if (filters.search) {
      params.set("search", filters.search);
    } else {
      params.delete("search");
    }
    
    if (filters.status) {
      params.set("status", filters.status);
    } else {
      params.delete("status");
    }
    
    // 필터 변경 시 페이지를 1로 리셋
    params.set("page", "1");
    
    // URL 업데이트
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleStatusChange = async (
    newStatus: "draft" | "active" | "archived"
  ) => {
    if (currentStatus === newStatus) return;

    setIsChangingStatus(true);
    try {
      const result = await updateCampTemplateStatusAction(
        template.id,
        newStatus
      );
      if (result.success) {
        setCurrentStatus(newStatus);
        toast.showSuccess(
          newStatus === "active"
            ? "템플릿이 활성화되었습니다."
            : newStatus === "draft"
            ? "템플릿이 비활성화되었습니다."
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
        // 삭제 후 목록 페이지로 리다이렉트 (replace 사용하여 히스토리 교체)
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

  const handleCopy = async () => {
    if (!confirm("이 템플릿을 복사하시겠습니까?")) {
      return;
    }

    setIsCopying(true);
    try {
      const result = await copyCampTemplateAction(template.id);
      if (result.success && result.templateId) {
        toast.showSuccess("템플릿이 복사되었습니다.");
        // 복사된 템플릿 상세 페이지로 리다이렉트
        router.push(`/admin/camp-templates/${result.templateId}`);
      } else {
        toast.showError(result.error || "템플릿 복사에 실패했습니다.");
        setIsCopying(false);
      }
    } catch (error) {
      console.error("템플릿 복사 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "템플릿 복사에 실패했습니다.";
      toast.showError(errorMessage);
      setIsCopying(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              캠프 템플릿 관리
            </h1>
            <p className="text-sm text-gray-500">
              캠프 템플릿을 확인하고 관리하세요.
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 좌측: 목록으로 버튼 */}
            <Link
              href="/admin/camp-templates"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              목록으로
            </Link>

            {/* 우측: 나머지 버튼들 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 템플릿 복사 버튼 */}
              <button
                type="button"
                onClick={handleCopy}
                disabled={isCopying}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={16} />
                {isCopying ? "복사 중..." : "템플릿 복사"}
              </button>

              {/* 상태 변경 드롭다운 */}
              <div className="flex items-center gap-2">
                <label htmlFor="status-select" className="text-sm font-medium text-gray-700">
                  상태:
                </label>
                <select
                  id="status-select"
                  value={currentStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value as "draft" | "active" | "archived";
                    handleStatusChange(newStatus);
                  }}
                  disabled={isChangingStatus}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="active">활성</option>
                  <option value="draft">비활성</option>
                  <option value="archived">보관</option>
                </select>
              </div>
              <Link
                href={`/admin/camp-templates/${template.id}/participants`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                참여자 목록
              </Link>
              <Link
                href={`/admin/camp-templates/${template.id}/attendance`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                출석 관리
              </Link>
              <Link
                href={`/admin/camp-templates/${template.id}/reports`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                리포트
              </Link>
              {currentStatus !== "active" && (
                <Link
                  href={`/admin/camp-templates/${template.id}/edit`}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  수정하기
                </Link>
              )}
              {currentStatus === "active" && (
                <button
                  disabled
                  className="inline-flex items-center justify-center rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-500 cursor-not-allowed"
                  title="활성 상태의 템플릿은 수정할 수 없습니다"
                >
                  수정하기
                </button>
              )}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            </div>
          </div>
        </div>

        {/* 템플릿 정보 */}
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            템플릿 정보
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                템플릿 이름
              </label>
              <p className="text-sm text-gray-700">{template.name}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                프로그램 유형
              </label>
              <p className="text-sm text-gray-700">{template.program_type}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                상태
              </label>
              <p>
                {currentStatus === "draft" && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                    비활성
                  </span>
                )}
                {currentStatus === "active" && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    활성
                  </span>
                )}
                {currentStatus === "archived" && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                    보관
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                생성일
              </label>
              <p className="text-sm text-gray-700">
                {new Date(template.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
            {template.description && (
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  설명
                </label>
                <p className="text-sm text-gray-700">
                  {template.description}
                </p>
              </div>
            )}
            {template.camp_start_date && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  캠프 시작일
                </label>
                <p className="text-sm text-gray-700">
                  {new Date(template.camp_start_date).toLocaleDateString(
                    "ko-KR"
                  )}
                </p>
              </div>
            )}
            {template.camp_end_date && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  캠프 종료일
                </label>
                <p className="text-sm text-gray-700">
                  {new Date(template.camp_end_date).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
            {template.camp_location && (
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  캠프 장소
                </label>
                <p className="text-sm text-gray-700">
                  {template.camp_location}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 템플릿 데이터 상세 정보 */}
        {templateData && (
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              템플릿 설정 정보
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* 학습 기간 */}
              {templateData?.period_start && templateData?.period_end && (
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    학습 기간
                  </label>
                  <p className="text-sm text-gray-700">
                    {new Date(
                      templateData.period_start
                    ).toLocaleDateString("ko-KR")}{" "}
                    ~{" "}
                    {new Date(
                      templateData.period_end
                    ).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              )}

              {/* 스케줄러 유형 */}
              {templateData?.scheduler_type && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    스케줄러 유형
                  </label>
                  <p className="text-sm text-gray-700">
                    {schedulerTypeLabels[
                      templateData.scheduler_type
                    ] || templateData.scheduler_type}
                  </p>
                </div>
              )}

              {/* 플랜 목적 */}
              {templateData?.plan_purpose && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    플랜 목적
                  </label>
                  <p className="text-sm text-gray-700">
                    {planPurposeLabels[
                      templateData.plan_purpose
                    ] || templateData.plan_purpose}
                  </p>
                </div>
              )}

              {/* 학습일/복습일 주기 */}
              {templateData?.study_review_cycle && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    학습일/복습일 주기
                  </label>
                  <p className="text-sm text-gray-700">
                    학습일{" "}
                    {templateData.study_review_cycle.study_days || 0}
                    일 / 복습일{" "}
                    {templateData.study_review_cycle.review_days || 0}
                    일
                  </p>
                </div>
              )}

              {/* 목표 날짜 */}
              {templateData?.target_date && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    목표 날짜
                  </label>
                  <p className="text-sm text-gray-700">
                    {new Date(
                      templateData.target_date
                    ).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              )}

              {/* 학생 입력 허용 필드 */}
              {templateData?.templateLockedFields?.step1 && (
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    학생 입력 허용 필드
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {templateData.templateLockedFields.step1
                      .allow_student_name && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        이름
                      </span>
                    )}
                    {templateData.templateLockedFields.step1
                      .allow_student_plan_purpose && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        플랜 목적
                      </span>
                    )}
                    {templateData.templateLockedFields.step1
                      .allow_student_scheduler_type && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        스케줄러 유형
                      </span>
                    )}
                    {templateData.templateLockedFields.step1
                      .allow_student_period && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        학습 기간
                      </span>
                    )}
                    {!(
                      templateData.templateLockedFields.step1
                        .allow_student_name ||
                      templateData.templateLockedFields.step1
                        .allow_student_plan_purpose ||
                      templateData.templateLockedFields.step1
                        .allow_student_scheduler_type ||
                      templateData.templateLockedFields.step1
                        .allow_student_period
                    ) && (
                      <span className="text-xs text-gray-700">
                        학생 입력 허용 필드 없음
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 블록 세트 정보 */}
              {templateBlockSet && (
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    블록 세트
                  </label>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {templateBlockSet.name}
                      </p>
                    </div>
                    {templateBlockSet.blocks.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {templateBlockSet.blocks.map((block) => (
                          <div
                            key={block.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {weekdayLabels[block.day_of_week]}
                            </div>
                            <div className="text-xs text-gray-700">
                              {block.start_time} ~ {block.end_time}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">
                        등록된 시간 블록이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 발송된 초대 목록 */}
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
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
            onDeleteInvitations={handleDeleteInvitations}
            total={invitationTotal}
            page={invitationPage}
            pageSize={invitationPageSize}
            onPageChange={handleInvitationPageChange}
            onPageSizeChange={handleInvitationPageSizeChange}
            filters={invitationFilters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* 학생 초대 */}
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            학생 초대
          </h2>
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
          <p className="text-sm text-gray-700">
            이 템플릿을 삭제하면 관련된 모든 데이터가 함께 삭제됩니다. 삭제된
            템플릿은 복구할 수 없습니다.
          </p>
          {invitations.length > 0 && (
            <div className="rounded-lg bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800">
                ⚠️ 이 템플릿에 {invitations.length}개의 초대가 연결되어
                있습니다.
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
