"use client";

import DOMPurify from "dompurify";
import type { GuideDetail, ContentSection } from "@/lib/domains/guide/types";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "@/lib/domains/guide/section-config";
import { IntegratedGuideView } from "@/components/guide/IntegratedGuideView";

interface SharedGuideViewProps {
  guide: GuideDetail;
  visibleSections: string[];
}

export function SharedGuideView({ guide, visibleSections }: SharedGuideViewProps) {
  const sections = guide.content
    ? resolveContentSections(guide.guide_type, guide.content)
    : [];
  const config = GUIDE_SECTION_CONFIG[guide.guide_type] ?? [];

  const isHtml = (text: string) =>
    guide.content_format === "html" || text.startsWith("<");

  const renderContent = (sec: ContentSection) => {
    if (sec.items && sec.items.length > 0) {
      return (
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          {sec.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    if (isHtml(sec.content)) {
      return (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sec.content) }}
        />
      );
    }

    return (
      <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
        {sec.content}
      </p>
    );
  };

  return (
    <article className="space-y-8 print:space-y-6">
      {/* 헤더 */}
      <header className="text-center border-b border-gray-200 pb-6">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mb-3">
          {GUIDE_TYPE_LABELS[guide.guide_type]}
        </span>
        <h1 className="text-2xl font-bold text-gray-900">
          {guide.title}
        </h1>
        {(guide.curriculum_year || guide.subject_area || guide.subject_select) && (
          <p className="text-sm text-gray-500 mt-2">
            {[
              guide.curriculum_year && `${guide.curriculum_year} 개정`,
              guide.subject_area,
              guide.subject_select,
              guide.unit_major,
              guide.unit_minor,
            ]
              .filter(Boolean)
              .join(" › ")}
          </p>
        )}
      </header>

      {/* 도서 정보 */}
      {visibleSections.includes("book_description") && guide.book_title && (
        <div className="rounded-lg bg-amber-50 p-4 print:border print:border-amber-200">
          <p className="text-sm font-semibold text-amber-900">
            {guide.book_title}
          </p>
          <p className="text-xs text-amber-700">
            {[guide.book_author, guide.book_publisher]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
      )}

      {/* 섹션 렌더링 */}
      {config
        .filter((def) => !def.adminOnly && visibleSections.includes(def.key))
        .sort((a, b) => a.order - b.order)
        .map((def) => {
          const matching = sections.filter((s) => s.key === def.key);
          if (matching.length === 0) return null;

          // 복수 섹션 (탐구 이론 등) → 통합 뷰
          if (def.multiple) {
            return (
              <section key={def.key}>
                <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-3">
                  {def.label}
                </h2>
                <IntegratedGuideView
                  sections={matching}
                  defLabel={def.label}
                />
              </section>
            );
          }

          return (
            <section key={def.key}>
              <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-3">
                {def.label}
              </h2>
              <div className="space-y-3">
                {matching.map((sec, i) => (
                  <div key={i}>
                    {sec.label && sec.label !== def.label && (
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        {sec.label}
                      </p>
                    )}
                    {renderContent(sec)}
                    {sec.images?.map((img, j) => (
                      <figure key={j} className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.caption ?? ""}
                          className="max-w-full rounded"
                        />
                        {img.caption && (
                          <figcaption className="text-xs text-gray-400 mt-1">
                            {img.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

      {/* 관련 논문 */}
      {visibleSections.includes("related_papers") &&
        guide.content?.related_papers &&
        guide.content.related_papers.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-3">
              관련 논문
            </h2>
            <ul className="space-y-2">
              {guide.content.related_papers.map((paper, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-gray-800">{paper.title}</span>
                  {paper.url && (
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 text-xs hover:underline"
                    >
                      링크
                    </a>
                  )}
                  {paper.summary && (
                    <p className="text-xs text-gray-500 mt-0.5">{paper.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* 관련 도서 */}
      {visibleSections.includes("related_books") &&
        guide.content?.related_books &&
        guide.content.related_books.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-3">
              관련 도서
            </h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {guide.content.related_books.map((book, i) => (
                <li key={i}>{book}</li>
              ))}
            </ul>
          </section>
        )}
    </article>
  );
}
