"use client";

/**
 * MasterContentSearchModal
 *
 * 관리자가 마스터 콘텐츠 라이브러리에서 검색하여 학생 플랜에 추가하는 모달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/_components/MasterContentSearchModal
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  X,
  Search,
  BookOpen,
  Video,
  Loader2,
  Plus,
  ChevronDown,
  Package,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  searchContentMastersAction,
  copyMasterToStudentContentAction,
} from "@/lib/domains/content/actions/master-search";
import type { SelectedContent } from "../../_context/types";

// ============================================
// Types
// ============================================

type ContentTypeFilter = "all" | "book" | "lecture";
type ModalTab = "search" | "direct";

interface MasterContentSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  content_type: "book" | "lecture";
  subject?: string;
  subject_category?: string;
  total_pages?: number;
  total_episodes?: number;
  total_duration?: number;
  publisher_name?: string;
  instructor?: string;
  platform_name?: string;
  cover_image_url?: string;
}

interface MasterContentSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: SelectedContent) => void;
  studentId: string;
  tenantId: string;
  existingContentIds: Set<string>;
}

// ============================================
// Component
// ============================================

export function MasterContentSearchModal({
  open,
  onClose,
  onSelect,
  studentId,
  tenantId,
  existingContentIds,
}: MasterContentSearchModalProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<ModalTab>("search");

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<ContentTypeFilter>("all");
  const [curriculumRevisionId, setCurriculumRevisionId] = useState("");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  // 직접 입력 상태
  const [directTitle, setDirectTitle] = useState("");
  const [directContentType, setDirectContentType] = useState<"book" | "lecture">("book");
  const [directSubject, setDirectSubject] = useState("");
  const [directTotalRange, setDirectTotalRange] = useState(100);
  const [directRangeStart, setDirectRangeStart] = useState(1);
  const [directRangeEnd, setDirectRangeEnd] = useState(100);
  const [isAddingDirect, setIsAddingDirect] = useState(false);

  // 검색 결과
  const [searchResults, setSearchResults] = useState<MasterContentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 필터 데이터
  const [curriculumRevisions, setCurriculumRevisions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [subjectGroups, setSubjectGroups] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 선택 및 범위 설정
  const [selectedMaster, setSelectedMaster] = useState<MasterContentSearchResult | null>(null);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // 개정교육과정 목록 로드
  useEffect(() => {
    if (!open) return;

    fetch("/api/curriculum-revisions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurriculumRevisions(data.data || []);
        }
      })
      .catch((err) => {
        console.error("[MasterContentSearchModal] 개정교육과정 로드 실패:", err);
      });
  }, [open]);

  // 개정교육과정 변경 시 교과 목록 로드
  useEffect(() => {
    if (!curriculumRevisionId) {
      setSubjectGroups([]);
      setSubjects([]);
      setSubjectGroupId("");
      setSubjectId("");
      return;
    }

    setLoadingGroups(true);
    fetch(
      `/api/subject-groups?curriculum_revision_id=${curriculumRevisionId}&include_subjects=true`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubjectGroups(
            data.data?.map((g: { id: string; name: string }) => ({
              id: g.id,
              name: g.name,
            })) || []
          );
        }
        setLoadingGroups(false);
      })
      .catch((err) => {
        console.error("[MasterContentSearchModal] 교과 목록 로드 실패:", err);
        setLoadingGroups(false);
      });

    setSubjectGroupId("");
    setSubjectId("");
  }, [curriculumRevisionId]);

  // 교과 변경 시 과목 목록 로드
  useEffect(() => {
    if (!subjectGroupId) {
      setSubjects([]);
      setSubjectId("");
      return;
    }

    setLoadingSubjects(true);
    fetch(`/api/subjects?subject_group_id=${subjectGroupId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubjects(data.data || []);
        }
        setLoadingSubjects(false);
      })
      .catch((err) => {
        console.error("[MasterContentSearchModal] 과목 목록 로드 실패:", err);
        setLoadingSubjects(false);
      });

    setSubjectId("");
  }, [subjectGroupId]);

  // 모달 닫을 때 상태 초기화
  useEffect(() => {
    if (!open) {
      // 탭 초기화
      setActiveTab("search");
      // 검색 상태 초기화
      setSearchQuery("");
      setContentType("all");
      setCurriculumRevisionId("");
      setSubjectGroupId("");
      setSubjectId("");
      setSearchResults([]);
      setHasSearched(false);
      setSelectedMaster(null);
      setRangeStart(1);
      setRangeEnd(1);
      // 직접 입력 상태 초기화
      setDirectTitle("");
      setDirectContentType("book");
      setDirectSubject("");
      setDirectTotalRange(100);
      setDirectRangeStart(1);
      setDirectRangeEnd(100);
    }
  }, [open]);

  // 검색 실행
  const handleSearch = useCallback(async () => {
    if (
      !searchQuery.trim() &&
      !curriculumRevisionId &&
      !subjectGroupId &&
      !subjectId &&
      contentType === "all"
    ) {
      alert("검색어, 필터, 또는 콘텐츠 타입을 선택해주세요.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results: MasterContentSearchResult[] = [];

      if (contentType === "all" || contentType === "book") {
        const bookResult = await searchContentMastersAction({
          content_type: "book",
          curriculum_revision_id: curriculumRevisionId || undefined,
          subject_group_id: subjectGroupId || undefined,
          subject_id: subjectId || undefined,
          search: searchQuery.trim() || undefined,
          limit: 20,
        });

        if (bookResult && "data" in bookResult) {
          results.push(
            ...bookResult.data.map((item) => ({
              id: item.id,
              title: item.title,
              content_type: "book" as const,
              subject: item.subject ?? undefined,
              subject_category: item.subject_category ?? undefined,
              total_pages: ("total_pages" in item ? item.total_pages : undefined) ?? undefined,
              publisher_name: item.publisher ?? undefined,
            }))
          );
        }
      }

      if (contentType === "all" || contentType === "lecture") {
        const lectureResult = await searchContentMastersAction({
          content_type: "lecture",
          curriculum_revision_id: curriculumRevisionId || undefined,
          subject_group_id: subjectGroupId || undefined,
          subject_id: subjectId || undefined,
          search: searchQuery.trim() || undefined,
          limit: 20,
        });

        if (lectureResult && "data" in lectureResult) {
          results.push(
            ...lectureResult.data.map((item) => ({
              id: item.id,
              title: item.title,
              content_type: "lecture" as const,
              subject: item.subject ?? undefined,
              subject_category: item.subject_category ?? undefined,
              total_episodes: ("total_episodes" in item ? item.total_episodes : undefined) ?? undefined,
              platform_name: item.platform ?? undefined,
            }))
          );
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error("[MasterContentSearchModal] 검색 실패:", error);
      alert(error instanceof Error ? error.message : "검색에 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, curriculumRevisionId, subjectGroupId, subjectId, contentType]);

  // 마스터 콘텐츠 선택
  const handleSelectMaster = useCallback((master: MasterContentSearchResult) => {
    if (existingContentIds.has(master.id)) {
      alert("이미 추가된 콘텐츠입니다.");
      return;
    }

    const totalRange =
      master.content_type === "book"
        ? master.total_pages || 100
        : master.total_episodes || 10;

    setSelectedMaster(master);
    setRangeStart(1);
    setRangeEnd(totalRange);
  }, [existingContentIds]);

  // 콘텐츠 추가 (학생 콘텐츠로 복사 후 위자드에 추가)
  const handleAddContent = useCallback(async () => {
    if (!selectedMaster) return;

    setIsAdding(true);

    try {
      // 마스터 콘텐츠를 학생 콘텐츠로 복사
      const result = await copyMasterToStudentContentAction(
        selectedMaster.id,
        studentId,
        selectedMaster.content_type
      );

      if (!result) {
        throw new Error("콘텐츠 복사에 실패했습니다.");
      }

      // 복사된 학생 콘텐츠 ID
      const newContentId =
        selectedMaster.content_type === "book"
          ? result.bookId
          : result.lectureId;

      if (!newContentId) {
        throw new Error("콘텐츠 ID를 찾을 수 없습니다.");
      }

      const totalRange =
        selectedMaster.content_type === "book"
          ? selectedMaster.total_pages || 100
          : selectedMaster.total_episodes || 10;

      // 위자드에 추가할 SelectedContent 생성
      const newContent: SelectedContent = {
        contentId: newContentId,
        contentType: selectedMaster.content_type,
        title: selectedMaster.title,
        subject: selectedMaster.subject || undefined,
        subjectCategory: selectedMaster.subject_category || undefined,
        startRange: rangeStart,
        endRange: rangeEnd,
        totalRange: totalRange,
        subjectType: null,
      };

      onSelect(newContent);
      setSelectedMaster(null);
    } catch (error) {
      console.error("[MasterContentSearchModal] 콘텐츠 추가 실패:", error);
      alert(error instanceof Error ? error.message : "콘텐츠 추가에 실패했습니다.");
    } finally {
      setIsAdding(false);
    }
  }, [selectedMaster, studentId, rangeStart, rangeEnd, onSelect]);

  // 직접 입력 콘텐츠 추가
  const handleDirectContentAdd = useCallback(() => {
    if (!directTitle.trim()) {
      alert("콘텐츠 제목을 입력해주세요.");
      return;
    }

    if (directTotalRange < 1) {
      alert("총 범위는 1 이상이어야 합니다.");
      return;
    }

    setIsAddingDirect(true);

    try {
      // 직접 입력 콘텐츠는 임시 ID 생성 (실제 저장은 플랜 생성 시점에)
      const tempId = `direct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newContent: SelectedContent = {
        contentId: tempId,
        contentType: directContentType,
        title: directTitle.trim(),
        subject: directSubject.trim() || undefined,
        startRange: directRangeStart,
        endRange: directRangeEnd,
        totalRange: directTotalRange,
        subjectType: null,
        isDirectInput: true, // 직접 입력 표시
      };

      onSelect(newContent);

      // 폼 초기화
      setDirectTitle("");
      setDirectSubject("");
      setDirectTotalRange(100);
      setDirectRangeStart(1);
      setDirectRangeEnd(100);
    } catch (error) {
      console.error("[MasterContentSearchModal] 직접 입력 추가 실패:", error);
      alert(error instanceof Error ? error.message : "콘텐츠 추가에 실패했습니다.");
    } finally {
      setIsAddingDirect(false);
    }
  }, [directTitle, directContentType, directSubject, directTotalRange, directRangeStart, directRangeEnd, onSelect]);

  // 검색 비활성화 조건
  const searchDisabled =
    !searchQuery.trim() &&
    !curriculumRevisionId &&
    !subjectGroupId &&
    !subjectId &&
    contentType === "all";

  // 필터링된 검색 결과 (이미 선택된 것 제외)
  const filteredResults = useMemo(() => {
    return searchResults.filter((r) => !existingContentIds.has(r.id));
  }, [searchResults, existingContentIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">콘텐츠 추가</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* 탭 전환 */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                activeTab === "search"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Package className="h-4 w-4" />
              마스터에서 검색
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                activeTab === "direct"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <PenLine className="h-4 w-4" />
              직접 입력
            </button>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 직접 입력 탭 */}
          {activeTab === "direct" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                마스터 콘텐츠에 없는 교재나 강의를 직접 입력하여 추가할 수 있습니다.
              </p>

              {/* 콘텐츠 타입 선택 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  콘텐츠 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectContentType("book");
                      setDirectTotalRange(100);
                      setDirectRangeEnd(100);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                      directContentType === "book"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <BookOpen className="h-4 w-4" />
                    교재
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectContentType("lecture");
                      setDirectTotalRange(30);
                      setDirectRangeEnd(30);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                      directContentType === "lecture"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <Video className="h-4 w-4" />
                    강의
                  </button>
                </div>
              </div>

              {/* 콘텐츠 제목 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  콘텐츠 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  placeholder={
                    directContentType === "book"
                      ? "예: 개념원리 수학 상"
                      : "예: 국어 문학 개념완성"
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* 과목 (선택) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  과목 <span className="text-xs text-gray-400">(선택)</span>
                </label>
                <input
                  type="text"
                  value={directSubject}
                  onChange={(e) => setDirectSubject(e.target.value)}
                  placeholder="예: 수학, 국어, 영어..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* 총 범위 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  총 범위 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={directTotalRange}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setDirectTotalRange(val);
                      setDirectRangeEnd(Math.min(directRangeEnd, val));
                    }}
                    min={1}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-sm text-gray-600">
                    {directContentType === "book" ? "페이지" : "강"}
                  </span>
                </div>
              </div>

              {/* 학습 범위 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  학습 범위
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={directRangeStart}
                    onChange={(e) =>
                      setDirectRangeStart(
                        Math.max(1, Math.min(directRangeEnd, parseInt(e.target.value) || 1))
                      )
                    }
                    min={1}
                    max={directRangeEnd}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="number"
                    value={directRangeEnd}
                    onChange={(e) =>
                      setDirectRangeEnd(
                        Math.min(
                          directTotalRange,
                          Math.max(directRangeStart, parseInt(e.target.value) || directRangeStart)
                        )
                      )
                    }
                    min={directRangeStart}
                    max={directTotalRange}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-sm text-gray-500">
                    / {directTotalRange}
                    {directContentType === "book" ? "페이지" : "강"}
                  </span>
                </div>
              </div>

              {/* 추가 버튼 */}
              <button
                type="button"
                onClick={handleDirectContentAdd}
                disabled={!directTitle.trim() || isAddingDirect}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isAddingDirect ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                콘텐츠 추가
              </button>
            </div>
          ) : selectedMaster ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  {selectedMaster.content_type === "book" ? (
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Video className="h-5 w-5 text-blue-600" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {selectedMaster.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {selectedMaster.content_type === "book" ? "교재" : "강의"}
                      {selectedMaster.subject && ` · ${selectedMaster.subject}`}
                      {selectedMaster.content_type === "book" &&
                        selectedMaster.total_pages &&
                        ` · ${selectedMaster.total_pages}페이지`}
                      {selectedMaster.content_type === "lecture" &&
                        selectedMaster.total_episodes &&
                        ` · ${selectedMaster.total_episodes}강`}
                    </p>
                  </div>
                </div>

                {/* 범위 설정 */}
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm text-gray-700">학습 범위:</label>
                  <input
                    type="number"
                    value={rangeStart}
                    onChange={(e) =>
                      setRangeStart(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    min={1}
                    max={rangeEnd}
                    className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="number"
                    value={rangeEnd}
                    onChange={(e) => {
                      const maxRange =
                        selectedMaster.content_type === "book"
                          ? selectedMaster.total_pages || 100
                          : selectedMaster.total_episodes || 10;
                      setRangeEnd(
                        Math.min(maxRange, parseInt(e.target.value) || maxRange)
                      );
                    }}
                    min={rangeStart}
                    max={
                      selectedMaster.content_type === "book"
                        ? selectedMaster.total_pages || 100
                        : selectedMaster.total_episodes || 10
                    }
                    className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-gray-500">
                    /{" "}
                    {selectedMaster.content_type === "book"
                      ? `${selectedMaster.total_pages || 100}페이지`
                      : `${selectedMaster.total_episodes || 10}강`}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMaster(null)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    다른 콘텐츠 선택
                  </button>
                  <button
                    type="button"
                    onClick={handleAddContent}
                    disabled={isAdding}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    추가하기
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 콘텐츠 타입 선택 */}
              <div className="flex gap-2">
                {(["all", "book", "lecture"] as ContentTypeFilter[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentType(type)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition",
                      contentType === type
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {type === "all" ? "전체" : type === "book" ? "교재" : "강의"}
                  </button>
                ))}
              </div>

              {/* 필터 */}
              <div className="grid grid-cols-3 gap-3">
                {/* 개정교육과정 */}
                <div>
                  <label className="mb-1 block text-xs text-gray-600">
                    개정교육과정
                  </label>
                  <div className="relative">
                    <select
                      value={curriculumRevisionId}
                      onChange={(e) => setCurriculumRevisionId(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm"
                    >
                      <option value="">전체</option>
                      {curriculumRevisions.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* 교과 */}
                <div>
                  <label className="mb-1 block text-xs text-gray-600">교과</label>
                  <div className="relative">
                    <select
                      value={subjectGroupId}
                      onChange={(e) => setSubjectGroupId(e.target.value)}
                      disabled={!curriculumRevisionId || loadingGroups}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingGroups ? "로딩 중..." : "전체"}
                      </option>
                      {subjectGroups.map((sg) => (
                        <option key={sg.id} value={sg.id}>
                          {sg.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* 과목 */}
                <div>
                  <label className="mb-1 block text-xs text-gray-600">과목</label>
                  <div className="relative">
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      disabled={!subjectGroupId || loadingSubjects}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingSubjects ? "로딩 중..." : "전체"}
                      </option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* 검색 입력 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !searchDisabled) {
                        handleSearch();
                      }
                    }}
                    placeholder="제목, 저자, ISBN 등으로 검색..."
                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchDisabled || isSearching}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  검색
                </button>
              </div>

              {/* 검색 결과 */}
              {hasSearched && (
                <div className="mt-4">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">검색 중...</span>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      {searchResults.length > 0
                        ? "모든 검색 결과가 이미 추가되었습니다."
                        : "검색 결과가 없습니다."}
                    </div>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {filteredResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleSelectMaster(result)}
                          className="flex w-full items-start gap-3 rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                        >
                          {result.content_type === "book" ? (
                            <BookOpen className="h-5 w-5 flex-shrink-0 text-gray-400" />
                          ) : (
                            <Video className="h-5 w-5 flex-shrink-0 text-gray-400" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900">
                              {result.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {result.content_type === "book" ? "교재" : "강의"}
                              {result.subject && ` · ${result.subject}`}
                              {result.content_type === "book" &&
                                result.total_pages &&
                                ` · ${result.total_pages}페이지`}
                              {result.content_type === "lecture" &&
                                result.total_episodes &&
                                ` · ${result.total_episodes}강`}
                            </p>
                          </div>
                          <Plus className="h-5 w-5 flex-shrink-0 text-blue-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
