import { useState, useEffect, useRef, useMemo } from "react";
import { BookDetail, LectureEpisode, ContentDetailData, ContentMetadata } from "../types";

type UseBatchContentDetailsProps = {
  selectedContentIds: Set<string>;
  contents: {
    books: Array<{ id: string }>;
    lectures: Array<{ id: string }>;
  };
};

export function useBatchContentDetails({
  selectedContentIds,
  contents,
}: UseBatchContentDetailsProps) {
  const [contentDetails, setContentDetails] = useState<Map<string, ContentDetailData>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [contentMetadata, setContentMetadata] = useState<Map<string, ContentMetadata>>(new Map());

  // 이미 조회한 콘텐츠 상세 정보를 캐시로 관리
  const cachedDetailsRef = useRef<Map<string, ContentDetailData>>(new Map());

  // 콘텐츠 타입 확인 최적화: O(n×m) → O(n)으로 개선
  const bookIdSet = useMemo(
    () => new Set(contents.books.map((b) => b.id)),
    [contents.books]
  );
  // lectureIdSet is not strictly needed if we assume everything not in bookIdSet is a lecture,
  // but good for safety.
  const lectureIdSet = useMemo(
    () => new Set(contents.lectures.map((l) => l.id)),
    [contents.lectures]
  );

  useEffect(() => {
    const fetchAllDetails = async () => {
      const newDetails = new Map<string, ContentDetailData>();

      // 1. 캐시된 콘텐츠 먼저 처리
      const contentIdsToFetch: string[] = [];
      for (const contentId of selectedContentIds) {
        if (cachedDetailsRef.current.has(contentId)) {
          newDetails.set(contentId, cachedDetailsRef.current.get(contentId)!);
        } else {
          contentIdsToFetch.push(contentId);
        }
      }

      // 캐시된 데이터가 있으면 먼저 업데이트
      if (newDetails.size > 0) {
        setContentDetails(new Map(newDetails));
      }

      // 2. 나머지 콘텐츠들을 배치 API로 조회
      if (contentIdsToFetch.length === 0) {
        return;
      }

      // 모든 콘텐츠를 로딩 상태로 설정
      const initialLoadingSet = new Set(contentIdsToFetch);
      setLoadingDetails(new Set(initialLoadingSet));

      const performanceStart = performance.now();
      try {
        const typeCheckStart = performance.now();

        // 콘텐츠 타입 정보 수집
        const contentsToFetch = contentIdsToFetch.map((contentId) => {
          const isBook = bookIdSet.has(contentId);
          return {
            contentId,
            contentType: isBook ? ("book" as const) : ("lecture" as const),
          };
        });

        const typeCheckTime = performance.now() - typeCheckStart;
        const networkStart = performance.now();

        // 배치 API 호출
        const response = await fetch("/api/student-content-details/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: contentsToFetch,
            includeMetadata: false,
          }),
        });

        const networkTime = performance.now() - networkStart;
        const parseStart = performance.now();

        if (response.ok) {
          const result = await response.json();
          const parseTime = performance.now() - parseStart;
          const processStart = performance.now();
          const batchData = result.data;

          // 배치 응답 결과 처리
          contentIdsToFetch.forEach((contentId) => {
            const contentType = contentsToFetch.find(
              (c) => c.contentId === contentId
            )?.contentType;
            const contentData = batchData[contentId];

            if (contentData) {
              const detailData: ContentDetailData =
                contentType === "book"
                  ? {
                      details: (contentData.details || []) as BookDetail[],
                      type: "book",
                    }
                  : {
                      details: (contentData.episodes || []) as LectureEpisode[],
                      type: "lecture",
                    };

              if (process.env.NODE_ENV === "development" && detailData.details.length === 0) {
                 console.debug("[useBatchContentDetails] 배치 API 응답: 상세정보 없음", {
                   contentId, contentType
                 })
              }

              // 캐시에 저장
              cachedDetailsRef.current.set(contentId, detailData);
              newDetails.set(contentId, detailData);

              // 메타데이터 저장
              if (contentData.metadata) {
                setContentMetadata((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(contentId, contentData.metadata);
                  return newMap;
                });
              }
            }
          });

          const processTime = performance.now() - processStart;
          const totalTime = performance.now() - performanceStart;

          if (process.env.NODE_ENV === "development") {
            console.log("[useBatchContentDetails] 배치 API 성능:", {
                totalTime: `${totalTime.toFixed(2)}ms`,
                count: contentsToFetch.length
            });
          }
        } else {
            // Fallback to individual fetch if batch fails
            console.warn("[useBatchContentDetails] Batch API failed, falling back");
            
            const fetchPromises = contentIdsToFetch.map(async (contentId) => {
                const contentType = contentsToFetch.find((c) => c.contentId === contentId)?.contentType || "book";
                try {
                    const res = await fetch(`/api/student-content-details?contentType=${contentType}&contentId=${contentId}&includeMetadata=false`);
                    if (res.ok) {
                        const r = await res.json();
                        const d: ContentDetailData = contentType === "book" 
                            ? { details: r.details || [], type: "book" }
                            : { details: r.episodes || [], type: "lecture" };
                        
                        cachedDetailsRef.current.set(contentId, d);
                        if (r.metadata) {
                            setContentMetadata(prev => new Map(prev).set(contentId, r.metadata));
                        }
                        return { contentId, data: d };
                    }
                } catch (e) {
                    console.error(e);
                }
                return null;
            });

            const results = await Promise.all(fetchPromises);
            results.forEach(r => {
                if (r) newDetails.set(r.contentId, r.data);
            });
        }
      } catch (error) {
        console.error("[useBatchContentDetails] Error:", error);
      } finally {
        setLoadingDetails(new Set());
      }

      setContentDetails(new Map(newDetails));
    };

    if (selectedContentIds.size > 0) {
      fetchAllDetails();
    } else {
      setContentDetails(new Map());
    }
  }, [selectedContentIds, bookIdSet, lectureIdSet]);

  return { contentDetails, loadingDetails, contentMetadata };
}
