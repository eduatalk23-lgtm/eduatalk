"use client";

/**
 * AnnouncementDialog - 채팅방 공지 설정 다이얼로그
 *
 * 공지 작성/편집을 위한 모달 다이얼로그입니다.
 */

import { memo, useState, useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";

interface AnnouncementDialogProps {
  /** 다이얼로그 열림 여부 */
  open: boolean;
  /** 다이얼로그 닫기 */
  onOpenChange: (open: boolean) => void;
  /** 현재 공지 내용 (편집 시) */
  currentContent?: string | null;
  /** 저장 콜백 */
  onSave: (content: string) => void;
  /** 저장 중 여부 */
  isSaving?: boolean;
}

function AnnouncementDialogComponent({
  open,
  onOpenChange,
  currentContent,
  onSave,
  isSaving = false,
}: AnnouncementDialogProps) {
  const [content, setContent] = useState(currentContent ?? "");

  // 다이얼로그가 열릴 때 현재 공지 내용으로 초기화
  useEffect(() => {
    if (open) {
      setContent(currentContent ?? "");
    }
  }, [open, currentContent]);

  const handleSave = () => {
    const trimmedContent = content.trim();
    if (trimmedContent) {
      onSave(trimmedContent);
    }
  };

  const isValidContent = content.trim().length > 0 && content.trim().length <= 500;
  const characterCount = content.length;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={currentContent ? "공지 편집" : "공지 설정"}
      size="md"
    >
      <div className="space-y-4">
        {/* 입력 영역 */}
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="채팅방 공지를 입력하세요..."
            className="w-full h-32 p-3 text-sm border border-border rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
              bg-background text-text-primary placeholder:text-text-tertiary"
            maxLength={500}
            disabled={isSaving}
          />
          <div className="flex justify-end mt-1">
            <span
              className={`text-xs ${
                characterCount > 500 ? "text-error" : "text-text-tertiary"
              }`}
            >
              {characterCount}/500
            </span>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isValidContent || isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export const AnnouncementDialog = memo(AnnouncementDialogComponent);
