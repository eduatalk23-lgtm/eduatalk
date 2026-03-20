"use client";

import { useCallback } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { TheorySection } from "@/lib/domains/guide/types";

interface GuideContentEditorProps {
  motivation: string;
  onMotivationChange: (v: string) => void;
  theorySections: TheorySection[];
  onTheorySectionsChange: (v: TheorySection[]) => void;
  reflection: string;
  onReflectionChange: (v: string) => void;
  impression: string;
  onImpressionChange: (v: string) => void;
  summary: string;
  onSummaryChange: (v: string) => void;
  followUp: string;
  onFollowUpChange: (v: string) => void;
  bookDescription: string;
  onBookDescriptionChange: (v: string) => void;
  setekExamples: string[];
  onSetekExamplesChange: (v: string[]) => void;
  contentFormat?: string;
  toHtml: (text: string, format?: string) => string;
  onImageInsert: () => Promise<string | null>;
  onAiImageInsert?: () => Promise<string | null>;
}

const sectionLabelClass =
  "text-sm font-semibold text-[var(--text-heading)] mb-2";

export function GuideContentEditor(props: GuideContentEditorProps) {
  const fmt = props.contentFormat;

  const addTheorySection = useCallback(() => {
    props.onTheorySectionsChange([
      ...props.theorySections,
      {
        order: props.theorySections.length + 1,
        title: `이론 ${props.theorySections.length + 1}`,
        content: "",
        content_format: "html",
      },
    ]);
  }, [props]);

  const updateTheorySection = useCallback(
    (index: number, updates: Partial<TheorySection>) => {
      props.onTheorySectionsChange(
        props.theorySections.map((s, i) =>
          i === index ? { ...s, ...updates } : s,
        ),
      );
    },
    [props],
  );

  const removeTheorySection = useCallback(
    (index: number) => {
      props.onTheorySectionsChange(
        props.theorySections
          .filter((_, i) => i !== index)
          .map((s, i) => ({ ...s, order: i + 1 })),
      );
    },
    [props],
  );

  const addSetekExample = useCallback(() => {
    props.onSetekExamplesChange([...props.setekExamples, ""]);
  }, [props]);

  const updateSetekExample = useCallback(
    (index: number, value: string) => {
      props.onSetekExamplesChange(
        props.setekExamples.map((ex, i) => (i === index ? value : ex)),
      );
    },
    [props],
  );

  const removeSetekExample = useCallback(
    (index: number) => {
      props.onSetekExamplesChange(
        props.setekExamples.filter((_, i) => i !== index),
      );
    },
    [props],
  );

  return (
    <div className="space-y-6">
      {/* 탐구 동기 */}
      <ContentSection label="탐구 동기">
        <RichTextEditor
          content={props.toHtml(props.motivation, fmt)}
          onChange={props.onMotivationChange}
          placeholder="탐구 동기를 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 도서 소개 */}
      <ContentSection label="도서 소개">
        <RichTextEditor
          content={props.toHtml(props.bookDescription, fmt)}
          onChange={props.onBookDescriptionChange}
          placeholder="도서 소개를 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 탐구 이론 섹션들 */}
      <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className={sectionLabelClass}>탐구 이론</h3>
          <button
            type="button"
            onClick={addTheorySection}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            섹션 추가
          </button>
        </div>

        {props.theorySections.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            이론 섹션이 없습니다. &quot;섹션 추가&quot;를 클릭하세요.
          </p>
        ) : (
          <div className="space-y-4">
            {props.theorySections.map((section, index) => (
              <div
                key={index}
                className="rounded-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary-50 dark:bg-secondary-800/50 border-b border-secondary-200 dark:border-secondary-700">
                  <GripVertical className="w-4 h-4 text-secondary-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) =>
                      updateTheorySection(index, { title: e.target.value })
                    }
                    placeholder="섹션 제목"
                    className="flex-1 bg-transparent text-sm font-medium text-[var(--text-heading)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeTheorySection(index)}
                    className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="섹션 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <RichTextEditor
                  content={props.toHtml(section.content, section.content_format ?? fmt)}
                  onChange={(html) =>
                    updateTheorySection(index, {
                      content: html,
                      content_format: "html",
                    })
                  }
                  onImageInsert={props.onImageInsert}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 탐구 고찰 */}
      <ContentSection label="탐구 고찰">
        <RichTextEditor
          content={props.toHtml(props.reflection, fmt)}
          onChange={props.onReflectionChange}
          placeholder="탐구 고찰을 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 느낀점 */}
      <ContentSection label="느낀점">
        <RichTextEditor
          content={props.toHtml(props.impression, fmt)}
          onChange={props.onImpressionChange}
          placeholder="느낀점을 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 탐구 요약 */}
      <ContentSection label="탐구 요약">
        <RichTextEditor
          content={props.toHtml(props.summary, fmt)}
          onChange={props.onSummaryChange}
          placeholder="탐구 요약을 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 후속 탐구 */}
      <ContentSection label="후속 탐구">
        <RichTextEditor
          content={props.toHtml(props.followUp, fmt)}
          onChange={props.onFollowUpChange}
          placeholder="후속 탐구를 입력하세요..."
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>

      {/* 교과 세특 예시 (컨설턴트 전용) */}
      <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className={sectionLabelClass}>교과 세특 예시 (컨설턴트 전용)</h3>
          <button
            type="button"
            onClick={addSetekExample}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            예시 추가
          </button>
        </div>

        {props.setekExamples.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            세특 예시가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {props.setekExamples.map((example, index) => (
              <div key={index} className="flex gap-2">
                <textarea
                  value={example}
                  onChange={(e) => updateSetekExample(index, e.target.value)}
                  rows={3}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border text-sm resize-none",
                    "border-secondary-200 dark:border-secondary-700",
                    "bg-white dark:bg-secondary-900",
                    "text-[var(--text-primary)]",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
                  )}
                  placeholder={`세특 예시 ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeSetekExample(index)}
                  className="self-start p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5">
      <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
        {label}
      </h3>
      {children}
    </div>
  );
}
