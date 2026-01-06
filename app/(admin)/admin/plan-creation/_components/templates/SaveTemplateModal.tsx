"use client";

/**
 * 템플릿 저장 모달
 * 현재 설정을 템플릿으로 저장
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  X,
  Save,
  FileText,
  Star,
  Loader2,
} from "lucide-react";
import type { TemplateSettings, CreateTemplateInput } from "../../_types/templateTypes";
import type { CreationMethod } from "../../_types";
import { createTemplate } from "../../_actions";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  creationMethod: CreationMethod;
  currentSettings: TemplateSettings;
  onSaved?: () => void;
}

const METHOD_LABELS: Record<CreationMethod, string> = {
  ai: "AI 플랜",
  planGroup: "플랜 그룹",
  quickPlan: "빠른 플랜",
  contentAdd: "콘텐츠 추가",
};

export function SaveTemplateModal({
  isOpen,
  onClose,
  creationMethod,
  currentSettings,
  onSaved,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장 처리
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("템플릿 이름을 입력해주세요");
      return;
    }

    setIsSaving(true);
    setError(null);

    const input: CreateTemplateInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      creationMethod,
      isDefault,
      settings: currentSettings,
    };

    const { data, error: saveError } = await createTemplate(input);

    if (saveError) {
      setError(saveError);
      setIsSaving(false);
      return;
    }

    if (data) {
      onSaved?.();
      onClose();
      // 폼 초기화
      setName("");
      setDescription("");
      setIsDefault(false);
    }

    setIsSaving(false);
  }, [name, description, isDefault, creationMethod, currentSettings, onSaved, onClose]);

  // 모달 닫기 처리
  const handleClose = useCallback(() => {
    if (isSaving) return;
    onClose();
  }, [isSaving, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl shadow-xl",
          "bg-white dark:bg-gray-900",
          "border",
          borderInput
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className={cn("font-semibold", textPrimary)}>템플릿 저장</h3>
              <p className={cn("text-sm", textSecondary)}>
                {METHOD_LABELS[creationMethod]} 설정을 템플릿으로 저장
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className={cn(
              "rounded-lg p-2 transition",
              textSecondary,
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              isSaving && "cursor-not-allowed opacity-50"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="space-y-4 p-6">
          {/* 템플릿 이름 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              템플릿 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본 AI 플랜 설정"
              className={cn(
                "w-full rounded-lg border px-4 py-2.5",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary,
                "focus:ring-2 focus:ring-purple-500"
              )}
              disabled={isSaving}
            />
          </div>

          {/* 설명 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 템플릿에 대한 설명을 입력하세요"
              rows={3}
              className={cn(
                "w-full resize-none rounded-lg border px-4 py-2.5",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary
              )}
              disabled={isSaving}
            />
          </div>

          {/* 기본 템플릿 설정 */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              disabled={isSaving}
            />
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              <span className={cn("text-sm", textPrimary)}>
                기본 템플릿으로 설정
              </span>
            </div>
          </label>

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              borderInput,
              "border",
              textPrimary,
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              isSaving && "cursor-not-allowed opacity-50"
            )}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              "bg-purple-600 text-white hover:bg-purple-700",
              (isSaving || !name.trim()) && "cursor-not-allowed opacity-50"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                템플릿 저장
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
