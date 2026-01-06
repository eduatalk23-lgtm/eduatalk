"use client";

/**
 * 템플릿 선택 컴포넌트
 * 저장된 템플릿 목록에서 선택하여 설정을 불러오기
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  FileText,
  ChevronDown,
  Star,
  Clock,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import type { PlanCreationTemplate, TemplateSettings } from "../../_types/templateTypes";
import type { CreationMethod } from "../../_types";
import { getTemplates, deleteTemplate, setDefaultTemplate } from "../../_actions";

interface TemplateSelectorProps {
  creationMethod: CreationMethod;
  onSelect: (template: PlanCreationTemplate) => void;
  onSettingsLoad?: (settings: TemplateSettings) => void;
  className?: string;
}

export function TemplateSelector({
  creationMethod,
  onSelect,
  onSettingsLoad,
  className,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<PlanCreationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 템플릿 목록 로드
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await getTemplates({ creationMethod });
    if (!error && data) {
      setTemplates(data);
      // 기본 템플릿 자동 선택
      const defaultTemplate = data.find((t) => t.isDefault);
      if (defaultTemplate && !selectedId) {
        setSelectedId(defaultTemplate.id);
        onSelect(defaultTemplate);
        onSettingsLoad?.(defaultTemplate.settings);
      }
    }
    setIsLoading(false);
  }, [creationMethod, selectedId, onSelect, onSettingsLoad]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 템플릿 선택
  const handleSelect = useCallback(
    (template: PlanCreationTemplate) => {
      setSelectedId(template.id);
      onSelect(template);
      onSettingsLoad?.(template.settings);
      setIsOpen(false);
    },
    [onSelect, onSettingsLoad]
  );

  // 템플릿 삭제
  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;

      setDeletingId(id);
      const { success } = await deleteTemplate(id);
      if (success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
        }
      }
      setDeletingId(null);
    },
    [selectedId]
  );

  // 기본 템플릿 설정
  const handleSetDefault = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const { success } = await setDefaultTemplate(id);
      if (success) {
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            isDefault: t.id === id,
          }))
        );
      }
    },
    []
  );

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", textSecondary, className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">템플릿 로딩 중...</span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", textSecondary, className)}>
        <FileText className="h-4 w-4" />
        <span className="text-sm">저장된 템플릿이 없습니다</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-2.5",
          borderInput,
          "bg-white dark:bg-gray-800",
          textPrimary,
          "hover:bg-gray-50 dark:hover:bg-gray-700/50",
          "transition"
        )}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm">
            {selectedTemplate ? selectedTemplate.name : "템플릿 선택"}
          </span>
          {selectedTemplate?.isDefault && (
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 메뉴 */}
          <div
            className={cn(
              "absolute left-0 right-0 top-full z-20 mt-1",
              "max-h-64 overflow-y-auto rounded-lg border shadow-lg",
              borderInput,
              "bg-white dark:bg-gray-800"
            )}
          >
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleSelect(template)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-4 py-3",
                  "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  "transition",
                  selectedId === template.id && "bg-purple-50 dark:bg-purple-900/20"
                )}
              >
                <div className="flex flex-1 items-center gap-3">
                  {selectedId === template.id ? (
                    <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", textPrimary)}>
                        {template.name}
                      </span>
                      {template.isDefault && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    {template.description && (
                      <p className={cn("text-xs", textSecondary)}>
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* 기본 설정 버튼 */}
                  {!template.isDefault && (
                    <button
                      onClick={(e) => handleSetDefault(e, template.id)}
                      className={cn(
                        "rounded p-1.5 transition",
                        "text-gray-400 hover:bg-amber-50 hover:text-amber-500",
                        "dark:hover:bg-amber-900/20"
                      )}
                      title="기본 템플릿으로 설정"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => handleDelete(e, template.id)}
                    disabled={deletingId === template.id}
                    className={cn(
                      "rounded p-1.5 transition",
                      "text-gray-400 hover:bg-red-50 hover:text-red-500",
                      "dark:hover:bg-red-900/20",
                      deletingId === template.id && "opacity-50"
                    )}
                    title="템플릿 삭제"
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
