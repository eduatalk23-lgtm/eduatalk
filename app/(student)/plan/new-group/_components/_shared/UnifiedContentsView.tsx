"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { SelectedContent, RecommendedContent, ContentMetadata } from "@/lib/types/content-selection";
import { ContentCard } from "./ContentCard";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";

type UnifiedContentsViewProps = {
  studentContents: SelectedContent[];
  recommendedContents: SelectedContent[];
  contents: {
    books: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
    }>;
    lectures: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
    }>;
    custom: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
    }>;
  };
  allRecommendedContents?: RecommendedContent[];
  isCampMode?: boolean;
};

/**
 * UnifiedContentsView - 읽기 전용 모드용 통합 콘텐츠 뷰
 * 
 * 학생 콘텐츠와 추천 콘텐츠를 섹션으로 구분하여 표시
 */
export function UnifiedContentsView({
  studentContents,
  recommendedContents,
  contents,
  allRecommendedContents = [],
  isCampMode = false,
}: UnifiedContentsViewProps) {
  // 메타데이터 캐시
  const [metadataCache, setMetadataCache] = useState<Map<string, ContentMetadata>>(
    new Map()
  );

  // 모든 콘텐츠 ID 수집
  const allContentIds = useMemo(() => {
    const ids = new Set<string>();
    studentContents.forEach((c) => ids.add(c.content_id));
    recommendedContents.forEach((c) => ids.add(c.content_id));
    return Array.from(ids);
  }, [studentContents, recommendedContents]);

  // 메타데이터 로드
  useEffect(() => {
    const loadMetadata = async () => {
      if (allContentIds.length === 0) return;

      try {
        const metadataMap = new Map<string, ContentMetadata>();
        
        // 모든 콘텐츠에서 contentId와 contentType 매핑 생성
        const contentTypeMap = new Map<string, "book" | "lecture">();
        [...studentContents, ...recommendedContents].forEach((content) => {
          if (content.content_type === "book" || content.content_type === "lecture") {
            contentTypeMap.set(content.content_id, content.content_type);
          }
        });
        
        // 각 콘텐츠의 메타데이터를 개별적으로 가져오기
        await Promise.all(
          allContentIds.map(async (contentId) => {
            const contentType = contentTypeMap.get(contentId);
            // custom 타입은 메타데이터가 없으므로 스킵
            if (!contentType) return;
            
            try {
              const result = await fetchContentMetadataAction(contentId, contentType);
              if (result.success && result.data) {
                metadataMap.set(contentId, result.data);
              }
            } catch (error) {
              console.error(`[UnifiedContentsView] 메타데이터 로드 실패 (${contentId}):`, error);
            }
          })
        );

        setMetadataCache(metadataMap);
      } catch (error) {
        console.error("[UnifiedContentsView] 메타데이터 로드 실패:", error);
      }
    };

    loadMetadata();
  }, [allContentIds, studentContents, recommendedContents]);

  // 학생 콘텐츠 카드 렌더링
  const renderStudentContentCard = useCallback(
    (content: SelectedContent) => {
      const metadata = metadataCache.get(content.content_id);

      return (
        <ContentCard
          key={content.content_id}
          content={{
            id: content.content_id,
            title: content.title || "제목 없음",
            subject: metadata?.subject || content.subject_category || undefined,
            semester: metadata?.semester,
            difficulty: metadata?.difficulty_level,
            publisher: metadata?.publisher,
            platform: metadata?.platform,
          }}
          selected={true}
          readOnly={true}
          range={{
            start: String(content.start_range),
            end: String(content.end_range),
            start_detail_id: content.start_detail_id,
            end_detail_id: content.end_detail_id,
          }}
        />
      );
    },
    [metadataCache]
  );

  // 추천 콘텐츠 카드 렌더링
  const renderRecommendedContentCard = useCallback(
    (content: SelectedContent) => {
      const metadata = metadataCache.get(content.content_id);
      
      // allRecommendedContents에서 원본 추천 콘텐츠 정보 찾기
      const originalContent = allRecommendedContents.find(
        (c) => c.id === content.content_id || 
               (content.master_content_id && c.id === content.master_content_id)
      );

      return (
        <ContentCard
          key={content.content_id}
          content={{
            id: content.content_id,
            title: content.title || "제목 없음",
            subject: originalContent?.subject || metadata?.subject || content.subject_category || undefined,
            semester: originalContent?.semester || metadata?.semester,
            difficulty: originalContent?.difficulty_level || metadata?.difficulty_level,
            publisher: originalContent?.publisher || metadata?.publisher,
            platform: originalContent?.platform || metadata?.platform,
          }}
          selected={true}
          readOnly={true}
          range={{
            start: String(content.start_range),
            end: String(content.end_range),
            start_detail_id: content.start_detail_id,
            end_detail_id: content.end_detail_id,
          }}
          recommended={
            originalContent
              ? {
                  priority: originalContent.priority,
                  reason: originalContent.reason,
                  scoreDetails: originalContent.scoreDetails,
                }
              : undefined
          }
        />
      );
    },
    [metadataCache, allRecommendedContents]
  );

  const hasStudentContents = studentContents.length > 0;
  const hasRecommendedContents = recommendedContents.length > 0;
  const hasAnyContents = hasStudentContents || hasRecommendedContents;

  return (
    <div className="space-y-6">
      {!hasAnyContents ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm font-medium text-gray-900">
            등록된 콘텐츠가 없습니다
          </p>
        </div>
      ) : (
        <>
          {/* 학생 콘텐츠 섹션 */}
          {hasStudentContents && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  학생 콘텐츠
                </h3>
                <span className="text-xs text-gray-600">
                  {studentContents.length}개
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {studentContents.map(renderStudentContentCard)}
              </div>
            </div>
          )}

          {/* 추천 콘텐츠 섹션 */}
          {hasRecommendedContents && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  추천 콘텐츠
                </h3>
                <span className="text-xs text-gray-600">
                  {recommendedContents.length}개
                </span>
              </div>
              <div className="space-y-3">
                {recommendedContents.map(renderRecommendedContentCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

