"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { SelectedContent, ContentRange } from "@/lib/types/content-selection";
import { ContentMaster } from "@/lib/types/plan";
import { RangeSettingModal } from "./RangeSettingModal";
import { searchContentMastersAction } from "@/lib/domains/content";
import { Package } from "lucide-react";
import {
  hasMasterContentId,
  extractMasterContentIds,
  filterContentsWithMasterId,
} from "../../../utils/typeGuards";

// Sub-components
import {
  ContentTypeSelector,
  SearchFilters,
  SearchResultsList,
  AddedMasterContentsList,
  type ContentTypeFilter,
} from "./master-contents";

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
  const [selectedContentType, setSelectedContentType] =
    useState<ContentTypeFilter>("all");
  const [curriculumRevisionId, setCurriculumRevisionId] = useState("");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [searchResults, setSearchResults] = useState<ContentMaster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [curriculumRevisions, setCurriculumRevisions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [subjectGroups, setSubjectGroups] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [subjectsMap, setSubjectsMap] = useState<
    Map<string, Array<{ id: string; name: string }>>
  >(new Map());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 현재 선택된 교과의 과목 목록
  const currentSubjects = subjectGroupId
    ? subjectsMap.get(subjectGroupId) || []
    : [];

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
  const remaining = maxContents - currentTotal;

  // 이미 선택된 마스터 콘텐츠 ID 수집
  const selectedMasterIds = useMemo(() => {
    return extractMasterContentIds(selectedContents);
  }, [selectedContents]);

  // 개정교육과정 목록 로드
  useEffect(() => {
    fetch("/api/curriculum-revisions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurriculumRevisions(data.data || []);
        }
      })
      .catch((err) => {
        console.error("개정교육과정 목록 로드 실패:", err);
      });
  }, []);

  // 개정교육과정 변경 시 교과와 과목 목록 로드
  useEffect(() => {
    if (curriculumRevisionId) {
      loadHierarchyData(curriculumRevisionId);
    } else {
      setSubjectGroups([]);
      setSubjectsMap(new Map());
      setSubjectGroupId("");
      setSubjectId("");
    }
  }, [curriculumRevisionId]);

  // 교과 변경 시 과목 초기화
  useEffect(() => {
    if (subjectGroupId && !subjectsMap.has(subjectGroupId)) {
      setLoadingSubjects(true);
      fetch(`/api/subjects?subject_group_id=${subjectGroupId}`)
        .then((res) => res.json())
        .then((data) => {
          const newSubjects = data.data || [];
          setSubjectsMap((prev) => {
            const next = new Map(prev);
            next.set(subjectGroupId, newSubjects);
            return next;
          });
          setLoadingSubjects(false);
        })
        .catch((err) => {
          console.error("과목 목록 로드 실패:", err);
          setLoadingSubjects(false);
        });
    }

    if (subjectGroupId) {
      setSubjectId("");
    }
  }, [subjectGroupId, subjectsMap]);

  // 계층 구조 데이터 로드
  const loadHierarchyData = async (curriculumRevisionId: string) => {
    setLoadingGroups(true);
    setLoadingSubjects(true);

    try {
      const response = await fetch(
        `/api/subject-groups?curriculum_revision_id=${curriculumRevisionId}&include_subjects=true`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "데이터 로드 실패");
      }

      const groupsWithSubjects = result.data || [];
      const groups: Array<{ id: string; name: string }> = groupsWithSubjects.map(
        (group: {
          id: string;
          name: string;
          subjects?: Array<{ id: string; name: string }>;
        }) => ({
          id: group.id,
          name: group.name,
        })
      );

      const newSubjectsMap = new Map<
        string,
        Array<{ id: string; name: string }>
      >();
      groupsWithSubjects.forEach(
        (group: {
          id: string;
          name: string;
          subjects?: Array<{ id: string; name: string }>;
        }) => {
          if (group.subjects && group.subjects.length > 0) {
            newSubjectsMap.set(group.id, group.subjects);
          }
        }
      );

      setSubjectGroups(groups);
      setSubjectsMap(newSubjectsMap);
      setSubjectGroupId("");
      setSubjectId("");
      setLoadingGroups(false);
      setLoadingSubjects(false);
    } catch (err) {
      console.error("계층 구조 데이터 로드 실패:", err);
      setLoadingGroups(false);
      setLoadingSubjects(false);
      setSubjectGroups([]);
      setSubjectsMap(new Map());
    }
  };

  // 마스터 콘텐츠 검색
  const handleSearch = useCallback(async () => {
    if (
      !searchQuery.trim() &&
      !curriculumRevisionId &&
      !subjectGroupId &&
      !subjectId &&
      selectedContentType === "all"
    ) {
      alert("검색어, 필터, 또는 콘텐츠 타입을 선택해주세요.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchPromises: Promise<{
        data: ContentMaster[];
        total: number;
      }>[] = [];

      if (selectedContentType === "all" || selectedContentType === "book") {
        searchPromises.push(
          searchContentMastersAction({
            content_type: "book",
            curriculum_revision_id: curriculumRevisionId || undefined,
            subject_group_id: subjectGroupId || undefined,
            subject_id: subjectId || undefined,
            search: searchQuery.trim() || undefined,
            limit: 20,
          }) as unknown as Promise<{ data: ContentMaster[]; total: number }>
        );
      }

      if (selectedContentType === "all" || selectedContentType === "lecture") {
        searchPromises.push(
          searchContentMastersAction({
            content_type: "lecture",
            curriculum_revision_id: curriculumRevisionId || undefined,
            subject_group_id: subjectGroupId || undefined,
            subject_id: subjectId || undefined,
            search: searchQuery.trim() || undefined,
            limit: 20,
          }) as unknown as Promise<{ data: ContentMaster[]; total: number }>
        );
      }

      const results = await Promise.all(searchPromises);
      const allResults: ContentMaster[] = [];

      results.forEach((result, index) => {
        const dataWithType = result.data.map((item) => {
          if (!item.content_type) {
            const contentType: "book" | "lecture" =
              selectedContentType === "book" ||
              (selectedContentType === "all" && index === 0)
                ? "book"
                : "lecture";
            return { ...item, content_type: contentType } as ContentMaster;
          }
          return item;
        });
        allResults.push(...dataWithType);
      });

      setSearchResults(allResults);
    } catch (error) {
      console.error("[MasterContentsPanel] 검색 실패:", error);
      alert(error instanceof Error ? error.message : "검색에 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  }, [
    searchQuery,
    curriculumRevisionId,
    subjectGroupId,
    subjectId,
    selectedContentType,
  ]);

  // 마스터 콘텐츠 선택
  const handleMasterContentSelect = useCallback(
    (masterContent: ContentMaster) => {
      if (!editable) return;

      if (maxReached) {
        alert(`플랜 대상 콘텐츠는 최대 ${maxContents}개까지 가능합니다.`);
        return;
      }

      if (selectedMasterIds.has(masterContent.id)) {
        alert("이미 추가된 콘텐츠입니다.");
        return;
      }

      const contentType = masterContent.content_type;
      if (contentType !== "book" && contentType !== "lecture") {
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

      if (content.content_type === "custom") {
        alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        return;
      }

      const masterContentId = hasMasterContentId(content)
        ? content.master_content_id
        : content.content_id;

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

      const existingIndex = selectedContents.findIndex(
        (c) => hasMasterContentId(c) && c.master_content_id === masterContentId
      );

      const newContent: SelectedContent = {
        content_type: type,
        content_id: id,
        start_range: Number(range.start.replace(/[^\d]/g, "")),
        end_range: Number(range.end.replace(/[^\d]/g, "")),
        start_detail_id: range.start_detail_id,
        end_detail_id: range.end_detail_id,
        title,
        master_content_id: masterContentId,
      };

      let updated: SelectedContent[];
      if (existingIndex >= 0) {
        updated = [...selectedContents];
        updated[existingIndex] = newContent;
      } else {
        updated = [...selectedContents, newContent];
      }

      onUpdate(updated);
      setRangeModalOpen(false);
      setRangeModalContent(null);
    },
    [rangeModalContent, selectedContents, onUpdate]
  );

  // 필터링된 검색 결과
  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((result) => !selectedMasterIds.has(result.id));
  }, [searchResults, selectedMasterIds]);

  // 마스터 콘텐츠에서 추가된 콘텐츠만 필터링
  const masterContentsAdded = useMemo(() => {
    return filterContentsWithMasterId(selectedContents);
  }, [selectedContents]);

  // 검색 비활성화 조건
  const searchDisabled =
    !searchQuery.trim() &&
    !curriculumRevisionId &&
    !subjectGroupId &&
    !subjectId &&
    selectedContentType === "all";

  return (
    <div className="flex flex-col gap-6">
      {/* 검색 폼 */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-800" />
          <h3 className="text-lg font-semibold text-gray-900">
            마스터 콘텐츠 검색
          </h3>
        </div>

        <div className="flex flex-col gap-4">
          <ContentTypeSelector
            value={selectedContentType}
            onChange={setSelectedContentType}
            disabled={!editable || isSearching}
          />

          <SearchFilters
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            curriculumRevisionId={curriculumRevisionId}
            onCurriculumRevisionChange={(value) => {
              setCurriculumRevisionId(value);
              setSubjectGroupId("");
              setSubjectId("");
            }}
            subjectGroupId={subjectGroupId}
            onSubjectGroupChange={(value) => {
              setSubjectGroupId(value);
              setSubjectId("");
            }}
            subjectId={subjectId}
            onSubjectChange={setSubjectId}
            curriculumRevisions={curriculumRevisions}
            subjectGroups={subjectGroups}
            currentSubjects={currentSubjects}
            loadingGroups={loadingGroups}
            loadingSubjects={loadingSubjects}
            disabled={!editable}
            isSearching={isSearching}
            onSearch={handleSearch}
            searchDisabled={searchDisabled}
          />
        </div>
      </div>

      {/* 검색 결과 */}
      {hasSearched && (
        <SearchResultsList
          results={filteredSearchResults}
          isSearching={isSearching}
          onSelect={handleMasterContentSelect}
          maxReached={maxReached}
          selectedMasterIds={selectedMasterIds}
          editable={editable}
        />
      )}

      {/* 추가된 마스터 콘텐츠 목록 */}
      <AddedMasterContentsList
        contents={masterContentsAdded}
        onRemove={handleContentRemove}
        onEditRange={handleEditRange}
        editable={editable}
      />

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
          isRecommendedContent={true}
          currentRange={rangeModalContent.currentRange}
          onSave={handleRangeSave}
        />
      )}
    </div>
  );
}
