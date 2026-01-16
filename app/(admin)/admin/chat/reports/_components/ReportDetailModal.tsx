"use client";

/**
 * 신고 상세 모달 컴포넌트
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import type { ChatReportWithDetails, ReportReason } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";
import { Loader2, User, MessageSquare, Clock, FileText } from "lucide-react";

interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ChatReportWithDetails;
  onResolve: (
    reportId: string,
    status: "resolved" | "dismissed",
    notes?: string
  ) => void;
  isResolving: boolean;
}

// 사유 라벨
const REASON_LABELS: Record<ReportReason, string> = {
  spam: "스팸",
  harassment: "괴롭힘",
  inappropriate: "부적절한 내용",
  hate_speech: "혐오 발언",
  other: "기타",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportDetailModal({
  isOpen,
  onClose,
  report,
  onResolve,
  isResolving,
}: ReportDetailModalProps) {
  const [notes, setNotes] = useState("");

  const handleResolve = (status: "resolved" | "dismissed") => {
    onResolve(report.id, status, notes || undefined);
  };

  const isPending = report.status === "pending";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="신고 상세"
      size="lg"
    >
      <DialogContent className="space-y-6 overflow-y-auto max-h-[60vh]">
        {/* 신고 정보 */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            신고 정보
          </h3>
          <div className="bg-bg-secondary rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">사유</span>
              <span className="text-sm font-medium text-text-primary">
                {REASON_LABELS[report.reason]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">신고 일시</span>
              <span className="text-sm text-text-primary">
                {formatDate(report.created_at)}
              </span>
            </div>
            {report.description && (
              <div className="pt-2 border-t border-border space-y-1">
                <span className="text-sm text-text-secondary block">
                  상세 설명
                </span>
                <p className="text-sm text-text-primary">
                  {report.description}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 신고자 정보 */}
        {report.reporter && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <User className="w-4 h-4" />
              신고자
            </h3>
            <div className="bg-bg-secondary rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {report.reporter.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {report.reporter.type === "admin" ? "관리자" : "학생"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 신고된 메시지 */}
        {report.reportedMessage && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              신고된 메시지
            </h3>
            <div className="bg-error/5 border border-error/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {report.reportedMessage.content}
              </p>
              <div className="flex items-center gap-2 pt-3 border-t border-error/10">
                <Clock className="w-3 h-3 text-text-tertiary" />
                <span className="text-xs text-text-tertiary">
                  {formatDate(report.reportedMessage.created_at)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 처리 영역 (대기 중인 신고만) */}
        {isPending && (
          <section className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-sm font-medium text-text-primary">처리</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="처리 메모를 입력하세요 (선택)"
              rows={3}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg",
                "bg-bg-secondary text-text-primary",
                "border border-border focus:border-primary focus:outline-none",
                "placeholder:text-text-tertiary resize-none"
              )}
            />
          </section>
        )}

        {/* 이미 처리된 신고 */}
        {!isPending && report.resolution_notes && (
          <section className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-sm font-medium text-text-primary">처리 내역</h3>
            <div className="bg-bg-secondary rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">처리 상태</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    report.status === "resolved"
                      ? "text-success"
                      : "text-text-tertiary"
                  )}
                >
                  {report.status === "resolved" ? "승인됨" : "기각됨"}
                </span>
              </div>
              {report.reviewed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">처리 일시</span>
                  <span className="text-sm text-text-primary">
                    {formatDate(report.reviewed_at)}
                  </span>
                </div>
              )}
              {report.resolution_notes && (
                <div className="pt-2 border-t border-border space-y-1">
                  <span className="text-sm text-text-secondary block">
                    처리 메모
                  </span>
                  <p className="text-sm text-text-primary">
                    {report.resolution_notes}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </DialogContent>

      {/* 푸터 (대기 중인 신고만) */}
      {isPending && (
        <DialogFooter>
          <button
            type="button"
            onClick={() => handleResolve("dismissed")}
            disabled={isResolving}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg",
              "bg-bg-tertiary text-text-primary hover:bg-bg-secondary",
              "transition-colors disabled:opacity-50"
            )}
          >
            기각
          </button>
          <button
            type="button"
            onClick={() => handleResolve("resolved")}
            disabled={isResolving}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg",
              "bg-primary text-white hover:bg-primary-hover",
              "transition-colors disabled:opacity-50",
              "flex items-center justify-center gap-2"
            )}
          >
            {isResolving && <Loader2 className="w-4 h-4 animate-spin" />}
            승인 처리
          </button>
        </DialogFooter>
      )}
    </Dialog>
  );
}
