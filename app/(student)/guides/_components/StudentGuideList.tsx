"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { getContainerClass } from "@/lib/constants/layout";
import {
  studentGuideAssignmentsQueryOptions,
  studentGuideCompletionRateQueryOptions,
  studentGuideKeys,
} from "@/lib/query-options/explorationGuide";
import { updateMyAssignmentStatusAction } from "@/lib/domains/guide/actions/student-guide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { AssignmentWithGuide, AssignmentStatus } from "@/lib/domains/guide/types";
import { StudentGuideDetail } from "./StudentGuideDetail";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PlayCircle,
  Send,
} from "lucide-react";
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
} from "@/lib/utils/darkMode";

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { label: string; color: string; bg: string }
> = {
  assigned: { label: "배정됨", color: "text-blue-700", bg: "bg-blue-50" },
  in_progress: { label: "진행중", color: "text-amber-700", bg: "bg-amber-50" },
  submitted: { label: "제출완료", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "완료", color: "text-emerald-700", bg: "bg-emerald-50" },
  cancelled: { label: "취소", color: "text-gray-500", bg: "bg-gray-100" },
};

export function StudentGuideList() {
  const queryClient = useQueryClient();
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: assignmentsRes, isLoading } = useQuery(
    studentGuideAssignmentsQueryOptions(),
  );
  const { data: rateRes } = useQuery(studentGuideCompletionRateQueryOptions());

  const assignments = assignmentsRes?.success ? assignmentsRes.data ?? [] : [];
  const rate = rateRes?.success ? rateRes.data : null;

  const handleStatusChange = async (
    assignmentId: string,
    status: AssignmentStatus,
  ) => {
    setUpdatingId(assignmentId);
    try {
      const res = await updateMyAssignmentStatusAction(assignmentId, status);
      if (res.success) {
        queryClient.invalidateQueries({
          queryKey: studentGuideKeys.assignments(),
        });
        queryClient.invalidateQueries({
          queryKey: studentGuideKeys.completionRate(),
        });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetail = (guideId: string) => {
    setSelectedGuideId(guideId);
    setDetailOpen(true);
  };

  return (
    <section className={getContainerClass("LIST", "md")}>
      {/* 헤더 + 이행률 */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={cn("text-xl font-bold", textPrimaryVar)}>탐구 가이드</h1>
        {rate && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm",
              bgSurfaceVar,
              borderDefaultVar,
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className={textSecondaryVar}>
              이행률{" "}
              <span className={cn("font-semibold", textPrimaryVar)}>
                {rate.linked}/{rate.total}
              </span>{" "}
              ({rate.rate}%)
            </span>
          </div>
        )}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className={cn("h-6 w-6 animate-spin", textTertiaryVar)} />
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && assignments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16">
          <BookOpen className={cn("h-10 w-10", textTertiaryVar)} />
          <p className={cn("text-sm", textTertiaryVar)}>
            배정된 탐구 가이드가 없습니다.
          </p>
        </div>
      )}

      {/* 카드 리스트 */}
      {!isLoading && assignments.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              isUpdating={updatingId === a.id}
              onOpenDetail={openDetail}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* 상세 Dialog */}
      <StudentGuideDetail
        guideId={selectedGuideId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </section>
  );
}

function AssignmentCard({
  assignment,
  isUpdating,
  onOpenDetail,
  onStatusChange,
}: {
  assignment: AssignmentWithGuide;
  isUpdating: boolean;
  onOpenDetail: (guideId: string) => void;
  onStatusChange: (assignmentId: string, status: AssignmentStatus) => void;
}) {
  const guide = assignment.exploration_guides;
  const statusCfg = STATUS_CONFIG[assignment.status];

  return (
    <div
      className={cn(
        "group flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-md",
        bgSurfaceVar,
        borderDefaultVar,
      )}
      onClick={() => onOpenDetail(guide.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(guide.id);
        }
      }}
    >
      {/* 상단: 유형 + 상태 */}
      <div className="flex items-center justify-between">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {GUIDE_TYPE_LABELS[guide.guide_type]}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusCfg.bg,
            statusCfg.color,
          )}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* 제목 */}
      <h3
        className={cn(
          "line-clamp-2 text-sm font-semibold leading-snug",
          textPrimaryVar,
        )}
      >
        {guide.title}
      </h3>

      {/* 도서 정보 */}
      {guide.book_title && (
        <p className={cn("line-clamp-1 text-xs", textTertiaryVar)}>
          {guide.book_title}
          {guide.book_author ? ` — ${guide.book_author}` : ""}
        </p>
      )}

      {/* 하단: 날짜 + 액션 */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className={cn("text-xs", textTertiaryVar)}>
          <Clock className="mr-1 inline-block h-3 w-3" />
          {new Date(assignment.created_at).toLocaleDateString("ko-KR")}
        </span>

        {/* 상태 변경 버튼 */}
        {assignment.status === "assigned" && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(assignment.id, "in_progress");
            }}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PlayCircle className="h-3 w-3" />
            )}
            진행 시작
          </button>
        )}
        {assignment.status === "in_progress" && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-purple-500 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50"
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(assignment.id, "submitted");
            }}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            제출
          </button>
        )}
        {(assignment.status === "submitted" ||
          assignment.status === "completed") && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            {assignment.status === "completed" ? "완료" : "제출됨"}
          </span>
        )}
      </div>

      {/* 관리자 메모 */}
      {assignment.notes && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <FileText className="mr-1 inline-block h-3 w-3" />
          {assignment.notes}
        </div>
      )}
    </div>
  );
}
