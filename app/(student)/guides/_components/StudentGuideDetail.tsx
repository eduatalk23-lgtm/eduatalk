"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/Dialog";
import {
  studentGuideDetailQueryOptions,
  studentGuideKeys,
} from "@/lib/query-options/explorationGuide";
import { updateMyAssignmentStatusAction } from "@/lib/domains/guide/actions/student-guide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType, TheorySection } from "@/lib/domains/guide/types";
import { GUIDE_SECTION_CONFIG, resolveContentSections } from "@/lib/domains/guide/section-config";

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
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          불러오는 중...
        </div>
      )}

      {guide && (() => {
        const guideType = guide.guide_type as GuideType;
        const sectionConfig = GUIDE_SECTION_CONFIG[guideType] ?? GUIDE_SECTION_CONFIG["topic_exploration"];

        // content_sections가 있으면 우선 사용, 없으면 레거시 필드에서 변환
        const resolvedSections = guide.content
          ? resolveContentSections(guideType, guide.content)
          : [];

        // 레거시 필드 매핑 (resolvedSections가 비어있을 경우 fallback)
        const contentFieldMap: Record<string, string | null | undefined> = guide.content ? {
          motivation: guide.content.motivation,
          book_description: guide.content.book_description,
          reflection: guide.content.reflection,
          impression: guide.content.impression,
          summary: guide.content.summary,
          follow_up: guide.content.follow_up,
          objective: guide.content.motivation,
          background: guide.content.book_description,
          overview: guide.content.motivation,
          learning: guide.content.summary,
          deliverables: guide.content.follow_up,
        } : {};

        // resolvedSections에서 key로 content 조회 (있으면 우선)
        const getContent = (key: string): string | null | undefined => {
          const section = resolvedSections.find((s) => s.key === key);
          if (section?.content) return section.content;
          return contentFieldMap[key];
        };

        return (
        <div className="flex flex-col gap-4">
          {/* 메타 정보 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              {GUIDE_TYPE_LABELS[guide.guide_type]}
            </span>
            {/* 교육과정 계층 경로 */}
            {[
              guide.curriculum_year && `${guide.curriculum_year} 개정`,
              guide.subject_area,
              guide.subject_select,
              guide.unit_major,
              guide.unit_minor,
            ].filter(Boolean).length > 0 && (
              <>
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
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {item}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-gray-300">›</span>
                      )}
                    </span>
                  ))}
              </>
            )}
            {guide.career_fields.map((cf) => (
              <span
                key={cf.id}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600"
              >
                {cf.name_kor}
              </span>
            ))}
            {guide.subjects.map((s) => (
              <span
                key={s.id}
                className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-600"
              >
                {s.name}
              </span>
            ))}
          </div>

          {/* 독서 정보 */}
          {guide.book_title && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                {guide.book_title}
              </p>
              <p className="text-xs text-amber-700">
                {[guide.book_author, guide.book_publisher, guide.book_year]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
          )}

          {/* 본문 섹션들 (config 기반) */}
          {guide.content && (
            <div className="flex flex-col gap-3">
              {sectionConfig
                .filter((def) => !def.adminOnly)
                .sort((a, b) => a.order - b.order)
                .map((def) => {
                  // 복수 섹션
                  if (def.multiple) {
                    if (guide.content!.theory_sections.length === 0) return null;
                    return (
                      <div key={def.key}>
                        <h4 className="mb-1.5 text-xs font-semibold text-gray-500">
                          {def.label}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {guide.content!.theory_sections.map(
                            (sec: TheorySection) => (
                              <div
                                key={sec.order}
                                className="rounded border-l-2 border-blue-300 bg-gray-50 p-2.5 text-sm text-gray-700"
                              >
                                {sec.title && (
                                  <p className="text-xs font-semibold text-gray-500 mb-1">
                                    {sec.title}
                                  </p>
                                )}
                                {sec.content}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 일반 섹션
                  const text = getContent(def.key);
                  if (!text) return null;
                  return <ContentBlock key={def.key} label={def.label} text={text} />;
                })}

              {guide.content.related_papers.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-gray-500">
                    관련 논문
                  </h4>
                  <ul className="flex flex-col gap-1 text-sm text-gray-600">
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
                  <h4 className="mb-1 text-xs font-semibold text-gray-500">
                    관련 도서
                  </h4>
                  <p className="text-sm text-gray-600">
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
      <h4 className="mb-1 text-xs font-semibold text-gray-500">{label}</h4>
      <p className={cn("whitespace-pre-wrap text-sm text-gray-700")}>{text}</p>
    </div>
  );
}
