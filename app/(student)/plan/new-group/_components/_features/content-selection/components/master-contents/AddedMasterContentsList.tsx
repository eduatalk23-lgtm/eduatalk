"use client";

import { ContentCard } from "../ContentCard";
import type { AddedMasterContentsListProps } from "./types";
import { hasMasterContentId } from "../../../../utils/typeGuards";

/**
 * 추가된 마스터 콘텐츠 목록
 */
export function AddedMasterContentsList({
  contents,
  onRemove,
  onEditRange,
  editable,
}: AddedMasterContentsListProps) {
  if (contents.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          추가된 마스터 콘텐츠
        </h3>
        <span className="text-sm text-gray-800">{contents.length}개</span>
      </div>
      <div className="space-y-3">
        {contents.map((content) => {
          const masterId = hasMasterContentId(content)
            ? content.master_content_id
            : content.content_id;

          return (
            <ContentCard
              key={masterId}
              content={{
                id: content.content_id,
                title: content.title || "제목 없음",
                subject: content.subject_category || undefined,
              }}
              selected={true}
              readOnly={!editable}
              range={{
                start: String(content.start_range),
                end: String(content.end_range),
                start_detail_id: content.start_detail_id,
                end_detail_id: content.end_detail_id,
              }}
              onRemove={() => onRemove(content.content_id)}
              onEditRange={() => onEditRange(content)}
            />
          );
        })}
      </div>
    </div>
  );
}
