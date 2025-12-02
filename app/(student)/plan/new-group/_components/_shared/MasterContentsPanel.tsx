"use client";

import React, { useState, useCallback, useMemo } from "react";
import { SelectedContent, ContentRange } from "@/lib/types/content-selection";
import { ContentMaster } from "@/lib/types/plan";
import { ContentCard } from "./ContentCard";
import { RangeSettingModal } from "./RangeSettingModal";
import { searchContentMastersAction } from "@/app/(student)/actions/contentMasterActions";
import { Package, Search, BookOpen, Headphones } from "lucide-react";
import { cn } from "@/lib/cn";

type MasterContentsPanelProps = {
  selectedContents: SelectedContent[];
  maxContents: number;
  currentTotal: number;
  onUpdate: (contents: SelectedContent[]) => void;
  editable?: boolean;
  isCampMode?: boolean;
};

/**
 * MasterContentsPanel - 마스터 콘텐츠 선택 패널
 * 
 * 마스터 콘텐츠를 검색하고 선택하여 student_contents에 추가
 */
export function MasterContentsPanel({
  selectedContents,
  maxContents,
  currentTotal,
  onUpdate,
  editable = true,
  isCampMode = false,
}: MasterContentsPanelProps) {
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContentType, setSelectedContentType] = useState<"book" | "lecture" | "all">("all");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [searchResults, setSearchResults] = useState<ContentMaster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 범위 설정 모달
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeModalContent, setRangeModalContent] = useState<{
    id: string;
    type: "book" | "lecture";
    title: string;
    masterContentId: string;
    currentRange?: ContentRange;
  } | null>(null);

  // 최대 개수 도달
  const maxReached = currentTotal >= maxContents;
  const canAddMore = !maxReached;
  const remaining = maxContents - currentTotal;

  // 이미 선택된 마스터 콘텐츠 ID 수집 (중복 체크용)
  const selectedMasterIds = useMemo(() => {
    const ids = new Set<string>();
    selectedContents.forEach((c) => {
      if ((c as any).master_content_id) {
        ids.add((c as any).master_content_id);
      }
    });
    return ids;
  }, [selectedContents]);

  // 마스터 콘텐츠 검색
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && !selectedSubject && selectedContentType === "all") {
      alert("검색어, 과목, 또는 콘텐츠 타입을 선택해주세요.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 콘텐츠 타입별로 검색
      const searchPromises: Promise<{ data: ContentMaster[]; total: number }>[] = [];

      if (selectedContentType === "all" || selectedContentType === "book") {
        searchPromises.push(
          searchContentMastersAction({
            content_type: "book",
            search: searchQuery.trim() || undefined,
            subject: selectedSubject || undefined,
            limit: 20,
          })
        );
      }

      if (selectedContentType === "all" || selectedContentType === "lecture") {
        searchPromises.push(
          searchContentMastersAction({
            content_type: "lecture",
            search: searchQuery.trim() || undefined,
            subject: selectedSubject || undefined,
            limit: 20,
          })
        );
      }

      const results = await Promise.all(searchPromises);
      const allResults: ContentMaster[] = [];
      
      // 각 검색 결과를 합치면서 content_type 확인
      results.forEach((result, index) => {
        // searchContentMasters에서 이미 content_type을 추가했지만, 
        // 혹시 모를 경우를 대비해 검증 및 추가
        const dataWithType = result.data.map((item: any) => {
          // content_type이 없으면 검색 타입에 따라 추가
          if (!item.content_type) {
            // 첫 번째 결과는 book, 두 번째는 lecture (selectedContentType === "all"인 경우)
            const contentType = 
              (selectedContentType === "book") || 
              (selectedContentType === "all" && index === 0)
                ? "book"
                : "lecture";
            return {
              ...item,
              content_type: contentType,
            };
          }
          return item;
        });
        
        allResults.push(...dataWithType);
      });

      // 디버깅: 검색 결과의 content_type 확인
      if (process.env.NODE_ENV === "development") {
        console.log("[MasterContentsPanel] 검색 결과:", {
          selectedContentType,
          resultsCount: allResults.length,
          contentTypes: allResults.map((r) => ({
            id: r.id,
            title: r.title,
            content_type: r.content_type,
          })),
        });
      }

      setSearchResults(allResults);
    } catch (error) {
      console.error("[MasterContentsPanel] 검색 실패:", error);
      alert(
        error instanceof Error
          ? error.message
          : "검색에 실패했습니다."
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedSubject, selectedContentType]);

  // 마스터 콘텐츠 선택
  const handleMasterContentSelect = useCallback(
    (masterContent: ContentMaster) => {
      if (!editable) return;

      // 최대 개수 체크
      if (maxReached) {
        alert(`플랜 대상 콘텐츠는 최대 ${maxContents}개까지 가능합니다.`);
        return;
      }

      // 중복 체크
      if (selectedMasterIds.has(masterContent.id)) {
        alert("이미 추가된 콘텐츠입니다.");
        return;
      }

      // 범위 설정 모달 열기
      const contentType = masterContent.content_type;
      
      // content_type이 "book" 또는 "lecture"인지 확인
      if (contentType !== "book" && contentType !== "lecture") {
        console.error("[MasterContentsPanel] 잘못된 content_type:", {
          id: masterContent.id,
          title: masterContent.title,
          content_type: contentType,
        });
        alert("지원하지 않는 콘텐츠 타입입니다.");
        return;
      }
      
      setRangeModalContent({
        id: masterContent.id,
        type: contentType as "book" | "lecture",
        title: masterContent.title,
        masterContentId: masterContent.id,
      });
      setRangeModalOpen(true);
    },
    [editable, maxReached, maxContents, selectedMasterIds]
  );

  // 콘텐츠 삭제
  const handleContentRemove = useCallback(
    (contentId: string) => {
      if (!editable) return;
      const updated = selectedContents.filter((c) => c.content_id !== contentId);
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
        alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        return;
      }

      const masterContentId = (content as any).master_content_id || content.content_id;

      setRangeModalContent({
        id: masterContentId,
        type: content.content_type as "book" | "lecture",
        title: content.title || "제목 없음",
        masterContentId,
        currentRange: {
          start: String(content.start_range),
          end: String(content.end_range),
          start_detail_id: content.start_detail_id,
          end_detail_id: content.end_detail_id,
        },
      });
      setRangeModalOpen(true);
    },
    [editable]
  );

  // 범위 저장
  const handleRangeSave = useCallback(
    async (range: ContentRange) => {
      if (!rangeModalContent) return;

      const { id, type, title, masterContentId } = rangeModalContent;

      // 기존 콘텐츠 찾기 (master_content_id로 검색)
      const existingIndex = selectedContents.findIndex(
        (c) => (c as any).master_content_id === masterContentId
      );

      const newContent: SelectedContent = {
        content_type: type,
        content_id: id, // 마스터 콘텐츠 ID를 content_id로 사용
        start_range: Number(range.start.replace(/[^\d]/g, "")),
        end_range: Number(range.end.replace(/[^\d]/g, "")),
        start_detail_id: range.start_detail_id,
        end_detail_id: range.end_detail_id,
        title,
        master_content_id: masterContentId, // 마스터 콘텐츠 ID 저장
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
    [rangeModalContent, selectedContents, onUpdate]
  );

  // 필터링된 검색 결과 (이미 추가된 것 제외)
  const filteredSearchResults = useMemo(() => {
    return searchResults.filter(
      (result) => !selectedMasterIds.has(result.id)
    );
  }, [searchResults, selectedMasterIds]);

  // 마스터 콘텐츠에서 추가된 콘텐츠만 필터링
  const masterContentsAdded = useMemo(() => {
    return selectedContents.filter((c) => (c as any).master_content_id);
  }, [selectedContents]);

  return (
    <div className="space-y-6">
      {/* 검색 폼 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            마스터 콘텐츠 검색
          </h3>
        </div>

        <div className="space-y-4">
          {/* 콘텐츠 타입 선택 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              콘텐츠 타입
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedContentType("all")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  selectedContentType === "all"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setSelectedContentType("book")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  selectedContentType === "book"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <BookOpen className="h-4 w-4" />
                교재
              </button>
              <button
                type="button"
                onClick={() => setSelectedContentType("lecture")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  selectedContentType === "lecture"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <Headphones className="h-4 w-4" />
                강의
              </button>
            </div>
          </div>

          {/* 제목 검색 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              제목 검색
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none"
              placeholder="교재/강의 이름을 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              disabled={!editable || isSearching}
            />
          </div>

          {/* 과목 선택 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              과목 (선택사항)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none"
              placeholder="예: 국어, 수학"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!editable || isSearching}
            />
          </div>

          {/* 검색 버튼 */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={!editable || isSearching || (!searchQuery.trim() && !selectedSubject && selectedContentType === "all")}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                검색 중...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Search className="h-4 w-4" />
                검색
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 검색 결과 */}
      {hasSearched && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            검색 결과 ({filteredSearchResults.length}개)
          </h3>

          {isSearching ? (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 중...
            </div>
          ) : filteredSearchResults.length > 0 ? (
            <div className="space-y-2">
              {filteredSearchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {result.title}
                      </h4>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          result.content_type === "book"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        )}
                      >
                        {result.content_type === "book" ? "📚 교재" : "🎧 강의"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                      {result.publisher_or_academy && (
                        <span>{result.publisher_or_academy}</span>
                      )}
                      {result.subject && <span>· {result.subject}</span>}
                      {result.semester && <span>· {result.semester}</span>}
                      {result.revision && <span>· {result.revision}</span>}
                      {result.total_pages && (
                        <span>· {result.total_pages}페이지</span>
                      )}
                      {result.total_episodes && (
                        <span>· {result.total_episodes}회차</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMasterContentSelect(result)}
                    disabled={!editable || maxReached || selectedMasterIds.has(result.id)}
                    className={cn(
                      "ml-4 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors",
                      maxReached || selectedMasterIds.has(result.id)
                        ? "cursor-not-allowed bg-gray-400"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    )}
                  >
                    {selectedMasterIds.has(result.id) ? "추가됨" : "추가"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 추가된 마스터 콘텐츠 목록 */}
      {masterContentsAdded.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              추가된 마스터 콘텐츠
            </h3>
            <span className="text-sm text-gray-600">
              {masterContentsAdded.length}개
            </span>
          </div>
          <div className="space-y-3">
            {masterContentsAdded.map((content) => {
              const masterId = (content as any).master_content_id;
              return (
                <ContentCard
                  key={masterId || content.content_id}
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
                  onRemove={() => handleContentRemove(content.content_id)}
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
          content={{
            id: rangeModalContent.id,
            type: rangeModalContent.type,
            title: rangeModalContent.title,
          }}
          isRecommendedContent={true} // 마스터 콘텐츠는 마스터 API 사용
          currentRange={rangeModalContent.currentRange}
          onSave={handleRangeSave}
        />
      )}
    </div>
  );
}

