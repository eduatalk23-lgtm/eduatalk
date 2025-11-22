"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";

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
    group.plans[0]?.content_type === "book"
      ? "📚"
      : group.plans[0]?.content_type === "lecture"
      ? "🎧"
      : "📝";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">플랜 메모</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              <span className="text-lg">{contentTypeIcon}</span>
              <span>{contentTitle}</span>
              {group.sequence && (
                <span className="text-xs text-gray-500">({group.sequence}회차)</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-6">
          {/* 메모 입력 영역 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>줄바꿈 및 특수 문자 허용</span>
              <span className={memo.length > MAX_MEMO_LENGTH * 0.9 ? "text-amber-600" : ""}>
                {memo.length}/{MAX_MEMO_LENGTH}자
              </span>
            </div>
          </div>

          {/* 추천 메모 템플릿 */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">💡</span>
              <h3 className="text-sm font-semibold text-gray-900">추천 메모</h3>
            </div>
            <div className="mb-3">
              <p className="mb-2 text-xs text-gray-600">템플릿:</p>
              <div className="flex flex-wrap gap-2">
                {MEMO_TEMPLATES.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateClick(item.template)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-gray-600">빠른 입력:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_INPUTS.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickInputClick(item.template)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || memo.length > MAX_MEMO_LENGTH}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

