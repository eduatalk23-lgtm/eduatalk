"use client";

import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, TheorySection } from "@/lib/domains/guide/types";
import { GUIDE_SECTION_CONFIG } from "@/lib/domains/guide/section-config";
import { RichTextViewer } from "@/components/editor/RichTextEditor";

interface GuidePreviewProps {
  title: string;
  guideType: GuideType;
  bookTitle: string;
  bookAuthor: string;
  bookPublisher: string;
  motivation: string;
  theorySections: TheorySection[];
  reflection: string;
  impression: string;
  summary: string;
  followUp: string;
  bookDescription: string;
  contentFormat?: string;
  // 교육과정 체계
  curriculumYear?: string;
  subjectArea?: string;
  subjectSelect?: string;
  unitMajor?: string;
  unitMinor?: string;
}

export function GuidePreview(props: GuidePreviewProps) {
  const isHtml = (text: string) =>
    props.contentFormat === "html" || text.startsWith("<");

  const renderContent = (text: string) => {
    if (!text) return null;
    if (isHtml(text)) {
      return <RichTextViewer content={text} />;
    }
    return (
      <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed">
        {text}
      </p>
    );
  };

  // 레거시 필드 매핑
  const fieldMap: Record<string, string> = {
    motivation: props.motivation,
    book_description: props.bookDescription,
    reflection: props.reflection,
    impression: props.impression,
    summary: props.summary,
    follow_up: props.followUp,
    objective: props.motivation,
    background: props.bookDescription,
    overview: props.motivation,
    learning: props.summary,
    deliverables: props.followUp,
  };

  const sectionConfig =
    GUIDE_SECTION_CONFIG[props.guideType] ??
    GUIDE_SECTION_CONFIG["topic_exploration"];

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400">
            {GUIDE_TYPE_LABELS[props.guideType]}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            미리보기
          </span>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-heading)]">
          {props.title || "(제목 없음)"}
        </h2>
      </div>

      {/* 교육과정 계층 경로 */}
      {(props.curriculumYear || props.subjectArea || props.subjectSelect || props.unitMajor) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            props.curriculumYear && `${props.curriculumYear} 개정`,
            props.subjectArea,
            props.subjectSelect,
            props.unitMajor,
            props.unitMinor,
          ]
            .filter(Boolean)
            .map((item, i, arr) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded font-medium bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">
                  {item}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-[var(--text-secondary)]">›</span>
                )}
              </span>
            ))}
        </div>
      )}

      {/* 독서 정보 */}
      {props.bookTitle && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            {props.bookTitle}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {[props.bookAuthor, props.bookPublisher]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
      )}

      {/* Config 기반 섹션 렌더링 */}
      {sectionConfig
        .filter((def) => !def.adminOnly)
        .sort((a, b) => a.order - b.order)
        .map((def) => {
          // 복수 섹션 (탐구 이론 등)
          if (def.multiple) {
            if (props.theorySections.length === 0) return null;
            return (
              <div key={def.key}>
                <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
                  {def.label}
                </h4>
                <div className="space-y-3">
                  {props.theorySections.map((sec, i) => (
                    <div
                      key={i}
                      className="rounded-lg border-l-4 border-blue-300 dark:border-blue-600 bg-secondary-50 dark:bg-secondary-800/30 p-3"
                    >
                      {sec.title && (
                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          {sec.title}
                        </p>
                      )}
                      {isHtml(sec.content) ? (
                        <RichTextViewer content={sec.content} />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
                          {sec.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // 세특 예시 스킵 (adminOnly)
          if (def.key === "setek_examples") return null;

          // 일반 섹션
          const text = fieldMap[def.key];
          if (!text) return null;

          return (
            <PreviewBlock key={def.key} label={def.label}>
              {renderContent(text)}
            </PreviewBlock>
          );
        })}
    </div>
  );
}

function PreviewBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-1.5">
        {label}
      </h4>
      {children}
    </div>
  );
}
