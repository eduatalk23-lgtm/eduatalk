"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WizardData } from "./PlanGroupWizard";
import { PlanGroupError, toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";

type Step3ContentsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contents: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
  isCampMode?: boolean;
  editable?: boolean; // 편집 가능 여부 (기본값: true)
};

type ContentType = "book" | "lecture";

type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};

export function Step3Contents({
  data,
  onUpdate,
  contents,
  onSaveDraft,
  isSavingDraft = false,
  isCampMode = false,
  editable = true,
}: Step3ContentsProps) {
  const router = useRouter();
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );
  const [contentRanges, setContentRanges] = useState<
    Map<string, { start: string; end: string }>
  >(new Map());
  const [contentDetails, setContentDetails] = useState<
    Map<
      string,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());
  const [startDetailId, setStartDetailId] = useState<Map<string, string>>(
    new Map()
  ); // 시작 범위 선택
  const [endDetailId, setEndDetailId] = useState<Map<string, string>>(
    new Map()
  ); // 끝 범위 선택
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [contentMetadata, setContentMetadata] = useState<
    Map<
      string,
      {
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        publisher?: string | null;
        platform?: string | null;
      }
    >
  >(new Map());

  // 이미 조회한 콘텐츠 상세 정보를 캐시로 관리
  const cachedDetailsRef = useRef<
    Map<
      string,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());

  // 선택된 콘텐츠의 상세 정보 조회
  useEffect(() => {
    const fetchAllDetails = async () => {
      const newDetails = new Map<
        string,
        { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
      >();
      const newLoadingSet = new Set<string>();

      for (const contentId of selectedContentIds) {
        // 이미 조회한 경우 캐시에서 가져오기
        if (cachedDetailsRef.current.has(contentId)) {
          newDetails.set(contentId, cachedDetailsRef.current.get(contentId)!);
          continue;
        }

        // 콘텐츠 타입 확인
        const isBook = contents.books.some((b) => b.id === contentId);
        const contentType = isBook ? "book" : "lecture";

        newLoadingSet.add(contentId);
        setLoadingDetails(new Set(newLoadingSet));

        try {
          const response = await fetch(
            `/api/student-content-details?contentType=${contentType}&contentId=${contentId}&includeMetadata=true`
          );
          if (response.ok) {
            const result = await response.json();
            const detailData =
              contentType === "book"
                ? { details: result.details || [], type: "book" as const }
                : { details: result.episodes || [], type: "lecture" as const };

            // 캐시에 저장
            cachedDetailsRef.current.set(contentId, detailData);
            newDetails.set(contentId, detailData);

            // 메타데이터 저장
            if (result.metadata) {
              setContentMetadata((prev) => {
                const newMap = new Map(prev);
                newMap.set(contentId, result.metadata);
                return newMap;
              });
            }
          }
        } catch (error) {
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
            { contentId, contentType }
          );
          console.error(`[Step3Contents] 콘텐츠 ${contentId} 상세 정보 조회 실패:`, planGroupError);
          // 에러가 발생해도 다른 콘텐츠 조회는 계속 진행
        } finally {
          newLoadingSet.delete(contentId);
          setLoadingDetails(new Set(newLoadingSet));
        }
      }

      setContentDetails(newDetails);
    };

    if (selectedContentIds.size > 0) {
      fetchAllDetails();
    } else {
      setContentDetails(new Map());
      setStartDetailId(new Map());
      setEndDetailId(new Map());
      setContentRanges(new Map());
    }
  }, [selectedContentIds, contents.books, contents.lectures]);

  // 시작/끝 범위 선택 시 범위 자동 계산 및 범위 내 상세정보 포함
  useEffect(() => {
    setContentRanges((prevRanges) => {
      const newRanges = new Map(prevRanges);

      for (const contentId of selectedContentIds) {
        const contentInfo = contentDetails.get(contentId);
        if (!contentInfo) continue;

        const startId = startDetailId.get(contentId);
        const endId = endDetailId.get(contentId);

        if (!startId || !endId) {
          // 시작 또는 끝이 선택되지 않았으면 범위 계산 안 함
          continue;
        }

        if (contentInfo.type === "book") {
          const details = contentInfo.details as BookDetail[];
          const startDetail = details.find((d) => d.id === startId);
          const endDetail = details.find((d) => d.id === endId);

          if (startDetail && endDetail) {
            const startPage = startDetail.page_number;
            const endPage = endDetail.page_number;

            // 시작이 끝보다 크면 교환
            if (startPage > endPage) {
              newRanges.set(contentId, {
                start: String(endPage),
                end: String(startPage),
              });
            } else {
              newRanges.set(contentId, {
                start: String(startPage),
                end: String(endPage),
              });
            }
          }
        } else {
          const episodes = contentInfo.details as LectureEpisode[];
          const startEpisode = episodes.find((e) => e.id === startId);
          const endEpisode = episodes.find((e) => e.id === endId);

          if (startEpisode && endEpisode) {
            const startNum = startEpisode.episode_number;
            const endNum = endEpisode.episode_number;

            // 시작이 끝보다 크면 교환
            if (startNum > endNum) {
              newRanges.set(contentId, {
                start: String(endNum),
                end: String(startNum),
              });
            } else {
              newRanges.set(contentId, {
                start: String(startNum),
                end: String(endNum),
              });
            }
          }
        }
      }

      return newRanges;
    });
  }, [startDetailId, endDetailId, contentDetails, selectedContentIds]);

  const toggleContentSelection = (
    contentId: string,
    contentType: "book" | "lecture"
  ) => {
    const newSet = new Set(selectedContentIds);
    if (newSet.has(contentId)) {
      newSet.delete(contentId);
      // 관련 데이터 정리
      const newStartIds = new Map(startDetailId);
      newStartIds.delete(contentId);
      setStartDetailId(newStartIds);
      const newEndIds = new Map(endDetailId);
      newEndIds.delete(contentId);
      setEndDetailId(newEndIds);
      const newRanges = new Map(contentRanges);
      newRanges.delete(contentId);
      setContentRanges(newRanges);
    } else {
      // 최대 9개 제한 (캠프 모드일 때는 추천 콘텐츠 제외)
      const totalContents = isCampMode
        ? data.student_contents.length
        : data.student_contents.length + data.recommended_contents.length;
      if (totalContents + newSet.size >= 9) {
        alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
        return;
      }
      newSet.add(contentId);
    }
    setSelectedContentIds(newSet);
  };

  const setStartRange = (contentId: string, detailId: string) => {
    const newMap = new Map(startDetailId);
    newMap.set(contentId, detailId);
    setStartDetailId(newMap);
  };

  const setEndRange = (contentId: string, detailId: string) => {
    const newMap = new Map(endDetailId);
    newMap.set(contentId, detailId);
    setEndDetailId(newMap);
  };

  const updateContentRange = (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => {
    const newRanges = new Map(contentRanges);
    const current = newRanges.get(contentId) || { start: "", end: "" };
    newRanges.set(contentId, { ...current, [field]: value });
    setContentRanges(newRanges);
  };

  const addSelectedContents = async () => {
    const contentsToAdd: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      start_range: number;
      end_range: number;
      title?: string; // 제목 정보 저장
      subject_category?: string; // 과목 카테고리 저장 (필수 과목 검증용)
    }> = [];

    for (const contentId of selectedContentIds) {
      const range = contentRanges.get(contentId);
      if (!range || !range.start || !range.end) {
        alert("모든 선택된 콘텐츠의 학습 범위를 입력해주세요.");
        return;
      }

      const start = Number(range.start);
      const end = Number(range.end);

      if (isNaN(start) || isNaN(end) || start > end) {
        alert("올바른 범위를 입력해주세요. (시작 ≤ 종료)");
        return;
      }

      // 콘텐츠 타입 확인
      const isBook = contents.books.some((b) => b.id === contentId);
      const contentType = isBook ? "book" : "lecture";

      // 중복 체크 (학생 콘텐츠와 추천 콘텐츠 모두 확인)
      if (
        data.student_contents.some(
          (c) => c.content_type === contentType && c.content_id === contentId
        ) ||
        data.recommended_contents.some(
          (c) => c.content_type === contentType && c.content_id === contentId
        )
      ) {
        continue; // 이미 추가된 콘텐츠는 스킵
      }

      // 콘텐츠 정보 조회 (제목 및 과목 카테고리)
      const content = isBook
        ? contents.books.find((b) => b.id === contentId)
        : contents.lectures.find((l) => l.id === contentId);

      // subject_category 조회 (서버 액션 사용)
      let subjectCategory: string | undefined = undefined;
      try {
        const result = await fetchContentMetadataAction(contentId, contentType);
        if (result.success && result.data) {
          subjectCategory = result.data.subject_category || undefined;
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_FETCH_FAILED,
          { contentId, contentType }
        );
        console.error("[Step3Contents] 콘텐츠 메타데이터 조회 실패:", planGroupError);
        // 에러 시 subtitle 사용 (fallback)
        subjectCategory = content?.subtitle || undefined;
      }

      contentsToAdd.push({
        content_type: contentType,
        content_id: contentId,
        start_range: start,
        end_range: end,
        title: content?.title, // 제목 정보 저장
        subject_category: subjectCategory, // API를 통해 조회한 subject_category
      });
    }

    if (contentsToAdd.length === 0) {
      alert("추가할 콘텐츠를 선택해주세요.");
      return;
    }

    // 최대 9개 제한 (캠프 모드일 때는 추천 콘텐츠 제외)
    const totalContents = isCampMode
      ? data.student_contents.length
      : data.student_contents.length + data.recommended_contents.length;
    if (totalContents + contentsToAdd.length > 9) {
      alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
      return;
    }

    onUpdate({
      student_contents: [...data.student_contents, ...contentsToAdd],
    });

    // 선택 초기화
    setSelectedContentIds(new Set());
    setStartDetailId(new Map());
    setEndDetailId(new Map());
    setContentRanges(new Map());
  };

  const removeContent = (index: number) => {
    onUpdate({
      student_contents: data.student_contents.filter((_, i) => i !== index),
    });
  };

  const getContentTitle = (
    contentType: "book" | "lecture",
    contentId: string
  ): string => {
    // 1. 먼저 저장된 student_contents에서 title 확인
    const savedContent = data.student_contents.find(
      (c) => c.content_id === contentId
    );
    if (savedContent && (savedContent as any).title) {
      return (savedContent as any).title;
    }

    // 2. contents.books 또는 contents.lectures에서 찾기
    if (contentType === "book") {
      const content = contents.books.find((c) => c.id === contentId);
      return content?.title || "알 수 없음";
    } else {
      const content = contents.lectures.find((c) => c.id === contentId);
      return content?.title || "알 수 없음";
    }
  };

  const getContentSubtitle = (
    contentType: "book" | "lecture",
    contentId: string
  ): string | null => {
    // 1. 먼저 저장된 student_contents에서 subtitle 확인
    const savedContent = data.student_contents.find(
      (c) => c.content_id === contentId
    );
    if (savedContent && (savedContent as any).subject_category) {
      return (savedContent as any).subject_category;
    }

    // 2. contents.books 또는 contents.lectures에서 찾기
    if (contentType === "book") {
      const content = contents.books.find((c) => c.id === contentId);
      return content?.subtitle || null;
    } else {
      const content = contents.lectures.find((c) => c.id === contentId);
      return content?.subtitle || null;
    }
  };

  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  // 캠프 모드일 때는 추천 콘텐츠를 제외하고 계산
  const totalCount = isCampMode ? studentCount : studentCount + recommendedCount;
  const canAddMore = totalCount < 9;
  const remainingSlots = 9 - totalCount;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              학습 대상 콘텐츠
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              플랜에 포함할 교재와 강의를 선택하고 학습 범위를 지정해주세요.
              (최대 9개)
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalCount}/9
            </div>
            <div className="text-xs text-gray-500">
              학생 {studentCount}개
              {!isCampMode && recommendedCount > 0 && ` / 추천 ${recommendedCount}개`}
            </div>
          </div>
        </div>
        {/* 진행 바 */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(totalCount / 9) * 100}%` }}
            />
          </div>
        </div>
        {!canAddMore && !isCampMode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              ⚠️ 최대 9개의 콘텐츠를 모두 선택하셨습니다. 추천 콘텐츠는 받을 수
              없습니다.
            </p>
          </div>
        )}
        {!canAddMore && isCampMode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              ⚠️ 최대 9개의 콘텐츠를 모두 선택하셨습니다.
            </p>
          </div>
        )}
        {canAddMore && totalCount > 0 && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              💡 {remainingSlots}개의 콘텐츠를 더 선택할 수 있습니다.{" "}
              {!isCampMode && studentCount < 9 &&
                "다음 단계에서 추천 콘텐츠를 받을 수 있습니다."}
              {isCampMode &&
                "제출 후 관리자가 전략과목/취약과목을 설정하고 플랜을 생성합니다."}
            </p>
          </div>
        )}
      </div>

      {/* 교재 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            📚 등록된 교재
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            학습 중인 교재를 추가하고 싶다면{" "}
            <Link
              href="/contents"
              className="font-medium text-indigo-600 hover:text-indigo-800 underline"
              onClick={async (e) => {
                if (onSaveDraft) {
                  e.preventDefault();
                  await onSaveDraft();
                  router.push("/contents");
                }
              }}
            >
              콘텐츠 메뉴
            </Link>
            에서 추가해주세요.
          </p>
        </div>
        {contents.books.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">등록된 교재가 없습니다.</p>
            <p className="mt-2 text-xs text-gray-400">
              학습 중인 교재를 추가하고 싶다면{" "}
              <Link
                href="/contents"
                className="font-medium text-indigo-600 hover:text-indigo-800 underline"
                onClick={async (e) => {
                  if (onSaveDraft) {
                    e.preventDefault();
                    await onSaveDraft();
                    router.push("/contents");
                  }
                }}
              >
                콘텐츠 메뉴
              </Link>
              에서 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contents.books.map((book) => {
              const isSelected = selectedContentIds.has(book.id);
              const contentInfo = contentDetails.get(book.id);
              const range = contentRanges.get(book.id);
              const isLoading = loadingDetails.has(book.id);
              const selectedStartId = startDetailId.get(book.id);
              const selectedEndId = endDetailId.get(book.id);

              const metadata = contentMetadata.get(book.id);

              return (
                <label
                  key={book.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleContentSelection(book.id, "book")}
                    disabled={!editable}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {book.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                            📚 교재
                          </span>
                          {book.master_content_id && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              📦 마스터에서 가져옴
                            </span>
                          )}
                          {metadata?.subject && (
                            <>
                              <span>·</span>
                              <span>{metadata.subject}</span>
                            </>
                          )}
                          {metadata?.semester && (
                            <>
                              <span>·</span>
                              <span>{metadata.semester}</span>
                            </>
                          )}
                          {metadata?.revision && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-indigo-600">
                                {metadata.revision} 개정판
                              </span>
                            </>
                          )}
                          {metadata?.difficulty_level && (
                            <>
                              <span>·</span>
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                                {metadata.difficulty_level}
                              </span>
                            </>
                          )}
                          {metadata?.publisher && (
                            <>
                              <span>·</span>
                              <span>{metadata.publisher}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                      {/* 선택된 경우 상세 정보 표시 */}
                      {isSelected && (
                        <div className="mt-3 space-y-3">
                          {isLoading ? (
                            <div className="text-xs text-gray-500">
                              상세 정보를 불러오는 중...
                            </div>
                          ) : contentInfo && contentInfo.details.length > 0 ? (
                            <>
                              <div className="space-y-3">
                                {/* 시작 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">
                                    시작 범위 선택
                                  </div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {(
                                        contentInfo.details as BookDetail[]
                                      ).map((detail) => {
                                        const isSelected =
                                          selectedStartId === detail.id;
                                        return (
                                          <label
                                            key={detail.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`start-${book.id}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                setStartRange(
                                                  book.id,
                                                  detail.id
                                                )
                                              }
                                              disabled={!editable}
                                              className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                페이지 {detail.page_number}
                                              </span>
                                              {detail.major_unit && (
                                                <span className="ml-2 text-gray-500">
                                                  · {detail.major_unit}
                                                  {detail.minor_unit &&
                                                    ` - ${detail.minor_unit}`}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* 끝 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">
                                    끝 범위 선택
                                  </div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {(
                                        contentInfo.details as BookDetail[]
                                      ).map((detail) => {
                                        const isSelected =
                                          selectedEndId === detail.id;
                                        return (
                                          <label
                                            key={detail.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`end-${book.id}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                setEndRange(book.id, detail.id)
                                              }
                                              disabled={!editable}
                                              className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                페이지 {detail.page_number}
                                              </span>
                                              {detail.major_unit && (
                                                <span className="ml-2 text-gray-500">
                                                  · {detail.major_unit}
                                                  {detail.minor_unit &&
                                                    ` - ${detail.minor_unit}`}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {range && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                  <div className="text-xs font-medium text-gray-700">
                                    선택된 범위: {range.start} ~ {range.end}{" "}
                                    페이지
                                  </div>
                                  {(() => {
                                    // 범위에 해당하는 모든 상세정보 가져오기
                                    const details =
                                      contentInfo.details as BookDetail[];
                                    const startPage = Number(range.start);
                                    const endPage = Number(range.end);
                                    const rangeDetails = details.filter(
                                      (d) =>
                                        d.page_number >= startPage &&
                                        d.page_number <= endPage
                                    );
                                    if (rangeDetails.length > 0) {
                                      return (
                                        <div className="mt-2 text-xs text-gray-600">
                                          <div className="font-medium">
                                            포함된 단원:
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            {rangeDetails.map((d, idx) => (
                                              <div key={idx}>
                                                페이지 {d.page_number}
                                                {d.major_unit && (
                                                  <span className="text-gray-500">
                                                    {" "}
                                                    · {d.major_unit}
                                                    {d.minor_unit &&
                                                      ` - ${d.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  시작 페이지
                                </label>
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="예: 1"
                                  min={0}
                                  value={range?.start || ""}
                                  onChange={(e) =>
                                    updateContentRange(
                                      book.id,
                                      "start",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  종료 페이지
                                </label>
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="예: 150"
                                  min={0}
                                  value={range?.end || ""}
                                  onChange={(e) =>
                                    updateContentRange(
                                      book.id,
                                      "end",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
              );
            })}
          </div>
        )}
      </div>

      {/* 강의 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            🎧 등록된 강의
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            학습 중인 강의를 추가하고 싶다면{" "}
            <Link
              href="/contents"
              className="font-medium text-indigo-600 hover:text-indigo-800 underline"
              onClick={async (e) => {
                if (onSaveDraft) {
                  e.preventDefault();
                  await onSaveDraft();
                  router.push("/contents");
                }
              }}
            >
              콘텐츠 메뉴
            </Link>
            에서 추가해주세요.
          </p>
        </div>
        {contents.lectures.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">등록된 강의가 없습니다.</p>
            <p className="mt-2 text-xs text-gray-400">
              학습 중인 강의를 추가하고 싶다면{" "}
              <Link
                href="/contents"
                className="font-medium text-indigo-600 hover:text-indigo-800 underline"
                onClick={async (e) => {
                  if (onSaveDraft) {
                    e.preventDefault();
                    await onSaveDraft();
                    router.push("/contents");
                  }
                }}
              >
                콘텐츠 메뉴
              </Link>
              에서 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contents.lectures.map((lecture) => {
              const isSelected = selectedContentIds.has(lecture.id);
              const contentInfo = contentDetails.get(lecture.id);
              const range = contentRanges.get(lecture.id);
              const isLoading = loadingDetails.has(lecture.id);
              const selectedStartId = startDetailId.get(lecture.id);
              const selectedEndId = endDetailId.get(lecture.id);
              const metadata = contentMetadata.get(lecture.id);

              return (
                <label
                  key={lecture.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      toggleContentSelection(lecture.id, "lecture")
                    }
                    disabled={!editable}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {lecture.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                            🎧 강의
                          </span>
                          {lecture.master_content_id && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              📦 마스터에서 가져옴
                            </span>
                          )}
                          {metadata?.subject && (
                            <>
                              <span>·</span>
                              <span>{metadata.subject}</span>
                            </>
                          )}
                          {metadata?.semester && (
                            <>
                              <span>·</span>
                              <span>{metadata.semester}</span>
                            </>
                          )}
                          {metadata?.revision && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-indigo-600">
                                {metadata.revision} 개정판
                              </span>
                            </>
                          )}
                          {metadata?.difficulty_level && (
                            <>
                              <span>·</span>
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                                {metadata.difficulty_level}
                              </span>
                            </>
                          )}
                          {metadata?.platform && (
                            <>
                              <span>·</span>
                              <span>{metadata.platform}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                      {/* 선택된 경우 상세 정보 표시 */}
                      {isSelected && (
                        <div className="mt-3 space-y-3">
                          {isLoading ? (
                            <div className="text-xs text-gray-500">
                              상세 정보를 불러오는 중...
                            </div>
                          ) : contentInfo && contentInfo.details.length > 0 ? (
                            <>
                              <div className="space-y-3">
                                {/* 시작 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">
                                    시작 범위 선택
                                  </div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {(
                                        contentInfo.details as LectureEpisode[]
                                      ).map((episode) => {
                                        const isSelected =
                                          selectedStartId === episode.id;
                                        return (
                                          <label
                                            key={episode.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`start-${lecture.id}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                setStartRange(
                                                  lecture.id,
                                                  episode.id
                                                )
                                              }
                                              disabled={!editable}
                                              className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                {episode.episode_number}회차
                                              </span>
                                              {episode.episode_title && (
                                                <span className="ml-2 text-gray-500">
                                                  · {episode.episode_title}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* 끝 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">
                                    끝 범위 선택
                                  </div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {(
                                        contentInfo.details as LectureEpisode[]
                                      ).map((episode) => {
                                        const isSelected =
                                          selectedEndId === episode.id;
                                        return (
                                          <label
                                            key={episode.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                              isSelected
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`end-${lecture.id}`}
                                              disabled={!editable}
                                              checked={isSelected}
                                              onChange={() =>
                                                setEndRange(
                                                  lecture.id,
                                                  episode.id
                                                )
                                              }
                                              className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1 text-xs">
                                              <span className="font-medium">
                                                {episode.episode_number}회차
                                              </span>
                                              {episode.episode_title && (
                                                <span className="ml-2 text-gray-500">
                                                  · {episode.episode_title}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {range && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                  <div className="text-xs font-medium text-gray-700">
                                    선택된 범위: {range.start} ~ {range.end}{" "}
                                    회차
                                  </div>
                                  {(() => {
                                    // 범위에 해당하는 모든 상세정보 가져오기
                                    const episodes =
                                      contentInfo.details as LectureEpisode[];
                                    const startNum = Number(range.start);
                                    const endNum = Number(range.end);
                                    const rangeEpisodes = episodes.filter(
                                      (e) =>
                                        e.episode_number >= startNum &&
                                        e.episode_number <= endNum
                                    );
                                    if (rangeEpisodes.length > 0) {
                                      return (
                                        <div className="mt-2 text-xs text-gray-600">
                                          <div className="font-medium">
                                            포함된 회차:
                                          </div>
                                          <div className="mt-1 space-y-0.5">
                                            {rangeEpisodes.map((e, idx) => (
                                              <div key={idx}>
                                                {e.episode_number}회차
                                                {e.episode_title && (
                                                  <span className="text-gray-500">
                                                    {" "}
                                                    · {e.episode_title}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  시작 회차
                                </label>
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="예: 1"
                                  min={0}
                                  value={range?.start || ""}
                                  onChange={(e) =>
                                    updateContentRange(
                                      lecture.id,
                                      "start",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  종료 회차
                                </label>
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="예: 10"
                                  min={0}
                                  value={range?.end || ""}
                                  onChange={(e) =>
                                    updateContentRange(
                                      lecture.id,
                                      "end",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
              );
            })}
          </div>
        )}
      </div>

      {/* 선택된 콘텐츠 추가 버튼 */}
      {selectedContentIds.size > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              선택된 콘텐츠: {selectedContentIds.size}개
            </span>
            {!canAddMore && !isCampMode && (
              <span className="text-xs text-amber-600 font-medium">
                ⚠️ 추천 콘텐츠 불가
              </span>
            )}
          </div>
          {Array.from(selectedContentIds).map((id) => {
            const range = contentRanges.get(id);
            const hasRange =
              range &&
              range.start &&
              range.end &&
              range.start.trim() !== "" &&
              range.end.trim() !== "";
            if (!hasRange) {
              const isBook = contents.books.some((b) => b.id === id);
              return (
                <div
                  key={id}
                  className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800"
                >
                  {isBook ? "📚" : "🎧"}{" "}
                  {getContentTitle(isBook ? "book" : "lecture", id)}: 학습
                  범위를 입력해주세요
                </div>
              );
            }
            return null;
          })}
          <button
            type="button"
            onClick={addSelectedContents}
            disabled={
              !editable ||
              Array.from(selectedContentIds).some((id) => {
                const range = contentRanges.get(id);
                return (
                  !range ||
                  !range.start ||
                  !range.end ||
                  range.start.trim() === "" ||
                  range.end.trim() === ""
                );
              }) ||
              (isCampMode
                ? data.student_contents.length + selectedContentIds.size > 9
                : data.student_contents.length +
                    data.recommended_contents.length +
                    selectedContentIds.size >
                  9)
            }
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            선택한 콘텐츠 추가하기 (
            {data.student_contents.length +
              data.recommended_contents.length +
              selectedContentIds.size}
            /9)
          </button>
        </div>
      )}

      {/* 추가된 학생 콘텐츠 목록 */}
      {data.student_contents.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>추가된 학생 콘텐츠 ({data.student_contents.length}개)</span>
          </div>
          {data.student_contents.map((content, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {getContentTitle(content.content_type, content.content_id)}
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    학생 콘텐츠
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>
                    {content.content_type === "book" && "📚 책"}
                    {content.content_type === "lecture" && "🎧 강의"}
                  </span>
                  {(() => {
                    const contentType = content.content_type;
                    const contentId = content.content_id;
                    const foundContent = contentType === "book"
                      ? contents.books.find((b) => b.id === contentId)
                      : contents.lectures.find((l) => l.id === contentId);
                    return foundContent?.master_content_id ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        📦 마스터에서 가져옴
                      </span>
                    ) : null;
                  })()}
                  {getContentSubtitle(
                    content.content_type,
                    content.content_id
                  ) && (
                    <>
                      <span>·</span>
                      <span>
                        {getContentSubtitle(
                          content.content_type,
                          content.content_id
                        )}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {content.start_range} ~ {content.end_range}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeContent(index)}
                disabled={!editable}
                className={`ml-4 text-sm ${
                  !editable
                    ? "cursor-not-allowed text-gray-400"
                    : "text-red-600 hover:text-red-800"
                }`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">추가된 콘텐츠가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">
            위 폼에서 콘텐츠를 선택하고 범위를 입력한 후 추가해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
