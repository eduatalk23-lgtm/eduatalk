"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/Dialog";
import { guideDetailQueryOptions } from "@/lib/query-options/explorationGuide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide";
import type { TheorySection } from "@/lib/domains/guide";

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
            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              {GUIDE_TYPE_LABELS[guide.guide_type]}
            </span>
            {guide.curriculum_year && (
              <span className="text-gray-400">{guide.curriculum_year} 교육과정</span>
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
              <p className="text-sm font-medium text-amber-900">{guide.book_title}</p>
              <p className="text-xs text-amber-700">
                {[guide.book_author, guide.book_publisher, guide.book_year]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
          )}

          {/* 본문 섹션들 */}
          {guide.content && (
            <div className="flex flex-col gap-3">
              <ContentBlock label="탐구 동기" text={guide.content.motivation} />
              <ContentBlock label="도서 소개" text={guide.content.book_description} />

              {guide.content.theory_sections.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold text-gray-500">탐구 이론</h4>
                  <div className="flex flex-col gap-2">
                    {guide.content.theory_sections.map((sec: TheorySection) => (
                      <div
                        key={sec.order}
                        className="rounded border-l-2 border-blue-300 bg-gray-50 p-2.5 text-sm text-gray-700"
                      >
                        {sec.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ContentBlock label="탐구 고찰" text={guide.content.reflection} />
              <ContentBlock label="느낀점" text={guide.content.impression} />
              <ContentBlock label="탐구 요약" text={guide.content.summary} />
              <ContentBlock label="후속 탐구" text={guide.content.follow_up} />

              {guide.content.related_papers.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-gray-500">관련 논문</h4>
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
                  <h4 className="mb-1 text-xs font-semibold text-gray-500">관련 도서</h4>
                  <p className="text-sm text-gray-600">
                    {guide.content.related_books.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 배정 영역 */}
          {onAssign && !isAssigned && (
            <div className="flex items-end gap-2 border-t pt-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  배정 메모 (선택)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="학생에게 전달할 메모..."
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
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

function ContentBlock({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold text-gray-500">{label}</h4>
      <p className={cn("whitespace-pre-wrap text-sm text-gray-700")}>{text}</p>
    </div>
  );
}
