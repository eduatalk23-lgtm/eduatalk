"use client";

/**
 * EditMessageDialog - 메시지 수정 다이얼로그
 *
 * 채팅 메시지 수정을 위한 모달 다이얼로그입니다.
 */

import { memo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";

interface EditMessageDialogProps {
  /** 다이얼로그 열림 여부 */
  open: boolean;
  /** 다이얼로그 닫기 */
  onOpenChange: (open: boolean) => void;
  /** 현재 메시지 내용 */
  currentContent: string;
  /** 저장 콜백 */
  onSave: (content: string) => void;
  /** 저장 중 여부 */
  isSaving?: boolean;
}

interface EditMessageFormProps {
  currentContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditMessageForm({
  currentContent,
  onSave,
  onCancel,
  isSaving,
}: EditMessageFormProps) {
  const [content, setContent] = useState(currentContent);

  const handleSave = () => {
    const trimmedContent = content.trim();
    if (trimmedContent && trimmedContent !== currentContent.trim()) {
      onSave(trimmedContent);
    }
  };

  const trimmedContent = content.trim();
  const isValidContent = trimmedContent.length > 0 && trimmedContent.length <= 1000;
  const hasChanged = trimmedContent !== currentContent.trim();
  const characterCount = content.length;

  return (
    <div className="space-y-4">
      {/* 입력 영역 */}
      <div className="flex flex-col gap-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="w-full h-32 p-3 text-sm border border-border rounded-lg resize-none
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            bg-background text-text-primary placeholder:text-text-tertiary"
          maxLength={1000}
          disabled={isSaving}
          autoFocus
        />
        <div className="flex justify-end">
          <span
            className={`text-xs ${
              characterCount > 1000 ? "text-error" : "text-text-tertiary"
            }`}
          >
            {characterCount}/1000
          </span>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          취소
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isValidContent || !hasChanged || isSaving}
        >
          {isSaving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}

function EditMessageDialogComponent({
  open,
  onOpenChange,
  currentContent,
  onSave,
  isSaving = false,
}: EditMessageDialogProps) {
  // 폼 상태 초기화를 위한 key (content가 변경될 때마다 갱신)
  const formKey = open ? currentContent : "";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="메시지 수정"
      size="md"
    >
      {open && (
        <EditMessageForm
          key={formKey}
          currentContent={currentContent}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
          isSaving={isSaving}
        />
      )}
    </Dialog>
  );
}

export const EditMessageDialog = memo(EditMessageDialogComponent);
