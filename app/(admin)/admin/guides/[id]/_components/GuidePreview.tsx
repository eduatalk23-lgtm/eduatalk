"use client";

import { cn } from "@/lib/cn";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, TheorySection, ContentSection } from "@/lib/domains/guide/types";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "@/lib/domains/guide/section-config";
import { RichTextViewer } from "@/components/editor/RichTextEditor";
import { IntegratedGuideView } from "@/components/guide/IntegratedGuideView";

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
  contentSections?: ContentSection[];
  /** admin-only 섹션(consultant_guide 등) 표시 여부 */
  showAdminSections?: boolean;
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
      return <RichTextViewer content={text} className="prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5" />;
    }
    return (
      <div className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed space-y-2">
        {text}
      </div>
    );
  };

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
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
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

      {/* 섹션 빠른 이동 */}
      <nav className="flex flex-wrap gap-1.5">
        {sectionConfig
          .filter((def) => (props.showAdminSections || !def.adminOnly) && sections.some((s) => s.key === def.key))
          .sort((a, b) => a.order - b.order)
          .map((def) => (
            <button
              key={def.key}
              type="button"
              onClick={() => {
                document.getElementById(`preview-${def.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
            >
              {def.label}
              {def.key === "consultant_guide" && " 🔒"}
            </button>
          ))}
      </nav>

      {/* 섹션 렌더링 */}
      {sectionConfig
        .filter((def) => props.showAdminSections || !def.adminOnly)
        .sort((a, b) => a.order - b.order)
        .map((def) => {
          // text_list (학습목표, 세특 예시 등)
          if (def.editorType === "text_list") {
            const section = sections.find((s) => s.key === def.key);
            if (!section?.items?.length) return null;
            const isSetek = def.key === "setek_examples";
            return (
              <PreviewBlock key={def.key} label={def.label} sectionKey={def.key}>
                <ul className={isSetek ? "space-y-3" : "space-y-1"}>
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                      <span className="text-primary-500 mt-0.5 flex-shrink-0">{isSetek ? `${i + 1}.` : "-"}</span>
                      {item.startsWith("<") ? (
                        <RichTextViewer content={item} className="flex-1 prose-p:my-1" />
                      ) : (
                        <span className="whitespace-pre-wrap leading-relaxed">{item}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </PreviewBlock>
            );
          }

          // 복수 섹션 (탐구 이론 등) → 통합 뷰
          if (def.multiple) {
            const multiples = sections.filter((s) => s.key === def.key);
            if (multiples.length === 0) return null;
            return (
              <div key={def.key} id={`preview-${def.key}`} className="scroll-mt-16">
                <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
                  {def.label}
                </h4>
                <IntegratedGuideView
                  sections={multiples}
                  defLabel={def.label}
                />
              </div>
            );
          }

          // 단일 섹션
          const section = sections.find((s) => s.key === def.key);
          if (!section?.content) return null;

          return (
            <PreviewBlock key={def.key} label={def.label} consultantOnly={def.key === "consultant_guide"}>
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
  sectionKey,
  consultantOnly,
}: {
  label: string;
  children: React.ReactNode;
  sectionKey?: string;
  consultantOnly?: boolean;
}) {
  if (!children) return null;
  return (
    <div
      id={sectionKey ? `preview-${sectionKey}` : undefined}
      className={cn(
        "scroll-mt-16",
        consultantOnly && "rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-4",
      )}
    >
      <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-2 flex items-center gap-1.5">
        {label}
        {consultantOnly && (
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
            컨설턴트 전용
          </span>
        )}
      </h4>
      {children}
    </div>
  );
}
