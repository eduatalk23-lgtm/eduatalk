"use client";

import { cn } from "@/lib/cn";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, TheorySection } from "@/lib/domains/guide/types";
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

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400">
            {GUIDE_TYPE_LABELS[props.guideType]}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">미리보기</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-heading)]">
          {props.title || "(제목 없음)"}
        </h2>
      </div>

      {/* 독서 정보 */}
      {props.bookTitle && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            {props.bookTitle}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {[props.bookAuthor, props.bookPublisher].filter(Boolean).join(" / ")}
          </p>
        </div>
      )}

      {/* 본문 */}
      <PreviewBlock label="탐구 동기">{renderContent(props.motivation)}</PreviewBlock>
      <PreviewBlock label="도서 소개">{renderContent(props.bookDescription)}</PreviewBlock>

      {props.theorySections.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
            탐구 이론
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
      )}

      <PreviewBlock label="탐구 고찰">{renderContent(props.reflection)}</PreviewBlock>
      <PreviewBlock label="느낀점">{renderContent(props.impression)}</PreviewBlock>
      <PreviewBlock label="탐구 요약">{renderContent(props.summary)}</PreviewBlock>
      <PreviewBlock label="후속 탐구">{renderContent(props.followUp)}</PreviewBlock>
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
