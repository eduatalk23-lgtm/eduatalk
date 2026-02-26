"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Save, Loader2 } from "lucide-react";
import {
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
} from "@/lib/domains/sms/actions/customTemplates";
import { extractTemplateVariables } from "@/lib/domains/sms/utils/templateSubstitution";
import type {
  SMSCustomTemplate,
  SMSCustomTemplateCategory,
} from "@/lib/domains/sms/types";

type TemplateManagerProps = {
  templates: SMSCustomTemplate[];
  onRefresh: () => void;
  mode?: "inline" | "page";
};

const CATEGORY_OPTIONS: { value: SMSCustomTemplateCategory; label: string }[] = [
  { value: "general", label: "일반" },
  { value: "payment", label: "수납" },
  { value: "notice", label: "공지" },
  { value: "consultation", label: "상담" },
];

export function TemplateManager({
  templates,
  onRefresh,
  mode = "inline",
}: TemplateManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<SMSCustomTemplateCategory>("general");
  const [isPending, startTransition] = useTransition();

  const detectedVars = content ? extractTemplateVariables(content) : [];

  const handleNew = () => {
    setEditingId(null);
    setName("");
    setContent("");
    setCategory("general");
    setIsEditing(true);
  };

  const handleEdit = (t: SMSCustomTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.content);
    setCategory(t.category);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSave = () => {
    startTransition(async () => {
      if (editingId) {
        await updateCustomTemplate(editingId, { name, content, category });
      } else {
        await createCustomTemplate({ name, content, category });
      }
      setIsEditing(false);
      setEditingId(null);
      onRefresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteCustomTemplate(id);
      onRefresh();
    });
  };

  const isPage = mode === "page";

  return (
    <div className={`flex flex-col gap-4 ${isPage ? "" : "rounded-lg border border-gray-200 bg-white p-4"}`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-gray-900 ${isPage ? "text-lg" : "text-sm"}`}>
          템플릿 관리
        </h3>
        {!isEditing && (
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            새 템플릿
          </button>
        )}
      </div>

      {/* 편집 폼 */}
      {isEditing && (
        <div className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <input
            type="text"
            placeholder="템플릿 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SMSCustomTemplateCategory)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div>
            <textarea
              placeholder="템플릿 내용 (변수: {학원명}, {학생명} 등)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {detectedVars.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="text-xs text-gray-500">감지된 변수:</span>
                {detectedVars.map((v) => (
                  <span
                    key={v}
                    className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                  >
                    {`{${v}}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !name.trim() || !content.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              저장
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              취소
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      {templates.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          등록된 커스텀 템플릿이 없습니다.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{t.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label ?? t.category}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">{t.content}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleEdit(t)}
                  className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={isPending}
                  className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
