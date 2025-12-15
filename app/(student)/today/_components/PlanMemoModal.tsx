"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { PlanGroup } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";
import {
  inputFieldBase,
  modalLabel,
  modalCancelButton,
  textPrimary,
  textSecondary,
  textTertiary,
  inlineButtonBase,
} from "@/lib/utils/darkMode";

type PlanMemoModalProps = {
  group: PlanGroup;
  memo: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: string) => Promise<void>;
};

const MEMO_TEMPLATES = [
  { icon: "📌", label: "핵심 정리", template: "📌 핵심 정리:\n- \n- \n-" },
  { icon: "📌", label: "복습 필요", template: "📌 복습 필요:\n- \n- \n-" },
  { icon: "📌", label: "질문 사항", template: "📌 질문 사항:\n- \n- \n-" },
  { icon: "📌", label: "추가 자료", template: "📌 추가 자료:\n- \n- \n-" },
];

const QUICK_INPUTS = [
  { icon: "🚀", label: "오늘 목표", template: "🚀 오늘 목표: " },
  { icon: "⚠️", label: "주의사항", template: "⚠️ 주의사항: " },
  { icon: "✅", label: "완료 체크", template: "✅ 완료 체크:\n- [ ] \n- [ ] \n- [ ]" },
];

const MAX_MEMO_LENGTH = 500;

export function PlanMemoModal({
  group,
  memo: initialMemo,
  isOpen,
  onClose,
  onSave,
}: PlanMemoModalProps) {
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMemo(initialMemo ?? "");
    }
  }, [isOpen, initialMemo]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(memo.trim());
      onClose();
    } catch (error) {
      alert("메모 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateClick = (template: string) => {
    if (memo.trim().length > 0) {
      setMemo((prev) => prev + "\n\n" + template);
    } else {
      setMemo(template);
    }
  };

  const handleQuickInputClick = (template: string) => {
    setMemo((prev) => prev + (prev.trim().length > 0 ? "\n" : "") + template);
  };

  const contentTitle = group.content?.title || "제목 없음";
  const contentTypeIcon =
    group.plan.content_type === "book"
      ? "📚"
      : group.plan.content_type === "lecture"
      ? "🎧"
      : "📝";

  const descriptionText = `${contentTypeIcon} ${contentTitle}${group.sequence ? ` (${group.sequence}회차)` : ""}`;

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="플랜 메모"
      description={descriptionText}
      maxWidth="2xl"
    >
      <DialogContent>
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* 메모 입력 영역 */}
            <div className="flex flex-col gap-2">
              <label className={modalLabel}>
                메모 입력
              </label>
              <textarea
                value={memo}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= MAX_MEMO_LENGTH) {
                    setMemo(value);
                  }
                }}
                placeholder="메모를 입력하세요..."
                rows={8}
                className={cn(
                  inputFieldBase,
                  "py-3 placeholder-gray-400 dark:placeholder-gray-500"
                )}
              />
              <div className={cn("flex items-center justify-between text-xs", textTertiary)}>
                <span>줄바꿈 및 특수 문자 허용</span>
                <span className={memo.length > MAX_MEMO_LENGTH * 0.9 ? "text-amber-600 dark:text-amber-500" : ""}>
                  {memo.length}/{MAX_MEMO_LENGTH}자
                </span>
              </div>
            </div>

            {/* 추천 메모 템플릿 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h3 className={cn("text-sm font-semibold", textPrimary)}>추천 메모</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p className={cn("text-xs", textSecondary)}>템플릿:</p>
                  <div className="flex flex-wrap gap-2">
                    {MEMO_TEMPLATES.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleTemplateClick(item.template)}
                        className={cn(
                          inlineButtonBase(),
                          "hover:border-indigo-300 dark:hover:border-indigo-600",
                          "hover:text-indigo-600 dark:hover:text-indigo-400"
                        )}
                        aria-label={`${item.label} 템플릿 추가`}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className={cn("text-xs", textSecondary)}>빠른 입력:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_INPUTS.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickInputClick(item.template)}
                        className={cn(
                          inlineButtonBase(),
                          "hover:border-indigo-300 dark:hover:border-indigo-600",
                          "hover:text-indigo-600 dark:hover:text-indigo-400"
                        )}
                        aria-label={`${item.label} 빠른 입력 추가`}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <button
          onClick={onClose}
          className={modalCancelButton}
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || memo.length > MAX_MEMO_LENGTH}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          aria-label="메모 저장"
        >
          <Save className="h-4 w-4" />
          저장
        </button>
      </DialogFooter>
    </Dialog>
  );
}

