"use client";

import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, TheorySection, ContentSection } from "@/lib/domains/guide/types";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
  type SectionDefinition,
} from "@/lib/domains/guide/section-config";
import { RichTextViewer } from "@/components/editor/RichTextEditor";

interface GuidePreviewProps {
  title: string;
  guideType: GuideType;
  bookTitle: string;
  bookAuthor: string;
  bookPublisher: string;
  /** 레거시 props (하위 호환) */
  motivation: string;
  theorySections: TheorySection[];
  reflection: string;
  impression: string;
  summary: string;
  followUp: string;
  bookDescription: string;
  contentFormat?: string;
  /** content_sections 기반 (있으면 우선 사용) */
  contentSections?: ContentSection[];
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

  // content_sections 우선, 없으면 레거시에서 변환
  const sections: ContentSection[] = props.contentSections?.length
    ? props.contentSections
    : resolveContentSections(props.guideType, {
        guide_id: "",
        motivation: props.motivation || null,
        theory_sections: props.theorySections ?? [],
        reflection: props.reflection || null,
        impression: props.impression || null,
        summary: props.summary || null,
        follow_up: props.followUp || null,
        book_description: props.bookDescription || null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "",
        updated_at: "",
      });

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

      {/* content_sections 기반 렌더링 */}
      {sectionConfig
        .filter((def) => !def.adminOnly)
        .sort((a, b) => a.order - b.order)
        .map((def) => {
          // 복수 섹션 (탐구 이론/활동 내용 등)
          if (def.multiple) {
            const multiples = sections.filter((s) => s.key === def.key);
            if (multiples.length === 0) return null;
            return (
              <div key={def.key}>
                <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
                  {def.label}
                </h4>
                <div className="space-y-3">
                  {multiples.map((sec, i) => (
                    <div
                      key={i}
                      className="rounded-lg border-l-4 border-blue-300 dark:border-blue-600 bg-secondary-50 dark:bg-secondary-800/30 p-3"
                    >
                      {sec.label && sec.label !== def.label && (
                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          {sec.label}
                        </p>
                      )}
                      {renderContent(sec.content)}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // 세특 예시 스킵
          if (def.key === "setek_examples") return null;

          // 단일 섹션
          const section = sections.find((s) => s.key === def.key);
          if (!section?.content) return null;

          return (
            <PreviewBlock key={def.key} label={def.label}>
              {renderContent(section.content)}
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
