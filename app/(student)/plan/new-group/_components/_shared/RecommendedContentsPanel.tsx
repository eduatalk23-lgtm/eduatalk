"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  RecommendedContentsPanelProps,
  SelectedContent,
  RecommendedContent,
  ContentRange,
} from "@/lib/types/content-selection";
import { ContentCard } from "./ContentCard";
import { RangeSettingModal } from "./RangeSettingModal";
import { Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * RecommendedContentsPanel - 추천 콘텐츠 선택 패널
 *
 * Phase 3.4에서 구현
 * Step4RecommendedContents.tsx의 로직을 분리하여 재사용 가능하게 구현
 */
export function RecommendedContentsPanel({
  recommendedContents,
  allRecommendedContents,
  selectedContents,
  selectedRecommendedIds,
  maxContents,
  currentTotal,
  settings,
  onSettingsChange,
  onUpdate,
  onRequestRecommendations,
  isEditMode = false,
  isCampMode = false,
  loading = false,
  hasRequestedRecommendations = false,
  hasScoreData = false,
  studentId,
  isAdminContinueMode = false,
  editable = true,
}: RecommendedContentsPanelProps) {
  // 범위 설정 모달
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeModalContent, setRangeModalContent] = useState<{
    id: string;
    type: "book" | "lecture";
    title: string;
    recommendedContent?: RecommendedContent;
    currentRange?: ContentRange;
  } | null>(null);

  // 최대 개수 도달
  const maxReached = currentTotal >= maxContents;
  const canAddMore = !maxReached;
  const remaining = maxContents - currentTotal;

  // 추천 받기 가능 여부
  const canRequestRecommendations = useMemo(() => {
    return (
      settings.selectedSubjects.size > 0 &&
      Array.from(settings.selectedSubjects).every(
        (subject) => (settings.recommendationCounts.get(subject) || 0) > 0
      )
    );
  }, [settings]);

  // 과목 선택 토글
  const handleSubjectToggle = useCallback(
    (subject: string) => {
      if (!editable) return;
      const newSubjects = new Set(settings.selectedSubjects);
      if (newSubjects.has(subject)) {
        newSubjects.delete(subject);
        const newCounts = new Map(settings.recommendationCounts);
        newCounts.delete(subject);
        onSettingsChange({
          ...settings,
          selectedSubjects: newSubjects,
          recommendationCounts: newCounts,
        });
      } else {
        newSubjects.add(subject);
        const newCounts = new Map(settings.recommendationCounts);
        newCounts.set(subject, 1); // 기본값 1개
        onSettingsChange({
          ...settings,
          selectedSubjects: newSubjects,
          recommendationCounts: newCounts,
        });
      }
    },
    [settings, onSettingsChange]
  );

  // 추천 개수 변경
  const handleCountChange = useCallback(
    (subject: string, count: number) => {
      if (!editable) return;
      const newCounts = new Map(settings.recommendationCounts);
      newCounts.set(subject, Math.max(1, Math.min(5, count)));
      onSettingsChange({
        ...settings,
        recommendationCounts: newCounts,
      });
    },
    [settings, onSettingsChange]
  );

  // 추천 콘텐츠 선택
  const handleRecommendedSelect = useCallback(
    (content: RecommendedContent) => {
      if (!editable) return;
      if (!canAddMore) {
        alert(`플랜 대상 콘텐츠는 최대 ${maxContents}개까지 가능합니다.`);
        return;
      }

      // contentType 검증 (서버에서 보장되지만 방어 코드)
      if (!content.contentType) {
        const errorMessage = `[RecommendedContentsPanel] contentType이 없습니다. contentId: ${content.id}, title: ${content.title}`;
        console.error(errorMessage, {
          content,
          allKeys: Object.keys(content),
          contentType: content.contentType,
          content_type: (content as any).content_type,
        });
        alert("콘텐츠 타입 정보가 없습니다. 페이지를 새로고침해주세요.");
        return;
      }

      const contentType = content.contentType;

      // custom 타입은 범위 설정을 지원하지 않음 (방어 코드)
      if (contentType === "custom") {
        const errorMessage = `[RecommendedContentsPanel] custom 타입 추천 콘텐츠는 지원하지 않습니다. contentId: ${content.id}, title: ${content.title}, contentType: ${contentType}`;
        console.error(errorMessage, { content });
        return;
      }

      // 타입 검증
      if (contentType !== "book" && contentType !== "lecture") {
        const errorMessage = `[RecommendedContentsPanel] 잘못된 contentType입니다. contentId: ${content.id}, contentType: ${contentType}`;
        console.error(errorMessage, { content });
        alert("지원하지 않는 콘텐츠 타입입니다.");
        return;
      }

      // 범위 설정 모달 열기
      const modalContent = {
        id: content.id,
        type: contentType as "book" | "lecture",
        title: content.title,
        recommendedContent: content,
      };

      console.log("[RecommendedContentsPanel] 범위 설정 모달 열기:", {
        modalContent,
        originalContent: content,
      });

      setRangeModalContent(modalContent);
      setRangeModalOpen(true);
    },
    [canAddMore, maxContents, editable]
  );

  // 추천 콘텐츠 삭제
  const handleRecommendedRemove = useCallback(
    (contentId: string) => {
      if (!editable) return;
      const updated = selectedContents.filter(
        (c) => c.content_id !== contentId
      );
      onUpdate(updated);
    },
    [selectedContents, onUpdate, editable]
  );

  // 범위 수정 모달 열기
  const handleEditRange = useCallback(
    (content: SelectedContent) => {
      if (!editable) return;
      // custom 타입은 범위 설정을 지원하지 않음
      if (content.content_type === "custom") {
        const errorMessage = `[RecommendedContentsPanel] custom 타입 콘텐츠는 범위 설정을 지원하지 않습니다. contentId: ${content.content_id}, title: ${content.title}`;
        console.error(errorMessage, { content });
        alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        return;
      }

      // allRecommendedContents에서 원본 정보 찾기
      const originalContent = allRecommendedContents.find(
        (c) => c.id === content.content_id
      );

      setRangeModalContent({
        id: content.content_id,
        type: content.content_type as "book" | "lecture",
        title: content.title || "제목 없음",
        recommendedContent: originalContent,
        currentRange: {
          start: String(content.start_range),
          end: String(content.end_range),
          start_detail_id: content.start_detail_id,
          end_detail_id: content.end_detail_id,
        },
      });
      setRangeModalOpen(true);
    },
    [allRecommendedContents, editable]
  );

  // 범위 저장
  const handleRangeSave = useCallback(
    (range: ContentRange) => {
      if (!editable) return;
      if (!rangeModalContent) return;

      const { id, type, title, recommendedContent } = rangeModalContent;

      // 기존 콘텐츠 찾기
      const existingIndex = selectedContents.findIndex(
        (c) => c.content_id === id
      );

      const newContent: SelectedContent = {
        content_type: type,
        content_id: id,
        start_range: Number(range.start.replace(/[^\d]/g, "")),
        end_range: Number(range.end.replace(/[^\d]/g, "")),
        start_detail_id: range.start_detail_id,
        end_detail_id: range.end_detail_id,
        title,
        subject_category: recommendedContent?.subject_category || undefined,
        master_content_id: id, // 추천 콘텐츠는 항상 마스터 콘텐츠 ID
        is_auto_recommended: false, // 수동 선택 플래그
      };

      let updated: SelectedContent[];
      if (existingIndex >= 0) {
        // 기존 콘텐츠 업데이트
        updated = [...selectedContents];
        updated[existingIndex] = newContent;
      } else {
        // 새 콘텐츠 추가
        updated = [...selectedContents, newContent];
      }

      onUpdate(updated);
      setRangeModalOpen(false);
      setRangeModalContent(null);
    },
    [rangeModalContent, selectedContents, onUpdate, editable]
  );

  // 추천 요청 폼 표시 조건: 관리자 모드일 때는 항상 표시, 그 외에는 추천을 받기 전이거나, 추천을 받았지만 목록이 비어있을 때
  const shouldShowRecommendationForm =
    isAdminContinueMode || // 관리자 모드일 때는 항상 표시
    (!isEditMode && !hasRequestedRecommendations) ||
    (hasRequestedRecommendations &&
      recommendedContents.length === 0 &&
      !loading);

  return (
    <div className="space-y-6">
      {/* 추천 받기 설정 */}
      {shouldShowRecommendationForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              AI 추천 콘텐츠 받기
            </h3>
          </div>

          {/* 성적 데이터 안내 */}
          {!hasScoreData && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">성적 데이터가 없습니다</p>
                <p className="mt-0.5">
                  성적을 입력하면 더 정확한 추천을 받을 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* 과목 선택 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-800">
              추천받을 과목 선택
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["국어", "수학", "영어", "과학", "사회"].map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => handleSubjectToggle(subject)}
                  className={cn(
                    "rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors",
                    settings.selectedSubjects.has(subject)
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-gray-300 bg-white text-gray-800 hover:border-gray-400"
                  )}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* 과목별 추천 개수 */}
          {settings.selectedSubjects.size > 0 && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-800">
                과목별 추천 개수
              </label>
              {Array.from(settings.selectedSubjects).map((subject) => (
                <div key={subject} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-medium text-gray-800">
                    {subject}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.recommendationCounts.get(subject) || 1}
                    onChange={(e) =>
                      handleCountChange(subject, Number(e.target.value))
                    }
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                  <span className="text-sm text-gray-600">개</span>
                </div>
              ))}
            </div>
          )}

          {/* 자동 배정 옵션 */}
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoAssignContents}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    autoAssignContents: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-800">
                추천 콘텐츠 자동 배정 (전체 범위)
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-600">
              체크하면 추천받은 콘텐츠가 자동으로 추가됩니다 (범위: 전체)
            </p>
          </div>

          {/* 추천 받기 버튼 */}
          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              onRequestRecommendations();
            }}
            disabled={!editable || !canRequestRecommendations || loading || maxReached}
            className={cn(
              "mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700",
              (!editable || !canRequestRecommendations || loading || maxReached) &&
                "cursor-not-allowed opacity-50"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                추천 분석 중...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                추천 받기
              </span>
            )}
          </button>
        </div>
      )}

      {/* 추천 콘텐츠 목록 */}
      {hasRequestedRecommendations && recommendedContents.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                추천 콘텐츠
              </h3>
            </div>
            <span className="text-sm text-gray-600">
              {recommendedContents.length}개
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {recommendedContents.map((content) => (
              <ContentCard
                key={content.id}
                content={{
                  id: content.id,
                  title: content.title,
                  subject: content.subject,
                  semester: content.semester,
                  difficulty: content.difficulty_level,
                  publisher: content.publisher,
                  platform: content.platform,
                }}
                selected={false}
                recommended={{
                  priority: content.priority,
                  reason: content.reason,
                  scoreDetails: content.scoreDetails,
                }}
                onToggle={() => handleRecommendedSelect(content)}
                disabled={maxReached}
              />
            ))}
          </div>
        </div>
      )}

      {/* 추천 콘텐츠 없음 */}
      {hasRequestedRecommendations && recommendedContents.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            추천할 콘텐츠가 없습니다
          </p>
          <p className="mt-1 text-sm text-gray-600">
            이미 모든 추천 콘텐츠를 선택하셨거나,
            <br />
            현재 조건에 맞는 추천이 없습니다.
          </p>
        </div>
      )}

      {/* 선택된 추천 콘텐츠 */}
      {selectedContents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              선택된 추천 콘텐츠
            </h3>
            <span className="text-sm text-gray-600">
              {selectedContents.length}개
            </span>
          </div>
          <div className="space-y-3">
            {selectedContents.map((content, index) => {
              // allRecommendedContents에서 찾을 때 더 정확한 매칭
              // content_id로 먼저 찾고, 없으면 master_content_id로 찾기
              const originalContent = allRecommendedContents.find(
                (c) => c.id === content.content_id || 
                       (content.master_content_id && c.id === content.master_content_id)
              );

              return (
                <ContentCard
                  key={`${content.content_id}-${content.start_range}-${content.end_range}-${index}`}
                  content={{
                    id: content.content_id,
                    title: content.title || "제목 없음",
                    subject: originalContent?.subject,
                    semester: originalContent?.semester,
                    difficulty: originalContent?.difficulty_level,
                    publisher: originalContent?.publisher,
                    platform: originalContent?.platform,
                  }}
                  selected={true}
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
                  onRemove={() => handleRecommendedRemove(content.content_id)}
                  onEditRange={() => handleEditRange(content)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 범위 설정 모달 */}
      {rangeModalContent && (
        <RangeSettingModal
          open={rangeModalOpen}
          onClose={() => {
            setRangeModalOpen(false);
            setRangeModalContent(null);
          }}
          content={rangeModalContent}
          isRecommendedContent={true}
          currentRange={rangeModalContent.currentRange}
          onSave={handleRangeSave}
        />
      )}
    </div>
  );
}
