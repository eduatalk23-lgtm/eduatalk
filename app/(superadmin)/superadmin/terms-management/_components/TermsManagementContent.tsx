"use client";

import { useState } from "react";
import { TERMS_CONTENT_TYPES, TERMS_CONTENT_TYPE_LABELS } from "@/lib/constants/terms";
import type { TermsContentType } from "@/lib/types/terms";
import { TermsContentForm } from "./TermsContentForm";
import { TermsContentList } from "./TermsContentList";
import { TermsPreview } from "./TermsPreview";

export function TermsManagementContent() {
  const [activeTab, setActiveTab] = useState<TermsContentType>("terms");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="약관 유형 탭">
          {TERMS_CONTENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                setActiveTab(type);
                setEditingId(null);
                setPreviewId(null);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === type
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {TERMS_CONTENT_TYPE_LABELS[type]}
            </button>
          ))}
        </nav>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 편집 폼 또는 목록 */}
        <div className="flex flex-col gap-4">
          {editingId ? (
            <TermsContentForm
              contentType={activeTab}
              contentId={editingId}
              onCancel={() => setEditingId(null)}
              onSuccess={() => {
                setEditingId(null);
              }}
            />
          ) : (
            <TermsContentList
              contentType={activeTab}
              onEdit={(id) => setEditingId(id)}
              onPreview={(id) => setPreviewId(id)}
              onCreateNew={() => setEditingId("new")}
            />
          )}
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="flex flex-col gap-4">
          {previewId && (
            <TermsPreview
              contentId={previewId}
              onClose={() => setPreviewId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

