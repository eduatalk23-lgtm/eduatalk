"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/Dialog";
import {
  studentGuideDetailQueryOptions,
} from "@/lib/query-options/explorationGuide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType } from "@/lib/domains/guide/types";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "@/lib/domains/guide/section-config";
import { IntegratedGuideView } from "@/components/guide/IntegratedGuideView";

interface StudentGuideDetailProps {
  guideId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentGuideDetail({
  guideId,
  open,
  onOpenChange,
}: StudentGuideDetailProps) {
  const { data: res, isLoading } = useQuery({
    ...studentGuideDetailQueryOptions(guideId ?? ""),
    enabled: !!guideId && open,
  });

  const guide = res?.success ? res.data : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={guide?.title ?? "가이드 상세"}
      size="lg"
      showCloseButton
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--text-secondary)]">
          불러오는 중...
        </div>
      )}

      {guide &&
        (() => {
          const guideType = guide.guide_type as GuideType;
          const sectionConfig =
            GUIDE_SECTION_CONFIG[guideType] ??
            GUIDE_SECTION_CONFIG["topic_exploration"];

          const resolvedSections = guide.content
            ? resolveContentSections(guideType, guide.content)
            : [];

          return (
            <div className="flex flex-col gap-4">
              {/* 메타 정보 */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-secondary-100 dark:bg-secondary-800 px-2 py-0.5 font-medium text-secondary-600 dark:text-secondary-400">
                  {GUIDE_TYPE_LABELS[guide.guide_type]}
                </span>
                {[
                  guide.curriculum_year && `${guide.curriculum_year} 개정`,
                  guide.subject_area,
                  guide.subject_select,
                  guide.unit_major,
                  guide.unit_minor,
                ]
                  .filter(Boolean)
                  .map((item, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="rounded bg-secondary-100 dark:bg-secondary-800 px-1.5 py-0.5 text-secondary-600 dark:text-secondary-400">
                        {item}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-secondary-300">›</span>
                      )}
                    </span>
                  ))}
                {guide.career_fields.map((cf) => (
                  <span
                    key={cf.id}
                    className="rounded bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-blue-600 dark:text-blue-400"
                  >
                    {cf.name_kor}
                  </span>
                ))}
                {guide.subjects.map((s) => (
                  <span
                    key={s.id}
                    className="rounded bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400"
                  >
                    {s.name}
                  </span>
                ))}
              </div>

              {/* 독서 정보 */}
              {guide.book_title && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-3">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                    {guide.book_title}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {[guide.book_author, guide.book_publisher, guide.book_year]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
              )}

              {/* 본문 섹션 */}
              {guide.content && (
                <div className="flex flex-col gap-3">
                  {sectionConfig
                    .filter((def) => !def.adminOnly)
                    .sort((a, b) => a.order - b.order)
                    .map((def) => {
                      // text_list (학습목표 등)
                      if (
                        def.editorType === "text_list" &&
                        def.key !== "setek_examples"
                      ) {
                        const section = resolvedSections.find(
                          (s) => s.key === def.key,
                        );
                        if (!section?.items?.length) return null;
                        return (
                          <div key={def.key}>
                            <h4 className="mb-1.5 text-xs font-semibold text-secondary-500">
                              {def.label}
                            </h4>
                            <ul className="space-y-1">
                              {section.items.map((item, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-[var(--text-primary)]"
                                >
                                  <span className="text-primary-500 mt-0.5 flex-shrink-0">
                                    -
                                  </span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }

                      // 복수 섹션 (탐구 이론 등) → 통합 뷰
                      if (def.multiple) {
                        const multiples = resolvedSections.filter(
                          (s) => s.key === def.key,
                        );
                        if (multiples.length === 0) return null;

                        return (
                          <div key={def.key}>
                            <h4 className="mb-2 text-xs font-semibold text-secondary-500">
                              {def.label}
                            </h4>
                            <IntegratedGuideView
                              sections={multiples}
                              defLabel={def.label}
                            />
                          </div>
                        );
                      }

                      // setek_examples 스킵
                      if (def.key === "setek_examples") return null;

                      // 일반 섹션
                      const section = resolvedSections.find(
                        (s) => s.key === def.key,
                      );
                      if (!section?.content) return null;
                      return (
                        <ContentBlock
                          key={def.key}
                          label={def.label}
                          text={section.content}
                        />
                      );
                    })}

                  {guide.content.related_papers.length > 0 && (
                    <div>
                      <h4 className="mb-1 text-xs font-semibold text-secondary-500">
                        관련 논문
                      </h4>
                      <ul className="flex flex-col gap-1 text-sm text-[var(--text-primary)]">
                        {guide.content.related_papers.map((p, i) => (
                          <li key={i}>
                            {p.url ? (
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                              >
                                {p.title}
                              </a>
                            ) : (
                              p.title
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {guide.content.related_books.length > 0 && (
                    <div>
                      <h4 className="mb-1 text-xs font-semibold text-secondary-500">
                        관련 도서
                      </h4>
                      <p className="text-sm text-[var(--text-primary)]">
                        {guide.content.related_books.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
    </Dialog>
  );
}

function ContentBlock({
  label,
  text,
}: {
  label: string;
  text?: string | null;
}) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold text-secondary-500">
        {label}
      </h4>
      <div
        className={cn("whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed")}
        dangerouslySetInnerHTML={
          text.startsWith("<") ? { __html: text } : undefined
        }
      >
        {text.startsWith("<") ? undefined : text}
      </div>
    </div>
  );
}
