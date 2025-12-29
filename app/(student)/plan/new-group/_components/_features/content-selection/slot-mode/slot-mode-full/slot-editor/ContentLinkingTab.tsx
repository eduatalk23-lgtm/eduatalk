"use client";

import { cn } from "@/lib/cn";
import { Search, Loader2, Check, Settings } from "lucide-react";
import { SOURCE_TAB_CONFIG } from "./constants";
import {
  ContentListItem,
  RecommendedContentListItem,
  MasterContentListItem,
} from "./ContentListItems";
import type { ContentLinkingTabProps, SourceTab } from "./types";

/**
 * 콘텐츠 연결 탭
 *
 * 학생 콘텐츠, 추천 콘텐츠, 마스터 콘텐츠에서 슬롯에 연결할 콘텐츠를 선택합니다.
 */
export function ContentLinkingTab({
  slot,
  filteredContents,
  sourceTab,
  searchQuery,
  recommendedContents,
  isLoadingRecommendations,
  masterSearch,
  editable,
  studentId,
  onSourceTabChange,
  onSearchQueryChange,
  onSelectContent,
  onSelectRecommendedOrMaster,
  onMasterSearch,
  onUnlinkContent,
}: ContentLinkingTabProps) {
  // 슬롯 타입 미선택
  if (!slot.slot_type) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Settings className="mb-3 h-8 w-8 text-gray-300" />
        <div className="text-sm text-gray-500">
          먼저 &quot;슬롯 상세&quot; 탭에서
          <br />
          슬롯 타입을 선택해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 현재 연결된 콘텐츠 */}
      {slot.content_id && (
        <div className="mb-4 flex-shrink-0 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {slot.title}
              </span>
            </div>
            {editable && (
              <button
                type="button"
                onClick={onUnlinkContent}
                className="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-600"
              >
                연결 해제
              </button>
            )}
          </div>
          {slot.start_range !== undefined && (
            <div className="mt-1.5 text-xs text-green-600">
              범위: {slot.start_range} - {slot.end_range}
            </div>
          )}
        </div>
      )}

      {/* 소스 탭 */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(Object.keys(SOURCE_TAB_CONFIG) as SourceTab[]).map((tab) => {
            const config = SOURCE_TAB_CONFIG[tab];
            const isActive = sourceTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSourceTabChange(tab)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? tab === "recommended"
                      ? "bg-amber-500 text-white"
                      : tab === "master"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <config.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 검색 */}
      {(sourceTab === "student" || sourceTab === "master") && (
        <div className="mb-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={
                sourceTab === "master" ? masterSearch.searchQuery : searchQuery
              }
              onChange={(e) => {
                if (sourceTab === "master") {
                  masterSearch.setSearchQuery(e.target.value);
                } else {
                  onSearchQueryChange(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sourceTab === "master") {
                  onMasterSearch();
                }
              }}
              placeholder={
                sourceTab === "master"
                  ? "마스터 콘텐츠 검색..."
                  : "콘텐츠 검색..."
              }
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          {sourceTab === "master" && (
            <button
              type="button"
              onClick={onMasterSearch}
              disabled={
                !masterSearch.searchQuery.trim() || masterSearch.isSearching
              }
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
                masterSearch.searchQuery.trim() && !masterSearch.isSearching
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {masterSearch.isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  검색
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 콘텐츠 리스트 */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {sourceTab === "student" &&
          (filteredContents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {searchQuery
                ? "검색 결과가 없습니다"
                : "사용 가능한 콘텐츠가 없습니다"}
            </div>
          ) : (
            filteredContents.map((content) => (
              <ContentListItem
                key={content.id}
                content={content}
                isLinked={slot.content_id === content.id}
                onSelect={() => onSelectContent(content)}
                disabled={!editable}
              />
            ))
          ))}

        {sourceTab === "recommended" &&
          (isLoadingRecommendations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <span className="ml-2 text-sm text-gray-500">
                추천 콘텐츠 로드 중...
              </span>
            </div>
          ) : recommendedContents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {!studentId
                ? "학생 정보가 필요합니다"
                : !slot.subject_category
                  ? "교과를 먼저 선택해주세요"
                  : "추천 콘텐츠가 없습니다"}
            </div>
          ) : (
            recommendedContents.map((content) => (
              <RecommendedContentListItem
                key={content.id}
                content={content}
                onSelect={() => onSelectRecommendedOrMaster(content)}
                disabled={!editable}
              />
            ))
          ))}

        {sourceTab === "master" &&
          (masterSearch.isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">검색 중...</span>
            </div>
          ) : !masterSearch.hasSearched ? (
            <div className="py-8 text-center text-sm text-gray-400">
              검색어를 입력하고 검색 버튼을 클릭하세요
            </div>
          ) : masterSearch.results.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              검색 결과가 없습니다
            </div>
          ) : (
            masterSearch.results.map((content) => (
              <MasterContentListItem
                key={content.id}
                content={content}
                onSelect={() => onSelectRecommendedOrMaster(content)}
                disabled={!editable}
              />
            ))
          ))}
      </div>
    </div>
  );
}
