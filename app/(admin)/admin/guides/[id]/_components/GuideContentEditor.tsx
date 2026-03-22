"use client";

import { useCallback } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { GuideType, TheorySection } from "@/lib/domains/guide/types";
import {
  GUIDE_SECTION_CONFIG,
  type SectionDefinition,
} from "@/lib/domains/guide/section-config";

interface GuideContentEditorProps {
  guideType: GuideType;
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
  const sectionConfig = GUIDE_SECTION_CONFIG[props.guideType] ?? GUIDE_SECTION_CONFIG["topic_exploration"];

  // 레거시 필드 매핑: config key → props getter/setter
  const fieldMap: Record<string, { value: string; onChange: (v: string) => void; placeholder?: string }> = {
    motivation: { value: props.motivation, onChange: props.onMotivationChange },
    book_description: { value: props.bookDescription, onChange: props.onBookDescriptionChange },
    reflection: { value: props.reflection, onChange: props.onReflectionChange },
    impression: { value: props.impression, onChange: props.onImpressionChange },
    summary: { value: props.summary, onChange: props.onSummaryChange },
    follow_up: { value: props.followUp, onChange: props.onFollowUpChange },
    // 유형별 전용 키 → 레거시 필드 매핑 (하위 호환)
    // Phase D 완전 리팩토링 시 content_sections 기반으로 전환 예정
    objective: { value: props.motivation, onChange: props.onMotivationChange },
    background: { value: props.bookDescription, onChange: props.onBookDescriptionChange },
    hypothesis: { value: "", onChange: () => {} },  // 신규 키 (차후 content_sections로 전환)
    materials: { value: "", onChange: () => {} },
    method: { value: "", onChange: () => {} },
    results: { value: "", onChange: () => {} },
    analysis: { value: "", onChange: () => {} },
    self_assessment: { value: "", onChange: () => {} },
    curriculum_link: { value: "", onChange: () => {} },
    overview: { value: props.motivation, onChange: props.onMotivationChange },
    learning: { value: props.summary, onChange: props.onSummaryChange },
    deliverables: { value: props.followUp, onChange: props.onFollowUpChange },
  };

  // 탐구 이론 / 복수 섹션 핸들러
  const addTheorySection = useCallback(
    (label: string) => {
      props.onTheorySectionsChange([
        ...props.theorySections,
        {
          order: props.theorySections.length + 1,
          title: `${label} ${props.theorySections.length + 1}`,
          content: "",
          content_format: "html",
        },
      ]);
    },
    [props],
  );

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

  // 세특 예시 핸들러
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

  // Config 기반 섹션 렌더링
  function renderSection(def: SectionDefinition) {
    // 복수 섹션 (탐구 이론, 활동 내용 등)
    if (def.multiple) {
      return renderMultipleSection(def);
    }

    // 세특 예시 (text_list)
    if (def.key === "setek_examples") {
      return renderSetekExamples(def);
    }

    // 일반 rich_text 섹션
    const field = fieldMap[def.key];
    if (!field) return null;

    return (
      <ContentSection key={def.key} label={def.label}>
        <RichTextEditor
          content={props.toHtml(field.value, fmt)}
          onChange={field.onChange}
          placeholder={def.placeholder ?? `${def.label}을(를) 입력하세요...`}
          onImageInsert={props.onImageInsert}
          onAiImageInsert={props.onAiImageInsert}
        />
      </ContentSection>
    );
  }

  function renderMultipleSection(def: SectionDefinition) {
    return (
      <div
        key={def.key}
        className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={sectionLabelClass}>{def.label}</h3>
          <button
            type="button"
            onClick={() => addTheorySection(def.label)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            섹션 추가
          </button>
        </div>

        {props.theorySections.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            섹션이 없습니다. &quot;섹션 추가&quot;를 클릭하세요.
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
                  content={props.toHtml(
                    section.content,
                    section.content_format ?? fmt,
                  )}
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
    );
  }

  function renderSetekExamples(def: SectionDefinition) {
    return (
      <div
        key={def.key}
        className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={sectionLabelClass}>
            {def.label} (컨설턴트 전용)
          </h3>
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
    );
  }

  return (
    <div className="space-y-6">
      {sectionConfig
        .sort((a, b) => a.order - b.order)
        .map((def) => renderSection(def))}
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
