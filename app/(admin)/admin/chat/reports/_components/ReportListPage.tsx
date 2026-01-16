"use client";

/**
 * 관리자 신고 관리 페이지 클라이언트 컴포넌트
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllReportsAction,
  resolveReportAction,
  getReportDetailsAction,
} from "@/lib/domains/chat/actions/safety";
import type {
  ChatReport,
  ChatReportWithDetails,
  ReportStatus,
  ReportReason,
} from "@/lib/domains/chat/types";
import { useToast } from "@/components/ui/ToastProvider";
import { ReportTable } from "./ReportTable";
import { ReportFilter } from "./ReportFilter";
import { ReportDetailModal } from "./ReportDetailModal";
import { Loader2, AlertTriangle } from "lucide-react";

export function ReportListPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<ReportReason | "all">("all");

  // 모달 상태
  const [selectedReport, setSelectedReport] =
    useState<ChatReportWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // 신고 목록 조회
  const {
    data: reports,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-chat-reports", statusFilter, reasonFilter],
    queryFn: async () => {
      const result = await getAllReportsAction({
        status: statusFilter,
        reason: reasonFilter,
      });
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });

  // 신고 처리 뮤테이션
  const resolveMutation = useMutation({
    mutationFn: async ({
      reportId,
      status,
      notes,
    }: {
      reportId: string;
      status: "resolved" | "dismissed";
      notes?: string;
    }) => {
      const result = await resolveReportAction(reportId, status, notes);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      showToast("신고가 처리되었습니다.", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-chat-reports"] });
      setIsModalOpen(false);
      setSelectedReport(null);
    },
    onError: (error: Error) => {
      showToast(error.message || "신고 처리에 실패했습니다.", "error");
    },
  });

  // 신고 상세 조회
  const handleViewDetails = async (report: ChatReport) => {
    setIsLoadingDetails(true);
    try {
      const result = await getReportDetailsAction(report.id);
      if (result.success && result.data) {
        setSelectedReport(result.data);
        setIsModalOpen(true);
      } else {
        showToast(result.error || "상세 정보를 불러오지 못했습니다.", "error");
      }
    } catch {
      showToast("상세 정보를 불러오지 못했습니다.", "error");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // 신고 처리 핸들러
  const handleResolve = (
    reportId: string,
    status: "resolved" | "dismissed",
    notes?: string
  ) => {
    resolveMutation.mutate({ reportId, status, notes });
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setStatusFilter("all");
    setReasonFilter("all");
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">신고 관리</h1>
          <p className="text-sm text-text-secondary">
            사용자 신고를 검토하고 처리합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* 필터 */}
      <ReportFilter
        statusFilter={statusFilter}
        reasonFilter={reasonFilter}
        onStatusChange={setStatusFilter}
        onReasonChange={setReasonFilter}
        onReset={handleResetFilters}
      />

      {/* 테이블 또는 로딩/에러 상태 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <AlertTriangle className="w-12 h-12 text-warning" />
          <p className="text-text-secondary">신고 목록을 불러오지 못했습니다</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            다시 시도
          </button>
        </div>
      ) : reports && reports.length > 0 ? (
        <ReportTable
          reports={reports}
          onViewDetails={handleViewDetails}
          isLoadingDetails={isLoadingDetails}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-bg-secondary rounded-lg">
          <p className="text-text-secondary">신고 내역이 없습니다</p>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedReport && (
        <ReportDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
          onResolve={handleResolve}
          isResolving={resolveMutation.isPending}
        />
      )}
    </div>
  );
}
