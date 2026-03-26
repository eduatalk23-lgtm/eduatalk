"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/Dialog";
import { guideDetailQueryOptions } from "@/lib/query-options/explorationGuide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide";
import type { GuideType } from "@/lib/domains/guide";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "@/lib/domains/guide/section-config";
import { RichTextViewer } from "@/components/editor/RichTextEditor";
import { IntegratedGuideView } from "@/components/guide/IntegratedGuideView";

interface GuideDetailDialogProps {
  guideId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (guideId: string, notes: string) => void;
  isAssigned?: boolean;
}

export function GuideDetailDialog({
  guideId,
  open,
  onOpenChange,
  onAssign,
  isAssigned,
}: GuideDetailDialogProps) {
  const [notes, setNotes] = useState("");
  const { data: res, isLoading } = useQuery({
    ...guideDetailQueryOptions(guideId ?? ""),
    enabled: !!guideId && open,
  });

  const guide = res?.success ? res.data : null;

  // content_sections 기반 렌더링
  const sections =
    guide?.content
      ? resolveContentSections(
          guide.guide_type as GuideType,
          guide.content,
        )
      : [];

  const sectionConfig = guide
    ? (GUIDE_SECTION_CONFIG[guide.guide_type as GuideType] ??
       GUIDE_SECTION_CONFIG["topic_exploration"])
    : [];

  const renderContent = (text: string) => {
    if (!text) return null;
    if (text.startsWith("<")) {
      return <RichTextViewer content={text} />;
    }
    return (
      <p className={cn("whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300")}>
        {text}
      </p>
    );
  };

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

      {guide && (
        <div className="flex flex-col gap-4">
          {/* 메타 정보 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 font-medium text-gray-600 dark:text-gray-400">
              {GUIDE_TYPE_LABELS[guide.guide_type]}
            </span>
            {guide.curriculum_year && (
              <span className="text-gray-400">{guide.curriculum_year} 교육과정</span>
            )}
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
              <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{guide.book_title}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {[guide.book_author, guide.book_publisher, guide.book_year]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
          )}

          {/* content_sections 기반 본문 */}
          {sections.length > 0 && (
            <div className="flex flex-col gap-3">
              {sectionConfig
                .filter((def) => !def.adminOnly)
                .sort((a, b) => a.order - b.order)
                .map((def) => {
                  // text_list (학습목표 등)
                  if (def.editorType === "text_list" && def.key !== "setek_examples") {
                    const section = sections.find((s) => s.key === def.key);
                    if (!section?.items?.length) return null;
                    return (
                      <div key={def.key}>
                        <h4 className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {def.label}
                        </h4>
                        <ul className="space-y-1">
                          {section.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span className="text-primary-500 mt-0.5 flex-shrink-0">-</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }

                  // 복수 섹션 → 통합 뷰
                  if (def.multiple) {
                    const multiples = sections.filter((s) => s.key === def.key);
                    if (multiples.length === 0) return null;
                    return (
                      <div key={def.key}>
                        <h4 className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {def.label}
                        </h4>
                        <IntegratedGuideView
                          sections={multiples}
                          defLabel={def.label}
                        />
                      </div>
                    );
                  }

                  if (def.key === "setek_examples") return null;

                  const section = sections.find((s) => s.key === def.key);
                  if (!section?.content) return null;

                  return (
                    <div key={def.key}>
                      <h4 className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {def.label}
                      </h4>
                      {renderContent(section.content)}
                    </div>
                  );
                })}
            </div>
          )}

          {/* 관련 논문 */}
          {guide.content && guide.content.related_papers.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">관련 논문</h4>
              <ul className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                {guide.content.related_papers.map((p, i) => (
                  <li key={i}>
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline"
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

          {/* 관련 도서 */}
          {guide.content && guide.content.related_books.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">관련 도서</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {guide.content.related_books.join(", ")}
              </p>
            </div>
          )}

          {/* 배정 영역 */}
          {onAssign && !isAssigned && (
            <div className="flex items-end gap-2 border-t pt-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  배정 메모 (선택)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="학생에게 전달할 메모..."
                  className="w-full rounded-md border px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md bg-primary-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
                onClick={() => {
                  onAssign(guide.id, notes);
                  setNotes("");
                }}
              >
                이 가이드 배정
              </button>
            </div>
          )}
          {isAssigned && (
            <p className="border-t pt-3 text-center text-sm text-gray-400">
              이미 배정된 가이드입니다.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
