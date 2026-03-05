"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import { submitFileForRequestAction } from "@/lib/domains/drive/actions/workflow";
import {
  FILE_CATEGORY_LABELS,
  type DriveFile,
  type FileRequest,
} from "@/lib/domains/drive/types";
import { formatFileSize } from "@/lib/domains/drive/validation";

interface WorkflowRequestCardProps {
  request: FileRequest;
  files: DriveFile[];
  studentId: string;
  onUpdate: () => void;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "제출 대기",
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
  overdue: {
    icon: AlertCircle,
    label: "기한 초과",
    color: "text-red-600 bg-red-50 border-red-200",
  },
  submitted: {
    icon: FileText,
    label: "검토 대기",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  approved: {
    icon: Check,
    label: "승인됨",
    color: "text-green-600 bg-green-50 border-green-200",
  },
  rejected: {
    icon: XCircle,
    label: "반려됨",
    color: "text-red-600 bg-red-50 border-red-200",
  },
} as const;

export function WorkflowRequestCard({
  request,
  files,
  studentId,
  onUpdate,
}: WorkflowRequestCardProps) {
  const config = STATUS_CONFIG[request.status];
  const StatusIcon = config.icon;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    request.status === "pending" ||
    request.status === "overdue" ||
    request.status === "rejected";

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const result = await submitFileForRequestAction(request.id, formData);
      if (!result.success) {
        setError(result.error ?? "제출에 실패했습니다.");
        return;
      }
      onUpdate();
    });

    // input 초기화
    if (inputRef.current) inputRef.current.value = "";
  }

  const deadlineStr = request.deadline
    ? new Date(request.deadline).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className={cn("rounded-lg border p-4", config.color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-medium">{config.label}</span>
            <span className="text-xs opacity-70">
              {FILE_CATEGORY_LABELS[request.category]}
            </span>
          </div>
          <h3 className="text-sm font-semibold">{request.title}</h3>
          {request.description && (
            <p className="text-xs mt-1 opacity-80">{request.description}</p>
          )}
          {deadlineStr && (
            <p className="text-xs mt-1 opacity-70">기한: {deadlineStr}</p>
          )}
        </div>

        {canSubmit && (
          <div>
            <input
              ref={inputRef}
              type="file"
              onChange={handleFileSelected}
              className="hidden"
              accept="image/*,application/pdf,.hwp,.doc,.docx"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              isLoading={isPending}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {request.status === "rejected" ? "재제출" : "제출"}
            </Button>
          </div>
        )}
      </div>

      {/* 반려 사유 */}
      {request.status === "rejected" && request.rejection_reason && (
        <div className="mt-2 p-2 bg-white/50 rounded text-xs">
          <span className="font-medium">반려 사유:</span>{" "}
          {request.rejection_reason}
        </div>
      )}

      {/* 제출된 파일 목록 */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 text-xs bg-white/50 rounded px-2 py-1"
            >
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{file.original_name}</span>
              <span className="text-gray-500 flex-shrink-0">
                v{file.version_number}
              </span>
              <span className="text-gray-500 flex-shrink-0">
                {formatFileSize(file.size_bytes)}
              </span>
              <span className="text-gray-500 flex-shrink-0">
                {file.uploaded_by_role === "parent" ? "학부모" : "학생"}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
