/**
 * RequiredSubjectItem
 * 필수 교과 개별 항목 컴포넌트
 */

"use client";

import { useState } from "react";
import { X } from "lucide-react";

type RequiredSubjectItemProps = {
  requirement: {
    subject_category: string;
    subject?: string;
    min_count: number;
  };
  index: number;
  availableSubjects: string[];
  availableDetailSubjects: string[];
  loadingDetailSubjects: boolean;
  onUpdate: (
    updated: Partial<{
      subject_category: string;
      subject?: string;
      min_count: number;
    }>
  ) => void;
  onRemove: () => void;
  onLoadDetailSubjects: (category: string) => void;
};

export default function RequiredSubjectItem({
  requirement,
  availableSubjects,
  availableDetailSubjects,
  loadingDetailSubjects,
  onUpdate,
  onRemove,
  onLoadDetailSubjects,
}: RequiredSubjectItemProps) {
  const [showDetailSubjects, setShowDetailSubjects] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        {/* 교과 선택 */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            교과
          </label>
          <select
            value={requirement.subject_category}
            onChange={(e) =>
              onUpdate({ subject_category: e.target.value, subject: undefined })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">교과 선택</option>
            {availableSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        {/* 최소 개수 */}
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            최소 개수
          </label>
          <input
            type="number"
            min="1"
            max="9"
            value={requirement.min_count}
            onChange={(e) =>
              onUpdate({ min_count: parseInt(e.target.value) || 1 })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="필수 교과 삭제"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 세부 과목 선택 (선택사항) */}
      {requirement.subject_category && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setShowDetailSubjects(!showDetailSubjects);
              if (!showDetailSubjects && availableDetailSubjects.length === 0) {
                onLoadDetailSubjects(requirement.subject_category);
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showDetailSubjects
              ? "세부 과목 숨기기"
              : "세부 과목 지정 (선택사항)"}
          </button>

          {showDetailSubjects && (
            <div className="mt-2">
              {loadingDetailSubjects ? (
                <p className="text-xs text-gray-500">
                  세부 과목 불러오는 중...
                </p>
              ) : availableDetailSubjects.length > 0 ? (
                <select
                  value={requirement.subject || ""}
                  onChange={(e) =>
                    onUpdate({ subject: e.target.value || undefined })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="">세부 과목 선택 (전체)</option>
                  {availableDetailSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500">
                  세부 과목 정보가 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

