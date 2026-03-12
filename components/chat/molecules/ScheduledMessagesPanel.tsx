"use client";

/**
 * ScheduledMessagesPanel - 예약 메시지 관리 패널
 *
 * 예약된 메시지 목록 조회, 수정, 취소, 즉시전송, 삭제 기능을 제공합니다.
 * SlideOverPanel 패턴에 맞춰 우측 슬라이드 패널로 구현합니다.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Clock,
  Send,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getScheduledMessagesAction,
  cancelScheduledMessageAction,
  sendScheduledMessageNowAction,
  deleteScheduledMessageAction,
  updateScheduledMessageAction,
} from "@/lib/domains/chat/scheduled/actions";
import type {
  ScheduledMessage,
  ScheduledMessageStatus,
} from "@/lib/domains/chat/types";

// ============================================
// 타입
// ============================================

interface ScheduledMessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

type FilterStatus = "active" | "all" | ScheduledMessageStatus;

// ============================================
// 상수
// ============================================

const STATUS_BADGE: Record<
  ScheduledMessageStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "대기 중",
    className:
      "bg-warning-100 text-warning-700",
    icon: Clock,
  },
  sending: {
    label: "전송 중",
    className:
      "bg-info-100 text-info-700",
    icon: Loader2,
  },
  sent: {
    label: "전송 완료",
    className:
      "bg-success-100 text-success-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "전송 실패",
    className:
      "bg-error-100 text-error-700",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "취소됨",
    className:
      "bg-secondary-100 text-secondary-600",
    icon: XCircle,
  },
};

const FILTER_OPTIONS: Array<{ value: FilterStatus; label: string }> = [
  { value: "active", label: "활성" },
  { value: "pending", label: "대기" },
  { value: "failed", label: "실패" },
  { value: "sent", label: "완료" },
  { value: "cancelled", label: "취소" },
  { value: "all", label: "전체" },
];

// ============================================
// 날짜 포맷 헬퍼
// ============================================

function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  const timeStr = date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // 이미 지난 시간
  if (diffMs < 0) return timeStr;

  // 1시간 이내
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.ceil(diffMs / 60_000);
    return `${mins}분 후 · ${timeStr}`;
  }

  // 24시간 이내
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    return `${hours}시간 후 · ${timeStr}`;
  }

  return timeStr;
}

/** datetime-local input용 포맷 */
function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

// ============================================
// 메인 컴포넌트
// ============================================

export function ScheduledMessagesPanel({
  isOpen,
  onClose,
  roomId,
}: ScheduledMessagesPanelProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");

  // 삭제/취소 확인
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    action: "cancel" | "delete" | "sendNow";
  } | null>(null);

  const { showSuccess, showError } = useToast();

  // ============================================
  // 데이터 로드
  // ============================================

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusParam =
        filter === "active"
          ? undefined // 기본: pending + failed
          : filter === "all"
            ? ("all" as const)
            : (filter as ScheduledMessageStatus);

      const result = await getScheduledMessagesAction({
        roomId,
        status: statusParam,
      });
      if (result.success && result.data) {
        setMessages(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [roomId, filter]);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
    }
  }, [isOpen, loadMessages]);

  // ============================================
  // 액션 핸들러
  // ============================================

  const handleCancel = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        const result = await cancelScheduledMessageAction(id);
        if (result.success) {
          showSuccess("예약이 취소되었습니다");
          await loadMessages();
        } else {
          showError(result.error ?? "취소에 실패했습니다");
        }
      } finally {
        setActionLoadingId(null);
        setConfirmTarget(null);
      }
    },
    [loadMessages, showSuccess, showError]
  );

  const handleSendNow = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        const result = await sendScheduledMessageNowAction(id);
        if (result.success) {
          showSuccess("메시지가 즉시 전송되었습니다");
          await loadMessages();
        } else {
          showError(result.error ?? "전송에 실패했습니다");
        }
      } finally {
        setActionLoadingId(null);
        setConfirmTarget(null);
      }
    },
    [loadMessages, showSuccess, showError]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        const result = await deleteScheduledMessageAction(id);
        if (result.success) {
          showSuccess("예약 메시지가 삭제되었습니다");
          await loadMessages();
        } else {
          showError(result.error ?? "삭제에 실패했습니다");
        }
      } finally {
        setActionLoadingId(null);
        setConfirmTarget(null);
      }
    },
    [loadMessages, showSuccess, showError]
  );

  const handleEditStart = useCallback((msg: ScheduledMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
    setEditScheduledAt(toDatetimeLocalValue(new Date(msg.scheduled_at)));
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId) return;
    setActionLoadingId(editingId);
    try {
      const result = await updateScheduledMessageAction(editingId, {
        content: editContent,
        scheduled_at: new Date(editScheduledAt).toISOString(),
      });
      if (result.success) {
        showSuccess("예약 메시지가 수정되었습니다");
        setEditingId(null);
        await loadMessages();
      } else {
        showError(result.error ?? "수정에 실패했습니다");
      }
    } finally {
      setActionLoadingId(null);
    }
  }, [editingId, editContent, editScheduledAt, loadMessages, showSuccess, showError]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditContent("");
    setEditScheduledAt("");
  }, []);

  // 확인 다이얼로그 실행
  const handleConfirmAction = useCallback(() => {
    if (!confirmTarget) return;
    switch (confirmTarget.action) {
      case "cancel":
        handleCancel(confirmTarget.id);
        break;
      case "delete":
        handleDelete(confirmTarget.id);
        break;
      case "sendNow":
        handleSendNow(confirmTarget.id);
        break;
    }
  }, [confirmTarget, handleCancel, handleDelete, handleSendNow]);

  // datetime-local min/max
  const minDatetime = useMemo(() => {
    return toDatetimeLocalValue(new Date(Date.now() + 2 * 60_000));
  }, []);

  const maxDatetime = useMemo(() => {
    return toDatetimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }, []);

  // 확인 다이얼로그 텍스트
  const confirmConfig = useMemo(() => {
    if (!confirmTarget) return null;
    switch (confirmTarget.action) {
      case "cancel":
        return {
          title: "예약 취소",
          description: "이 예약 메시지를 취소하시겠습니까?",
          confirmLabel: "취소하기",
          variant: "destructive" as const,
        };
      case "delete":
        return {
          title: "메시지 삭제",
          description: "이 예약 메시지를 영구 삭제하시겠습니까?",
          confirmLabel: "삭제",
          variant: "destructive" as const,
        };
      case "sendNow":
        return {
          title: "즉시 전송",
          description: "이 메시지를 지금 바로 전송하시겠습니까?",
          confirmLabel: "전송",
          variant: "default" as const,
        };
    }
  }, [confirmTarget]);

  return (
    <>
      <SlideOverPanel
        isOpen={isOpen}
        onClose={onClose}
        id="scheduled-messages"
        title="예약 메시지"
        size="md"
        noPadding
      >
        {/* 필터 탭 */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
                filter === opt.value
                  ? "bg-primary-500 text-white"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
              )}
            >
              {opt.label}
            </button>
          ))}

          {/* 새로고침 */}
          <button
            type="button"
            onClick={loadMessages}
            disabled={isLoading}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:bg-bg-secondary transition-colors"
            aria-label="새로고침"
          >
            <RefreshCw
              className={cn("w-4 h-4", isLoading && "animate-spin")}
            />
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-text-tertiary animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
              <CalendarClock className="w-10 h-10 text-text-tertiary" />
              <p className="text-sm text-text-secondary">
                {filter === "active"
                  ? "예약된 메시지가 없습니다"
                  : "해당 상태의 메시지가 없습니다"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((msg) => (
                <ScheduledMessageItem
                  key={msg.id}
                  message={msg}
                  isEditing={editingId === msg.id}
                  isActionLoading={actionLoadingId === msg.id}
                  editContent={editContent}
                  editScheduledAt={editScheduledAt}
                  minDatetime={minDatetime}
                  maxDatetime={maxDatetime}
                  onEditStart={() => handleEditStart(msg)}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onEditContentChange={setEditContent}
                  onEditTimeChange={setEditScheduledAt}
                  onCancel={() =>
                    setConfirmTarget({ id: msg.id, action: "cancel" })
                  }
                  onSendNow={() =>
                    setConfirmTarget({ id: msg.id, action: "sendNow" })
                  }
                  onDelete={() =>
                    setConfirmTarget({ id: msg.id, action: "delete" })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </SlideOverPanel>

      {/* 확인 다이얼로그 */}
      {confirmConfig && (
        <ConfirmDialog
          open={!!confirmTarget}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel="돌아가기"
          variant={confirmConfig.variant}
          onConfirm={handleConfirmAction}
          isLoading={!!actionLoadingId}
        />
      )}
    </>
  );
}

// ============================================
// 리스트 아이템 컴포넌트
// ============================================

interface ScheduledMessageItemProps {
  message: ScheduledMessage;
  isEditing: boolean;
  isActionLoading: boolean;
  editContent: string;
  editScheduledAt: string;
  minDatetime: string;
  maxDatetime: string;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditContentChange: (value: string) => void;
  onEditTimeChange: (value: string) => void;
  onCancel: () => void;
  onSendNow: () => void;
  onDelete: () => void;
}

function ScheduledMessageItem({
  message,
  isEditing,
  isActionLoading,
  editContent,
  editScheduledAt,
  minDatetime,
  maxDatetime,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditContentChange,
  onEditTimeChange,
  onCancel,
  onSendNow,
  onDelete,
}: ScheduledMessageItemProps) {
  const badge = STATUS_BADGE[message.status];
  const StatusIcon = badge.icon;
  const isPending = message.status === "pending";
  const isFailed = message.status === "failed";
  const canEdit = isPending;
  const canCancel = isPending;
  const canSendNow = isPending;
  const canDelete = isPending || isFailed || message.status === "cancelled";

  if (isEditing) {
    return (
      <li className="px-4 py-3 space-y-3 bg-bg-secondary/50">
        {/* 내용 편집 */}
        <textarea
          value={editContent}
          onChange={(e) => onEditContentChange(e.target.value)}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg resize-none",
            "bg-bg-primary border border-border text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          )}
          rows={3}
          maxLength={1000}
        />

        {/* 시간 편집 */}
        <input
          type="datetime-local"
          value={editScheduledAt}
          onChange={(e) => onEditTimeChange(e.target.value)}
          min={minDatetime}
          max={maxDatetime}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg",
            "bg-bg-primary border border-border text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          )}
        />

        {/* 글자수 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {editContent.length}/1000
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEditCancel}
              disabled={isActionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onEditSave}
              disabled={
                isActionLoading ||
                editContent.trim().length === 0 ||
                !editScheduledAt
              }
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isActionLoading || editContent.trim().length === 0
                  ? "bg-secondary-200 text-text-tertiary cursor-not-allowed"
                  : "bg-primary-500 text-white hover:bg-primary-600"
              )}
            >
              {isActionLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "저장"
              )}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="px-4 py-3 hover:bg-bg-secondary/50 transition-colors">
      <div className="flex flex-col gap-1.5">
        {/* 상단: 상태 배지 + 시간 */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
              badge.className
            )}
          >
            <StatusIcon
              className={cn(
                "w-3 h-3",
                message.status === "sending" && "animate-spin"
              )}
            />
            {badge.label}
          </span>
          <span className="text-xs text-text-tertiary">
            {formatScheduledTime(message.scheduled_at)}
          </span>
          {isFailed && message.last_error && (
            <span className="text-[10px] text-error-500 truncate max-w-[120px]" title={message.last_error}>
              {message.last_error}
            </span>
          )}
        </div>

        {/* 메시지 내용 */}
        <p className="text-sm text-text-primary line-clamp-3">
          {message.content}
        </p>

        {/* 재시도 정보 */}
        {isFailed && (
          <p className="text-[10px] text-text-tertiary">
            시도 {message.attempts}/{message.max_attempts}회
          </p>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1.5">
        {canSendNow && (
          <button
            type="button"
            onClick={onSendNow}
            disabled={isActionLoading}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
              "text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            )}
          >
            <Send className="w-3 h-3" />
            즉시 전송
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={onEditStart}
            disabled={isActionLoading}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
              "text-text-secondary hover:bg-bg-tertiary"
            )}
          >
            <Pencil className="w-3 h-3" />
            수정
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isActionLoading}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
              "text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20"
            )}
          >
            <X className="w-3 h-3" />
            취소
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isActionLoading}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
              "text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
            )}
          >
            <Trash2 className="w-3 h-3" />
            삭제
          </button>
        )}

        {/* 로딩 인디케이터 */}
        {isActionLoading && (
          <Loader2 className="w-3.5 h-3.5 text-text-tertiary animate-spin flex-shrink-0" />
        )}
        </div>
      </div>
    </li>
  );
}
