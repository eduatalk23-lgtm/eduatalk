"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { WizardData } from "./PlanGroupWizard";
import { PlanGroupError, toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction, fetchContentMetadataBatchAction } from "@/app/(student)/actions/fetchContentMetadata";

type Step6FinalReviewProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  isCampMode?: boolean;
};

type ContentInfo = {
  content_type: "book" | "lecture";
  content_id: string;
  title: string;
  subject_category?: string;
  start_range: number;
  end_range: number;
  isRecommended: boolean;
  // 자동 추천 관련 필드
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: {
    scoreDetails?: {
      schoolGrade?: number | null;
      schoolAverageGrade?: number | null;
      mockPercentile?: number | null;
      mockGrade?: number | null;
      riskScore?: number;
    };
    priority?: number;
  } | null;
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

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

export function Step6FinalReview({ data, onUpdate, contents, isCampMode = false }: Step6FinalReviewProps) {
  const [contentInfos, setContentInfos] = useState<ContentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRangeIndex, setEditingRangeIndex] = useState<{
    type: "student" | "recommended";
    index: number;
  } | null>(null);
  const [editingRange, setEditingRange] = useState<{ start: string; end: string } | null>(null);
  
  // 상세정보 관련 상태
  const [contentDetails, setContentDetails] = useState<Map<string, { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }>>(new Map());
  const [startDetailId, setStartDetailId] = useState<Map<string, string>>(new Map()); // 시작 범위 선택
  const [endDetailId, setEndDetailId] = useState<Map<string, string>>(new Map()); // 끝 범위 선택
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const cachedDetailsRef = useRef<Map<string, { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }>>(new Map());
  
  // 콘텐츠 총량 (추천 범위 계산용)
  const [contentTotals, setContentTotals] = useState<Map<string, number>>(new Map());
  const [loadingContentTotals, setLoadingContentTotals] = useState(false);
  
  // 초기 범위 저장 (Step 6 진입 시점의 범위)
  const [initialRanges, setInitialRanges] = useState<Map<string, { start: number; end: number }>>(new Map());

  // 콘텐츠 정보 조회 및 통합
  useEffect(() => {
    const fetchContentInfos = async () => {
      setLoading(true);
      const infos: ContentInfo[] = [];

      // 학생 콘텐츠
      for (const content of data.student_contents) {
        let title = (content as any).title;
        let subjectCategory = (content as any).subject_category;

        // 저장된 정보가 없으면 서버 액션으로 조회
        let metadata: any = null;
        if (!title || !subjectCategory) {
          try {
            const result = await fetchContentMetadataAction(
              content.content_id,
              content.content_type
            );
            if (result.success && result.data) {
              title = title || result.data.title || "알 수 없음";
              subjectCategory = subjectCategory || result.data.subject_category;
              metadata = result.data;
            }
          } catch (error) {
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.CONTENT_FETCH_FAILED
            );
            console.error("[Step6FinalReview] 학생 콘텐츠 메타데이터 조회 실패:", planGroupError);
          }
        }

        // 메타데이터가 없으면 상세 정보 API에서 조회
        if (!metadata && content.content_type !== "custom") {
          try {
            const response = await fetch(
              `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}&includeMetadata=true`
            );
            if (response.ok) {
              const result = await response.json();
              metadata = result.metadata;
            }
          } catch (error) {
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
            );
            console.error("[Step6FinalReview] 학생 콘텐츠 메타데이터 조회 실패:", planGroupError);
          }
        }

        // 여전히 없으면 contents에서 찾기
        if (!title && contents) {
          if (content.content_type === "book") {
            const book = contents.books.find((b) => b.id === content.content_id);
            title = book?.title || "알 수 없음";
            subjectCategory = subjectCategory || book?.subtitle || undefined;
          } else if (content.content_type === "lecture") {
            const lecture = contents.lectures.find((l) => l.id === content.content_id);
            title = lecture?.title || "알 수 없음";
            subjectCategory = subjectCategory || lecture?.subtitle || undefined;
          }
        }

        infos.push({
          content_type: content.content_type,
          content_id: content.content_id,
          title: title || "알 수 없음",
          subject_category: subjectCategory,
          start_range: content.start_range,
          end_range: content.end_range,
          isRecommended: false,
          subject: metadata?.subject || null,
          semester: metadata?.semester || null,
          revision: metadata?.revision || null,
          difficulty_level: metadata?.difficulty_level || null,
          publisher: metadata?.publisher || null,
          platform: metadata?.platform || null,
        });
      }

      // 추천 콘텐츠
      for (const content of data.recommended_contents) {
        let title = (content as any).title;
        let subjectCategory = (content as any).subject_category;

        // 저장된 정보가 없으면 서버 액션으로 조회 (마스터 콘텐츠)
        let metadata: any = null;
        if (!title || !subjectCategory) {
          try {
            const result = await fetchContentMetadataAction(
              content.content_id,
              content.content_type
            );
            if (result.success && result.data) {
              title = title || result.data.title || "알 수 없음";
              subjectCategory = subjectCategory || result.data.subject_category;
              metadata = result.data;
            }
          } catch (error) {
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
            );
            console.error("[Step6FinalReview] 마스터 콘텐츠 메타데이터 조회 실패:", planGroupError);
          }
        }

        // 메타데이터가 없으면 상세 정보 API에서 조회
        if (!metadata) {
          try {
            const response = await fetch(
              `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}&includeMetadata=true`
            );
            if (response.ok) {
              const result = await response.json();
              metadata = result.metadata;
            }
          } catch (error) {
            const planGroupError = toPlanGroupError(
              error,
              PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
            );
            console.error("[Step6FinalReview] 마스터 콘텐츠 메타데이터 조회 실패:", planGroupError);
          }
        }

        infos.push({
          content_type: content.content_type,
          content_id: content.content_id,
          title: title || "알 수 없음",
          subject_category: subjectCategory,
          start_range: content.start_range,
          end_range: content.end_range,
          isRecommended: true,
          // 자동 추천 정보 (content에 포함된 경우)
          is_auto_recommended: (content as any).is_auto_recommended ?? false,
          recommendation_source: (content as any).recommendation_source ?? null,
          recommendation_reason: (content as any).recommendation_reason ?? null,
          recommendation_metadata: (content as any).recommendation_metadata ?? null,
          subject: metadata?.subject || null,
          semester: metadata?.semester || null,
          revision: metadata?.revision || null,
          difficulty_level: metadata?.difficulty_level || null,
          publisher: metadata?.publisher || null,
          platform: metadata?.platform || null,
        });
      }

      setContentInfos(infos);
      setLoading(false);
    };

    fetchContentInfos();
  }, [data.student_contents, data.recommended_contents, contents]);

  // 편집 중인 콘텐츠의 상세정보 조회
  useEffect(() => {
    if (!editingRangeIndex) {
      return;
    }

    const fetchDetails = async () => {
      const content = editingRangeIndex.type === "student"
        ? data.student_contents[editingRangeIndex.index]
        : data.recommended_contents[editingRangeIndex.index];

      if (!content) return;

      const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
      
      // 이미 조회한 경우 캐시에서 가져오기
      if (cachedDetailsRef.current.has(content.content_id)) {
        const cached = cachedDetailsRef.current.get(content.content_id)!;
        setContentDetails(new Map([[contentKey, cached]]));
        return;
      }

      setLoadingDetails(new Set([contentKey]));

      try {
        const apiPath = editingRangeIndex.type === "student"
          ? `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
          : `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`;

        const response = await fetch(apiPath);
        if (response.ok) {
          const result = await response.json();
          const detailData = content.content_type === "book"
            ? { details: result.details || [], type: "book" as const }
            : { details: result.episodes || [], type: "lecture" as const };
          
          // 캐시에 저장
          cachedDetailsRef.current.set(content.content_id, detailData);
          setContentDetails(new Map([[contentKey, detailData]]));
          
          // 현재 범위에 해당하는 시작/끝 항목 자동 선택
          const currentRange = {
            start: content.start_range,
            end: content.end_range,
          };
          
          if (detailData.type === "book") {
            const details = detailData.details as BookDetail[];
            const startDetail = details.find((d) => d.page_number === currentRange.start);
            const endDetail = details.find((d) => d.page_number === currentRange.end);
            if (startDetail) setStartDetailId(new Map([[contentKey, startDetail.id]]));
            if (endDetail) setEndDetailId(new Map([[contentKey, endDetail.id]]));
          } else {
            const episodes = detailData.details as LectureEpisode[];
            const startEpisode = episodes.find((e) => e.episode_number === currentRange.start);
            const endEpisode = episodes.find((e) => e.episode_number === currentRange.end);
            if (startEpisode) setStartDetailId(new Map([[contentKey, startEpisode.id]]));
            if (endEpisode) setEndDetailId(new Map([[contentKey, endEpisode.id]]));
          }
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error("[Step6FinalReview] 상세정보 조회 실패:", planGroupError);
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(contentKey);
          return newSet;
        });
      }
    };

    fetchDetails();
  }, [editingRangeIndex, data.student_contents, data.recommended_contents]);

  // 초기 범위 저장 (Step 6 진입 시점, contentInfos가 로드된 후 한 번만)
  useEffect(() => {
    if (contentInfos.length === 0 || initialRanges.size > 0) return; // 이미 저장되었으면 스킵
    
    const initial = new Map<string, { start: number; end: number }>();
    
    // contentKey 매핑 생성
    const contentKeyMap = new Map<string, string>();
    data.student_contents.forEach((c, idx) => {
      contentKeyMap.set(c.content_id, `student-${idx}`);
    });
    data.recommended_contents.forEach((c, idx) => {
      contentKeyMap.set(c.content_id, `recommended-${idx}`);
    });
    
    // 초기 범위 저장
    contentInfos.forEach((info) => {
      const contentKey = contentKeyMap.get(info.content_id);
      if (!contentKey) return;
      
      const content = 
        contentKey.startsWith('student-')
          ? data.student_contents[parseInt(contentKey.split('-')[1])]
          : data.recommended_contents[parseInt(contentKey.split('-')[1])];
      
      if (content) {
        initial.set(contentKey, {
          start: content.start_range,
          end: content.end_range,
        });
      }
    });
    
    setInitialRanges(initial);
  }, [contentInfos, data.student_contents, data.recommended_contents, initialRanges.size]);

  // 전체 콘텐츠를 고려한 추천 범위 계산
  const [recommendedRanges, setRecommendedRanges] = useState<Map<string, { start: number; end: number; reason: string }>>(new Map());
  const [rangeUnavailableReasons, setRangeUnavailableReasons] = useState<Map<string, string>>(new Map());
  
  // 추천 범위가 없는 이유를 반환하는 함수
  const getUnavailableReason = useCallback((
    contentKey: string,
    hasScheduleSummary: boolean,
    scheduleSummary: typeof data.schedule_summary,
    totalAmount: number | undefined
  ): string | null => {
    if (!hasScheduleSummary || !scheduleSummary) {
      return "스케줄 정보 없음";
    }
    
    const { total_study_days, total_study_hours } = scheduleSummary;
    if (total_study_days === 0 || total_study_hours === 0) {
      return "스케줄 정보 없음";
    }
    
    if (totalAmount === undefined) {
      return "총량 정보 없음";
    }
    
    if (totalAmount <= 0) {
      return "총량 정보 오류";
    }
    
    return null;
  }, []);
  
  useEffect(() => {
    const calculateRecommendedRanges = () => {
      if (!data.schedule_summary || contentInfos.length === 0) {
        setRecommendedRanges(new Map());
        setRangeUnavailableReasons(new Map());
        return;
      }

      const { total_study_days, total_study_hours } = data.schedule_summary;
      if (total_study_days === 0 || total_study_hours === 0) {
        // 모든 콘텐츠에 스케줄 정보 없음 표시
        const reasons = new Map<string, string>();
        // contentKey 매핑 생성 (최적화)
        const contentKeyMap = new Map<string, string>();
        data.student_contents.forEach((c, idx) => {
          contentKeyMap.set(c.content_id, `student-${idx}`);
        });
        data.recommended_contents.forEach((c, idx) => {
          contentKeyMap.set(c.content_id, `recommended-${idx}`);
        });
        
        contentInfos.forEach((contentInfo) => {
          const contentKey = contentKeyMap.get(contentInfo.content_id);
          if (contentKey) {
            reasons.set(contentKey, "스케줄 정보 없음");
          }
        });
        setRecommendedRanges(new Map());
        setRangeUnavailableReasons(reasons);
        return;
      }

      // 전체 콘텐츠 개수
      const totalContents = contentInfos.length;
      
      // 일일 평균 학습 시간 계산
      const avgDailyHours = total_study_hours / total_study_days;
      
      // 각 콘텐츠에 할당할 일일 학습량 계산
      // 예: 9개 콘텐츠, 하루 3시간 → 각 콘텐츠당 약 20분
      const hoursPerContentPerDay = avgDailyHours / totalContents;
      
      const newRanges = new Map<string, { start: number; end: number; reason: string }>();
      const newReasons = new Map<string, string>();

      // contentKey 매핑을 미리 생성 (findIndex 반복 호출 최적화)
      const contentKeyMap = new Map<string, string>();
      data.student_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `student-${idx}`);
      });
      data.recommended_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `recommended-${idx}`);
      });

      // 각 콘텐츠별 추천 범위 계산
      for (const contentInfo of contentInfos) {
        const contentKey = contentKeyMap.get(contentInfo.content_id);
        if (!contentKey) continue;
        
        const totalAmount = contentTotals.get(contentKey);
        const unavailableReason = getUnavailableReason(
          contentKey,
          true,
          data.schedule_summary,
          totalAmount
        );
        
        if (unavailableReason) {
          newReasons.set(contentKey, unavailableReason);
          continue;
        }

        if (!totalAmount || totalAmount <= 0) {
          newReasons.set(contentKey, "총량 정보 오류");
          continue;
        }

        if (contentInfo.content_type === "book") {
          // 교재: 일일 학습량을 페이지로 환산 (1시간당 10페이지 가정)
          const pagesPerHour = 10;
          const dailyPages = Math.round(hoursPerContentPerDay * pagesPerHour);
          const recommendedEnd = Math.min(dailyPages * total_study_days, totalAmount);
          
          newRanges.set(contentKey, {
            start: 1,
            end: recommendedEnd,
            reason: `${totalContents}개 콘텐츠 분배, 일일 ${dailyPages}페이지 × ${total_study_days}일`,
          });
        } else {
          // 강의: 일일 학습량을 회차로 환산 (1시간당 1회차 가정)
          const episodesPerHour = 1;
          const dailyEpisodes = Math.round(hoursPerContentPerDay * episodesPerHour);
          const recommendedEnd = Math.min(dailyEpisodes * total_study_days, totalAmount);
          
          newRanges.set(contentKey, {
            start: 1,
            end: recommendedEnd,
            reason: `${totalContents}개 콘텐츠 분배, 일일 ${dailyEpisodes}회차 × ${total_study_days}일`,
          });
        }
      }

      setRecommendedRanges(newRanges);
      setRangeUnavailableReasons(newReasons);
    };

    calculateRecommendedRanges();
  }, [data.schedule_summary, contentInfos, contentTotals, data.student_contents, data.recommended_contents, getUnavailableReason]);

  // 콘텐츠 총량 조회 (추천 범위 계산용)
  useEffect(() => {
    const fetchContentTotals = async () => {
      setLoadingContentTotals(true);
      const newTotals = new Map<string, number>();

      // contentKey 매핑 생성 (최적화)
      const contentKeyMap = new Map<string, string>();
      data.student_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `student-${idx}`);
      });
      data.recommended_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `recommended-${idx}`);
      });

      for (const contentInfo of contentInfos) {
        const contentKey = contentKeyMap.get(contentInfo.content_id);
        if (!contentKey || contentTotals.has(contentKey)) continue;

        try {
          const apiPath = contentInfo.isRecommended
            ? `/api/master-content-info?content_type=${contentInfo.content_type}&content_id=${contentInfo.content_id}`
            : `/api/student-content-info?content_type=${contentInfo.content_type}&content_id=${contentInfo.content_id}`;
          
          const response = await fetch(apiPath);
          if (response.ok) {
            const info = await response.json();
            let total = contentInfo.content_type === "book" ? info.total_pages : info.total_episodes;
            
            // 총량 정보가 없으면 상세 정보에서 최대값 추정
            if (!total) {
              const detailsApiPath = contentInfo.isRecommended
                ? `/api/master-content-details?contentType=${contentInfo.content_type}&contentId=${contentInfo.content_id}`
                : `/api/student-content-details?contentType=${contentInfo.content_type}&contentId=${contentInfo.content_id}`;
              
              try {
                const detailsResponse = await fetch(detailsApiPath);
                if (detailsResponse.ok) {
                  const detailsResult = await detailsResponse.json();
                  if (contentInfo.content_type === "book") {
                    const details = detailsResult.details || [];
                    if (details.length > 0) {
                      // 상세 정보의 최대 페이지 찾기
                      const maxPage = Math.max(...details.map((d: BookDetail) => d.page_number));
                      // 다음 단원이 있다면 그 시작 페이지 - 1, 없으면 최대 페이지 사용
                      // 단, 상세 정보에서 다음 단원의 시작 페이지를 찾을 수 없으므로
                      // 현재는 최대 페이지를 사용하되, 실제로는 API에서 총량 정보를 제공해야 함
                      total = maxPage;
                    }
                  } else {
                    const episodes = detailsResult.episodes || [];
                    if (episodes.length > 0) {
                      const maxEpisode = Math.max(...episodes.map((e: LectureEpisode) => e.episode_number));
                      total = maxEpisode;
                    }
                  }
                }
              } catch (detailsError) {
                const planGroupError = toPlanGroupError(
                  detailsError,
                  PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
                  { contentId: contentInfo.content_id }
                );
                console.error(`[Step6FinalReview] 콘텐츠 ${contentInfo.content_id} 상세정보 조회 실패 (총량 추정용):`, planGroupError);
              }
            }
            
            if (total && total > 0) {
              newTotals.set(contentKey, total);
            }
          }
        } catch (error) {
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
            { contentId: contentInfo.content_id }
          );
          console.error(`[Step6FinalReview] 콘텐츠 ${contentInfo.content_id} 총량 조회 실패:`, planGroupError);
        }
      }

      if (newTotals.size > 0) {
        setContentTotals((prev) => new Map([...prev, ...newTotals]));
      }
      setLoadingContentTotals(false);
    };

    if (contentInfos.length > 0) {
      fetchContentTotals();
    }
  }, [contentInfos, data.student_contents, data.recommended_contents, contentTotals]);

  // 시작/끝 범위 선택 시 범위 자동 계산
  useEffect(() => {
    if (!editingRangeIndex) return;

    const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
    const contentInfo = contentDetails.get(contentKey);
    const startId = startDetailId.get(contentKey);
    const endId = endDetailId.get(contentKey);

    if (!contentInfo || !startId || !endId) return;

    let newStart: number | null = null;
    let newEnd: number | null = null;

    if (contentInfo.type === "book") {
      const details = contentInfo.details as BookDetail[];
      const startDetail = details.find((d) => d.id === startId);
      const endDetail = details.find((d) => d.id === endId);
      if (startDetail && endDetail) {
        newStart = startDetail.page_number;
        
        // 마지막 범위 선택 시: 다음 범위의 시작 페이지 - 1
        // 마지막 단원인 경우: 상세 정보의 최대 페이지 사용
        const endDetailIndex = details.findIndex((d) => d.id === endId);
        if (endDetailIndex >= 0 && endDetailIndex < details.length - 1) {
          // 다음 단원이 있는 경우: 다음 단원의 시작 페이지 - 1
          const nextDetail = details[endDetailIndex + 1];
          newEnd = nextDetail.page_number - 1;
        } else {
          // 마지막 단원인 경우: 해당 단원의 시작 페이지 사용 (또는 총량 정보 활용)
          newEnd = endDetail.page_number;
          // 총량 정보가 있으면 최대값으로 제한
          const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
          const total = contentTotals.get(contentKey);
          if (total && newEnd < total) {
            // 마지막 단원이지만 총량이 더 크면 총량 사용
            // 단, 상세 정보의 최대 페이지와 비교
            const maxPageInDetails = Math.max(...details.map(d => d.page_number));
            newEnd = Math.max(newEnd, maxPageInDetails);
            if (total) newEnd = Math.min(newEnd, total);
          }
        }
        
        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    } else {
      const episodes = contentInfo.details as LectureEpisode[];
      const startEpisode = episodes.find((e) => e.id === startId);
      const endEpisode = episodes.find((e) => e.id === endId);
      if (startEpisode && endEpisode) {
        newStart = startEpisode.episode_number;
        newEnd = endEpisode.episode_number;
        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    }

    if (newStart !== null && newEnd !== null) {
      setEditingRange({
        start: String(newStart),
        end: String(newEnd),
      });
    }
  }, [startDetailId, endDetailId, contentDetails, editingRangeIndex]);

  const setStartRange = (detailId: string) => {
    if (!editingRangeIndex) return;
    const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
    const newMap = new Map(startDetailId);
    newMap.set(contentKey, detailId);
    setStartDetailId(newMap);
  };

  const setEndRange = (detailId: string) => {
    if (!editingRangeIndex) return;
    const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;
    const newMap = new Map(endDetailId);
    newMap.set(contentKey, detailId);
    setEndDetailId(newMap);
  };

  // 과목별 그룹화
  const contentsBySubject = new Map<string, ContentInfo[]>();
  contentInfos.forEach((content) => {
    const subject = content.subject_category || "기타";
    if (!contentsBySubject.has(subject)) {
      contentsBySubject.set(subject, []);
    }
    contentsBySubject.get(subject)!.push(content);
  });

  // 필수 과목 우선 정렬
  const requiredSubjects = ["국어", "수학", "영어"];
  const sortedSubjects = Array.from(contentsBySubject.keys()).sort((a, b) => {
    const aIndex = requiredSubjects.indexOf(a);
    const bIndex = requiredSubjects.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  const totalCount = studentCount + recommendedCount;

  // 필수 과목 검증
  const selectedSubjectCategories = new Set(
    contentInfos.map((c) => c.subject_category).filter((s): s is string => !!s)
  );
  const missingRequiredSubjects = requiredSubjects.filter(
    (subject) => !selectedSubjectCategories.has(subject)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">콘텐츠 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">최종 확인 및 조정</h2>
        <p className="mt-1 text-sm text-gray-500">
          선택한 콘텐츠와 학습 범위를 확인하고 필요시 조정해주세요.
        </p>
      </div>

      {/* 요약 정보 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-medium text-gray-700">전체 콘텐츠</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{totalCount}개</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-medium text-blue-700">학생 콘텐츠</div>
            <div className="mt-1 text-2xl font-bold text-blue-900">{studentCount}개</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="text-sm font-medium text-green-700">추천 콘텐츠</div>
            <div className="mt-1 text-2xl font-bold text-green-900">{recommendedCount}개</div>
          </div>
        </div>
      </div>

      {/* 학습량 비교 요약 */}
      {data.schedule_summary && (() => {
        // 콘텐츠 총량 조회 중이거나 추천 범위 계산 중인지 확인
        const isCalculatingRecommendations = contentInfos.length > 0 && recommendedRanges.size === 0 && rangeUnavailableReasons.size === 0;
        const isLoading = loadingContentTotals || isCalculatingRecommendations;
        
        if (isLoading) {
          return (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">📊 전체 학습량 비교</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">
                      {loadingContentTotals ? "콘텐츠 정보를 불러오는 중..." : "추천 범위를 계산하는 중..."}
                    </p>
                    <p className="text-xs text-gray-500">잠시만 기다려주세요</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (recommendedRanges.size === 0 && rangeUnavailableReasons.size > 0) {
          // 추천 범위를 계산할 수 없는 경우
          return null;
        }

        if (recommendedRanges.size === 0) {
          return null;
        }

        let initialTotalPages = 0;
        let initialTotalEpisodes = 0;
        let currentTotalPages = 0;
        let currentTotalEpisodes = 0;
        let recommendedTotalPages = 0;
        let recommendedTotalEpisodes = 0;

        // contentKey와 content 매핑 생성 (최적화)
        const contentKeyMap = new Map<string, string>();
        const contentMap = new Map<string, typeof data.student_contents[0] | typeof data.recommended_contents[0]>();
        
        data.student_contents.forEach((c, idx) => {
          const key = `student-${idx}`;
          contentKeyMap.set(c.content_id, key);
          contentMap.set(key, c);
        });
        
        data.recommended_contents.forEach((c, idx) => {
          const key = `recommended-${idx}`;
          contentKeyMap.set(c.content_id, key);
          contentMap.set(key, c);
        });

        contentInfos.forEach((info) => {
          const contentKey = contentKeyMap.get(info.content_id);
          if (!contentKey) return;
          
          const content = contentMap.get(contentKey);
          if (!content) return;
          
          const initial = initialRanges.get(contentKey);
          const recommended = recommendedRanges.get(contentKey);

          if (info.content_type === "book") {
            // 초기 범위
            if (initial) {
              initialTotalPages += initial.end - initial.start + 1;
            } else {
              initialTotalPages += content.end_range - content.start_range + 1;
            }
            // 현재 범위
            currentTotalPages += content.end_range - content.start_range + 1;
            // 추천 범위
            if (recommended) {
              recommendedTotalPages += recommended.end - recommended.start + 1;
            }
          } else {
            // 초기 범위
            if (initial) {
              initialTotalEpisodes += initial.end - initial.start + 1;
            } else {
              initialTotalEpisodes += content.end_range - content.start_range + 1;
            }
            // 현재 범위
            currentTotalEpisodes += content.end_range - content.start_range + 1;
            // 추천 범위
            if (recommended) {
              recommendedTotalEpisodes += recommended.end - recommended.start + 1;
            }
          }
        });

        const { total_study_days, total_study_hours } = data.schedule_summary;
        const avgDailyHours = total_study_hours / total_study_days;
        
        // 전체 일일 학습량 계산 (각 콘텐츠별이 아닌 전체)
        // 교재: 1시간당 10페이지, 강의: 1시간당 1회차
        const pagesPerHour = 10;
        const episodesPerHour = 1;
        const totalDailyPages = Math.round(avgDailyHours * pagesPerHour); // 전체 일일 페이지
        const totalDailyEpisodes = Math.round(avgDailyHours * episodesPerHour); // 전체 일일 회차
        
        // 현재 범위 예상 일수: 전체 학습량을 전체 일일 학습량으로 나눔
        let currentEstimatedDays = 0;
        if (currentTotalPages > 0 && totalDailyPages > 0) {
          currentEstimatedDays = Math.ceil(currentTotalPages / totalDailyPages);
        }
        if (currentTotalEpisodes > 0 && totalDailyEpisodes > 0) {
          const episodeDays = Math.ceil(currentTotalEpisodes / totalDailyEpisodes);
          currentEstimatedDays = Math.max(currentEstimatedDays, episodeDays);
        }
        
        // 추천 범위 예상 일수: 추천 범위는 이미 total_study_days 기준으로 계산되었으므로
        // 전체 학습량을 전체 일일 학습량으로 나눔
        let recommendedEstimatedDays = 0;
        if (recommendedTotalPages > 0 && totalDailyPages > 0) {
          recommendedEstimatedDays = Math.ceil(recommendedTotalPages / totalDailyPages);
        }
        if (recommendedTotalEpisodes > 0 && totalDailyEpisodes > 0) {
          const episodeDays = Math.ceil(recommendedTotalEpisodes / totalDailyEpisodes);
          recommendedEstimatedDays = Math.max(recommendedEstimatedDays, episodeDays);
        }
        
        // 초기 범위와 현재 범위가 다른지 확인
        const hasChanged = initialTotalPages !== currentTotalPages || initialTotalEpisodes !== currentTotalEpisodes;
        const hasDifference = currentTotalPages !== recommendedTotalPages || currentTotalEpisodes !== recommendedTotalEpisodes;

        return (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">📊 전체 학습량 비교</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* 현재 범위 */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-xs font-medium text-blue-700">현재 지정 범위</div>
                <div className="mt-1 text-lg font-bold text-blue-900">
                  {currentTotalPages > 0 && (
                    <span className="block">📄 {currentTotalPages}페이지</span>
                  )}
                  {currentTotalEpisodes > 0 && (
                    <span className="block">📺 {currentTotalEpisodes}회차</span>
                  )}
                  {currentTotalPages === 0 && currentTotalEpisodes === 0 && (
                    <span className="text-sm text-gray-500">없음</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-blue-600">
                  예상 소요: 약 {currentEstimatedDays}일
                </div>
                {hasChanged && (
                  <div className="mt-1 text-xs text-amber-600">
                    {initialTotalPages !== currentTotalPages && (
                      <span>초기 대비 페이지 {currentTotalPages - initialTotalPages > 0 ? "+" : ""}{currentTotalPages - initialTotalPages}</span>
                    )}
                    {initialTotalEpisodes !== currentTotalEpisodes && (
                      <span className={initialTotalPages !== currentTotalPages ? " ml-1" : ""}>
                        회차 {currentTotalEpisodes - initialTotalEpisodes > 0 ? "+" : ""}{currentTotalEpisodes - initialTotalEpisodes}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* 추천 범위 */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="text-xs font-medium text-green-700">추천 범위</div>
                <div className="mt-1 text-lg font-bold text-green-900">
                  {recommendedTotalPages > 0 && (
                    <span className="block">📄 {recommendedTotalPages}페이지</span>
                  )}
                  {recommendedTotalEpisodes > 0 && (
                    <span className="block">📺 {recommendedTotalEpisodes}회차</span>
                  )}
                  {recommendedTotalPages === 0 && recommendedTotalEpisodes === 0 && (
                    <span className="text-sm text-gray-500">없음</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-green-600">
                  예상 소요: 약 {recommendedEstimatedDays}일 (스케줄에 맞춤)
                </div>
              </div>
              
              {/* 차이 */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-medium text-amber-700">차이</div>
                <div className="mt-1 text-lg font-bold text-amber-900">
                  {hasDifference ? (
                    <>
                      {currentTotalPages - recommendedTotalPages !== 0 && (
                        <span className="block">
                          📄 {currentTotalPages - recommendedTotalPages > 0 ? "+" : ""}{currentTotalPages - recommendedTotalPages}페이지
                        </span>
                      )}
                      {currentTotalEpisodes - recommendedTotalEpisodes !== 0 && (
                        <span className="block">
                          📺 {currentTotalEpisodes - recommendedTotalEpisodes > 0 ? "+" : ""}{currentTotalEpisodes - recommendedTotalEpisodes}회차
                        </span>
                      )}
                      {currentTotalPages - recommendedTotalPages === 0 && currentTotalEpisodes - recommendedTotalEpisodes === 0 && (
                        <span className="text-sm text-green-600">일치</span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-green-600">일치</span>
                  )}
                </div>
                {hasDifference && (
                  <div className="mt-1 text-xs text-amber-600">
                    {currentTotalPages > recommendedTotalPages || currentTotalEpisodes > recommendedTotalEpisodes
                      ? "추천보다 많음"
                      : "추천보다 적음"}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 비교 테이블 */}
      {recommendedRanges.size > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">학습 범위 비교</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // 과목별 적용을 위한 과목 목록 추출
                  const subjects = Array.from(new Set(contentInfos.map((c) => c.subject_category).filter((s): s is string => !!s)));
                  if (subjects.length === 0) {
                    alert("과목별 적용할 과목이 없습니다.");
                    return;
                  }
                  const selectedSubject = prompt(`적용할 과목을 선택하세요:\n${subjects.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n번호를 입력하세요:`);
                  if (!selectedSubject) return;
                  const subjectIndex = parseInt(selectedSubject) - 1;
                  if (isNaN(subjectIndex) || subjectIndex < 0 || subjectIndex >= subjects.length) {
                    alert("올바른 번호를 입력해주세요.");
                    return;
                  }
                  const targetSubject = subjects[subjectIndex];

                  // 해당 과목의 콘텐츠만 추천 범위 적용
                  const updatedStudent = [...data.student_contents];
                  const updatedRecommended = [...data.recommended_contents];

                  // contentKey 매핑 생성 (최적화)
                  const contentKeyMap = new Map<string, { type: "student" | "recommended"; index: number }>();
                  data.student_contents.forEach((c, idx) => {
                    contentKeyMap.set(c.content_id, { type: "student", index: idx });
                  });
                  data.recommended_contents.forEach((c, idx) => {
                    contentKeyMap.set(c.content_id, { type: "recommended", index: idx });
                  });

                  contentInfos.forEach((info) => {
                    if (info.subject_category !== targetSubject) return;

                    const mapping = contentKeyMap.get(info.content_id);
                    if (!mapping) return;

                    const contentKey = `${mapping.type}-${mapping.index}`;
                    const recommended = recommendedRanges.get(contentKey);
                    if (!recommended) return;

                    if (mapping.type === "recommended") {
                      updatedRecommended[mapping.index] = {
                        ...updatedRecommended[mapping.index],
                        start_range: recommended.start,
                        end_range: recommended.end,
                      };
                    } else {
                      updatedStudent[mapping.index] = {
                        ...updatedStudent[mapping.index],
                        start_range: recommended.start,
                        end_range: recommended.end,
                      };
                    }
                  });

                  onUpdate({
                    student_contents: updatedStudent,
                    recommended_contents: updatedRecommended,
                  });
                }}
                className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                과목별 적용
              </button>
              <button
                type="button"
                onClick={() => {
                  // 전체 추천 범위 일괄 적용
                  const updatedStudent = [...data.student_contents];
                  const updatedRecommended = [...data.recommended_contents];

                  // contentKey 매핑 생성 (최적화)
                  const contentKeyMap = new Map<string, { type: "student" | "recommended"; index: number }>();
                  data.student_contents.forEach((c, idx) => {
                    contentKeyMap.set(c.content_id, { type: "student", index: idx });
                  });
                  data.recommended_contents.forEach((c, idx) => {
                    contentKeyMap.set(c.content_id, { type: "recommended", index: idx });
                  });

                  contentInfos.forEach((info) => {
                    const mapping = contentKeyMap.get(info.content_id);
                    if (!mapping) return;

                    const contentKey = `${mapping.type}-${mapping.index}`;
                    const recommended = recommendedRanges.get(contentKey);
                    if (!recommended) return;

                    if (mapping.type === "recommended") {
                      updatedRecommended[mapping.index] = {
                        ...updatedRecommended[mapping.index],
                        start_range: recommended.start,
                        end_range: recommended.end,
                      };
                    } else {
                      updatedStudent[mapping.index] = {
                        ...updatedStudent[mapping.index],
                        start_range: recommended.start,
                        end_range: recommended.end,
                      };
                    }
                  });

                  onUpdate({
                    student_contents: updatedStudent,
                    recommended_contents: updatedRecommended,
                  });
                }}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                전체 적용
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-medium text-gray-700">콘텐츠</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">학생 지정</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">추천 범위</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">차이</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">적용</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // contentKey와 content 매핑을 미리 생성 (최적화)
                  // content_id와 isRecommended 조합을 키로 사용하여 고유성 보장
                  const contentKeyMap = new Map<string, string>();
                  const contentMap = new Map<string, typeof data.student_contents[0] | typeof data.recommended_contents[0]>();
                  
                  data.student_contents.forEach((c, idx) => {
                    const key = `student-${idx}`;
                    const mapKey = `${c.content_id}:student`;
                    contentKeyMap.set(mapKey, key);
                    contentMap.set(key, c);
                  });
                  
                  data.recommended_contents.forEach((c, idx) => {
                    const key = `recommended-${idx}`;
                    const mapKey = `${c.content_id}:recommended`;
                    contentKeyMap.set(mapKey, key);
                    contentMap.set(key, c);
                  });
                  
                  return contentInfos.map((info, idx) => {
                    const mapKey = `${info.content_id}:${info.isRecommended ? 'recommended' : 'student'}`;
                    const contentKey = contentKeyMap.get(mapKey);
                    if (!contentKey) return null;
                    
                    const content = contentMap.get(contentKey);
                    if (!content) return null;

                  const recommended = recommendedRanges.get(contentKey);
                  const studentRange = content.end_range - content.start_range + 1;
                  const recommendedRange = recommended ? recommended.end - recommended.start + 1 : null;
                  const difference = recommendedRange !== null ? studentRange - recommendedRange : null;
                  const isOver = difference !== null && difference > 0;
                  const isUnder = difference !== null && difference < 0;

                  // 고유한 key 생성: contentKey와 인덱스를 조합
                  const uniqueKey = `${contentKey}-${idx}`;

                  return (
                    <tr key={uniqueKey} className="border-b border-gray-100">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900">{info.title}</div>
                              {info.isRecommended ? (
                                <>
                                  {info.is_auto_recommended ? (
                                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800" title={info.recommendation_reason || "자동 추천된 콘텐츠"}>
                                      🤖 자동 추천
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                                      추천 콘텐츠
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                  학생 콘텐츠
                                </span>
                              )}
                            </div>
                            {/* 자동 추천 이유 표시 */}
                            {info.is_auto_recommended && info.recommendation_reason && (
                              <div className="mt-1 text-xs text-purple-600">
                                💡 {info.recommendation_reason}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              {info.content_type === "book" && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                                  📚 교재
                                </span>
                              )}
                              {info.content_type === "lecture" && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                                  🎧 강의
                                </span>
                              )}
                              {info.subject && (
                                <>
                                  <span>·</span>
                                  <span>{info.subject}</span>
                                </>
                              )}
                              {info.semester && (
                                <>
                                  <span>·</span>
                                  <span>{info.semester}</span>
                                </>
                              )}
                              {info.revision && (
                                <>
                                  <span>·</span>
                                  <span className="font-medium text-indigo-600">
                                    {info.revision} 개정판
                                  </span>
                                </>
                              )}
                              {info.difficulty_level && (
                                <>
                                  <span>·</span>
                                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                                    {info.difficulty_level}
                                  </span>
                                </>
                              )}
                              {info.publisher && (
                                <>
                                  <span>·</span>
                                  <span>{info.publisher}</span>
                                </>
                              )}
                              {info.platform && (
                                <>
                                  <span>·</span>
                                  <span>{info.platform}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="font-medium text-gray-900">
                          {content.start_range} ~ {content.end_range}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({studentRange}{info.content_type === "book" ? "페이지" : "회차"})
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {recommended ? (
                          <>
                            <div className="font-medium text-blue-600">
                              {recommended.start} ~ {recommended.end}
                            </div>
                            <div className="text-xs text-blue-500">
                              ({recommendedRange}{info.content_type === "book" ? "페이지" : "회차"})
                            </div>
                            <div className="mt-1 text-xs text-gray-400">{recommended.reason}</div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-500">
                            추천 범위 없음
                            {rangeUnavailableReasons.get(contentKey) && (
                              <div className="mt-0.5 text-gray-400">
                                ({rangeUnavailableReasons.get(contentKey)})
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {difference !== null ? (
                          difference !== 0 ? (
                            <span className={`font-medium ${isOver ? "text-red-600" : "text-green-600"}`}>
                              {isOver ? "+" : ""}{difference}{info.content_type === "book" ? "페이지" : "회차"}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {recommended ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (info.isRecommended) {
                                const index = parseInt(contentKey.split('-')[1]);
                                if (!isNaN(index) && index >= 0 && index < data.recommended_contents.length) {
                                  const updated = [...data.recommended_contents];
                                  updated[index] = {
                                    ...updated[index],
                                    start_range: recommended.start,
                                    end_range: recommended.end,
                                  };
                                  onUpdate({ recommended_contents: updated });
                                }
                              } else {
                                const index = parseInt(contentKey.split('-')[1]);
                                if (!isNaN(index) && index >= 0 && index < data.student_contents.length) {
                                  const updated = [...data.student_contents];
                                  updated[index] = {
                                    ...updated[index],
                                    start_range: recommended.start,
                                    end_range: recommended.end,
                                  };
                                  onUpdate({ student_contents: updated });
                                }
                              }
                            }}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            적용
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 필수 과목 경고 */}
      {missingRequiredSubjects.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">필수 과목 미선택</h3>
              <p className="mt-1 text-sm text-red-700">
                다음 필수 과목을 각각 1개 이상 선택해주세요:{" "}
                <span className="font-medium">{missingRequiredSubjects.join(", ")}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 학생 콘텐츠 섹션 */}
      {studentCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">추가한 학생 콘텐츠</h3>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              {studentCount}개
            </span>
          </div>
          <div className="space-y-2">
            {data.student_contents.map((content, index) => {
              const info = contentInfos.find(
                (c) => c.content_id === content.content_id && !c.isRecommended
              );
              if (!info) return null;

              const isEditing =
                editingRangeIndex?.type === "student" && editingRangeIndex.index === index;

              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{info.title}</div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        학생 콘텐츠
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {content.content_type === "book" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                          📚 교재
                        </span>
                      )}
                      {content.content_type === "lecture" && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                          🎧 강의
                        </span>
                      )}
                      {info.subject && (
                        <>
                          <span>·</span>
                          <span>{info.subject}</span>
                        </>
                      )}
                      {info.semester && (
                        <>
                          <span>·</span>
                          <span>{info.semester}</span>
                        </>
                      )}
                      {info.revision && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-indigo-600">
                            {info.revision} 개정판
                          </span>
                        </>
                      )}
                      {info.difficulty_level && (
                        <>
                          <span>·</span>
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                            {info.difficulty_level}
                          </span>
                        </>
                      )}
                      {info.publisher && (
                        <>
                          <span>·</span>
                          <span>{info.publisher}</span>
                        </>
                      )}
                      {info.platform && (
                        <>
                          <span>·</span>
                          <span>{info.platform}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {content.start_range} ~ {content.end_range}
                        {content.content_type === "book" ? " 페이지" : " 회차"}
                      </span>
                      {(() => {
                        const contentKey = `student-${index}`;
                        const recommendedRange = recommendedRanges.get(contentKey);
                        if (recommendedRange) {
                          const studentRange = content.end_range - content.start_range + 1;
                          const recommendedRangeValue = recommendedRange.end - recommendedRange.start + 1;
                          const difference = studentRange - recommendedRangeValue;
                          return (
                            <>
                              <span>·</span>
                              <span className={difference > 0 ? "text-red-600" : difference < 0 ? "text-green-600" : "text-gray-500"}>
                                추천: {recommendedRange.start} ~ {recommendedRange.end}
                                {difference !== 0 && ` (${difference > 0 ? "+" : ""}${difference})`}
                              </span>
                            </>
                          );
                        }
                        return null;
                      })()}
                      {isEditing ? (() => {
                        const contentKey = `student-${index}`;
                        const contentInfo = contentDetails.get(contentKey);
                        const isLoading = loadingDetails.has(contentKey);
                        const selectedStartId = startDetailId.get(contentKey);
                        const selectedEndId = endDetailId.get(contentKey);
                        const recommendedRange = recommendedRanges.get(contentKey);

                        return (
                          <div className="space-y-3">
                            {/* 스케줄 기반 추천 범위 */}
                            {recommendedRange && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-blue-900">
                                      💡 추천 범위: {recommendedRange.start} ~ {recommendedRange.end}
                                      {content.content_type === "book" ? " 페이지" : " 회차"}
                                    </div>
                                    <div className="mt-1 text-xs text-blue-700">
                                      {recommendedRange.reason}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRange({
                                        start: String(recommendedRange.start),
                                        end: String(recommendedRange.end),
                                      });
                                    }}
                                    className="ml-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    적용
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {isLoading ? (
                              <div className="text-xs text-gray-500">상세 정보를 불러오는 중...</div>
                            ) : contentInfo && contentInfo.details.length > 0 ? (
                              <div className="space-y-3">
                                {/* 시작 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">시작 범위 선택</div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {contentInfo.type === "book" ? (
                                        (contentInfo.details as BookDetail[]).map((detail) => {
                                          const isSelected = selectedStartId === detail.id;
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
                                                name={`start-student-${index}`}
                                                checked={isSelected}
                                                onChange={() => setStartRange(detail.id)}
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">페이지 {detail.page_number}</span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit && ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      ) : (
                                        (contentInfo.details as LectureEpisode[]).map((episode) => {
                                          const isSelected = selectedStartId === episode.id;
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
                                                name={`start-student-${index}`}
                                                checked={isSelected}
                                                onChange={() => setStartRange(episode.id)}
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">{episode.episode_number}회차</span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-500">· {episode.episode_title}</span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 끝 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">끝 범위 선택</div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {contentInfo.type === "book" ? (
                                        (contentInfo.details as BookDetail[]).map((detail) => {
                                          const isSelected = selectedEndId === detail.id;
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
                                                name={`end-student-${index}`}
                                                checked={isSelected}
                                                onChange={() => setEndRange(detail.id)}
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">페이지 {detail.page_number}</span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit && ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      ) : (
                                        (contentInfo.details as LectureEpisode[]).map((episode) => {
                                          const isSelected = selectedEndId === episode.id;
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
                                                name={`end-student-${index}`}
                                                checked={isSelected}
                                                onChange={() => setEndRange(episode.id)}
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">{episode.episode_number}회차</span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-500">· {episode.episode_title}</span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 선택된 범위 및 포함된 상세정보 표시 */}
                                {editingRange && (
                                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <div className="text-xs font-medium text-gray-700">
                                      선택된 범위: {editingRange.start} ~ {editingRange.end}
                                      {content.content_type === "book" ? " 페이지" : " 회차"}
                                    </div>
                                    {(() => {
                                      // 범위에 해당하는 모든 상세정보 가져오기
                                      const startNum = Number(editingRange.start);
                                      const endNum = Number(editingRange.end);
                                      if (contentInfo.type === "book") {
                                        const details = contentInfo.details as BookDetail[];
                                        const rangeDetails = details.filter(
                                          (d) => d.page_number >= startNum && d.page_number <= endNum
                                        );
                                        if (rangeDetails.length > 0) {
                                          return (
                                            <div className="mt-2 text-xs text-gray-600">
                                              <div className="font-medium">포함된 단원:</div>
                                              <div className="mt-1 space-y-0.5">
                                                {rangeDetails.map((d, idx) => (
                                                  <div key={idx}>
                                                    페이지 {d.page_number}
                                                    {d.major_unit && (
                                                      <span className="text-gray-500">
                                                        {" "}
                                                        · {d.major_unit}
                                                        {d.minor_unit && ` - ${d.minor_unit}`}
                                                      </span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                      } else {
                                        const episodes = contentInfo.details as LectureEpisode[];
                                        const rangeEpisodes = episodes.filter(
                                          (e) => e.episode_number >= startNum && e.episode_number <= endNum
                                        );
                                        if (rangeEpisodes.length > 0) {
                                          return (
                                            <div className="mt-2 text-xs text-gray-600">
                                              <div className="font-medium">포함된 회차:</div>
                                              <div className="mt-1 space-y-0.5">
                                                {rangeEpisodes.map((e, idx) => (
                                                  <div key={idx}>
                                                    {e.episode_number}회차
                                                    {e.episode_title && (
                                                      <span className="text-gray-500"> · {e.episode_title}</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={editingRange?.start || content.start_range}
                                  onChange={(e) =>
                                    setEditingRange({
                                      start: e.target.value,
                                      end: editingRange?.end || String(content.end_range),
                                    })
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="시작"
                                />
                                <span>~</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={editingRange?.end || content.end_range}
                                  onChange={(e) =>
                                    setEditingRange({
                                      start: editingRange?.start || String(content.start_range),
                                      end: e.target.value,
                                    })
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="종료"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingRange) {
                                    const start = Number(editingRange.start);
                                    const end = Number(editingRange.end);
                                    if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
                                      const updated = [...data.student_contents];
                                      updated[index] = { ...content, start_range: start, end_range: end };
                                      onUpdate({ student_contents: updated });
                                      setEditingRangeIndex(null);
                                      setEditingRange(null);
                                      // 상세정보 선택 초기화
                                      setStartDetailId((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.delete(contentKey);
                                        return newMap;
                                      });
                                      setEndDetailId((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.delete(contentKey);
                                        return newMap;
                                      });
                                    } else {
                                      alert("올바른 범위를 입력해주세요. (시작 ≤ 종료, 양수)");
                                    }
                                  }
                                }}
                                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRangeIndex(null);
                                  setEditingRange(null);
                                  // 상세정보 선택 초기화
                                  setStartDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(contentKey);
                                    return newMap;
                                  });
                                  setEndDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(contentKey);
                                    return newMap;
                                  });
                                }}
                                className="rounded bg-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-400"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        );
                      })() : (
                        <span className="font-medium">
                          {content.start_range} ~ {content.end_range}
                          {content.content_type === "book" ? " 페이지" : " 회차"}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isEditing && (() => {
                    const contentKey = `student-${index}`;
                    const recommendedRange = recommendedRanges.get(contentKey);
                    const unavailableReason = rangeUnavailableReasons.get(contentKey);
                    const studentRange = content.end_range - content.start_range + 1;
                    const recommendedRangeValue = recommendedRange ? recommendedRange.end - recommendedRange.start + 1 : null;
                    const difference = recommendedRangeValue !== null ? studentRange - recommendedRangeValue : null;
                    
                    return (
                      <div className="ml-4 flex flex-col items-end gap-2">
                        {recommendedRange ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs">
                            <div className="font-medium text-blue-900">
                              💡 추천: {recommendedRange.start} ~ {recommendedRange.end}
                              {content.content_type === "book" ? " 페이지" : " 회차"}
                            </div>
                            {difference !== null && difference !== 0 && (
                              <div className={`mt-0.5 text-xs ${difference > 0 ? "text-red-600" : "text-green-600"}`}>
                                {difference > 0 ? "+" : ""}{difference} {content.content_type === "book" ? "페이지" : "회차"} 차이
                              </div>
                            )}
                          </div>
                        ) : unavailableReason ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                            <div className="text-gray-600">
                              추천 범위 없음
                            </div>
                            <div className="mt-0.5 text-gray-500">
                              ({unavailableReason})
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRangeIndex({ type: "student", index });
                              setEditingRange({
                                start: String(content.start_range),
                                end: String(content.end_range),
                              });
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            범위 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = data.student_contents.filter((_, i) => i !== index);
                              onUpdate({ student_contents: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 추천 콘텐츠 섹션 */}
      {recommendedCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">추천 콘텐츠</h3>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              {recommendedCount}개
            </span>
          </div>
          <div className="space-y-2">
            {data.recommended_contents.map((content, index) => {
              const info = contentInfos.find(
                (c) => c.content_id === content.content_id && c.isRecommended
              );
              if (!info) return null;

              const isEditing =
                editingRangeIndex?.type === "recommended" && editingRangeIndex.index === index;

              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{info.title}</div>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        추천 콘텐츠
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {content.content_type === "book" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                          📚 교재
                        </span>
                      )}
                      {content.content_type === "lecture" && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                          🎧 강의
                        </span>
                      )}
                      {info.subject && (
                        <>
                          <span>·</span>
                          <span>{info.subject}</span>
                        </>
                      )}
                      {info.semester && (
                        <>
                          <span>·</span>
                          <span>{info.semester}</span>
                        </>
                      )}
                      {info.revision && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-indigo-600">
                            {info.revision} 개정판
                          </span>
                        </>
                      )}
                      {info.difficulty_level && (
                        <>
                          <span>·</span>
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                            {info.difficulty_level}
                          </span>
                        </>
                      )}
                      {info.publisher && (
                        <>
                          <span>·</span>
                          <span>{info.publisher}</span>
                        </>
                      )}
                      {info.platform && (
                        <>
                          <span>·</span>
                          <span>{info.platform}</span>
                        </>
                      )}
                      <span>·</span>
                      {isEditing ? (() => {
                        const contentKey = `recommended-${index}`;
                        const contentInfo = contentDetails.get(contentKey);
                        const isLoading = loadingDetails.has(contentKey);
                        const selectedStartId = startDetailId.get(contentKey);
                        const selectedEndId = endDetailId.get(contentKey);
                        const recommendedRange = recommendedRanges.get(contentKey);

                        return (
                          <div className="space-y-3">
                            {/* 스케줄 기반 추천 범위 */}
                            {recommendedRange && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-blue-900">
                                      💡 추천 범위: {recommendedRange.start} ~ {recommendedRange.end}
                                      {content.content_type === "book" ? " 페이지" : " 회차"}
                                    </div>
                                    <div className="mt-1 text-xs text-blue-700">
                                      {recommendedRange.reason}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRange({
                                        start: String(recommendedRange.start),
                                        end: String(recommendedRange.end),
                                      });
                                    }}
                                    className="ml-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    적용
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {isLoading ? (
                              <div className="text-xs text-gray-500">상세 정보를 불러오는 중...</div>
                            ) : contentInfo && contentInfo.details.length > 0 ? (
                              <div className="space-y-3">
                                {/* 시작 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">시작 범위 선택</div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {contentInfo.type === "book" ? (
                                        (contentInfo.details as BookDetail[]).map((detail) => {
                                          const isSelected = selectedStartId === detail.id;
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
                                                name={`start-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() => setStartRange(detail.id)}
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">페이지 {detail.page_number}</span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit && ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      ) : (
                                        (contentInfo.details as LectureEpisode[]).map((episode) => {
                                          const isSelected = selectedStartId === episode.id;
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
                                                name={`start-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() => setStartRange(episode.id)}
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">{episode.episode_number}회차</span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-500">· {episode.episode_title}</span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 끝 범위 선택 */}
                                <div>
                                  <div className="mb-2 text-xs font-medium text-gray-700">끝 범위 선택</div>
                                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                    <div className="space-y-1">
                                      {contentInfo.type === "book" ? (
                                        (contentInfo.details as BookDetail[]).map((detail) => {
                                          const isSelected = selectedEndId === detail.id;
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
                                                name={`end-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() => setEndRange(detail.id)}
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">페이지 {detail.page_number}</span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-500">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit && ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      ) : (
                                        (contentInfo.details as LectureEpisode[]).map((episode) => {
                                          const isSelected = selectedEndId === episode.id;
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
                                                name={`end-recommended-${index}`}
                                                checked={isSelected}
                                                onChange={() => setEndRange(episode.id)}
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">{episode.episode_number}회차</span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-500">· {episode.episode_title}</span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 선택된 범위 및 포함된 상세정보 표시 */}
                                {editingRange && (
                                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <div className="text-xs font-medium text-gray-700">
                                      선택된 범위: {editingRange.start} ~ {editingRange.end}
                                      {content.content_type === "book" ? " 페이지" : " 회차"}
                                    </div>
                                    {(() => {
                                      // 범위에 해당하는 모든 상세정보 가져오기
                                      const startNum = Number(editingRange.start);
                                      const endNum = Number(editingRange.end);
                                      if (contentInfo.type === "book") {
                                        const details = contentInfo.details as BookDetail[];
                                        const rangeDetails = details.filter(
                                          (d) => d.page_number >= startNum && d.page_number <= endNum
                                        );
                                        if (rangeDetails.length > 0) {
                                          return (
                                            <div className="mt-2 text-xs text-gray-600">
                                              <div className="font-medium">포함된 단원:</div>
                                              <div className="mt-1 space-y-0.5">
                                                {rangeDetails.map((d, idx) => (
                                                  <div key={idx}>
                                                    페이지 {d.page_number}
                                                    {d.major_unit && (
                                                      <span className="text-gray-500">
                                                        {" "}
                                                        · {d.major_unit}
                                                        {d.minor_unit && ` - ${d.minor_unit}`}
                                                      </span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                      } else {
                                        const episodes = contentInfo.details as LectureEpisode[];
                                        const rangeEpisodes = episodes.filter(
                                          (e) => e.episode_number >= startNum && e.episode_number <= endNum
                                        );
                                        if (rangeEpisodes.length > 0) {
                                          return (
                                            <div className="mt-2 text-xs text-gray-600">
                                              <div className="font-medium">포함된 회차:</div>
                                              <div className="mt-1 space-y-0.5">
                                                {rangeEpisodes.map((e, idx) => (
                                                  <div key={idx}>
                                                    {e.episode_number}회차
                                                    {e.episode_title && (
                                                      <span className="text-gray-500"> · {e.episode_title}</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={editingRange?.start || content.start_range}
                                  onChange={(e) =>
                                    setEditingRange({
                                      start: e.target.value,
                                      end: editingRange?.end || String(content.end_range),
                                    })
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="시작"
                                />
                                <span>~</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={editingRange?.end || content.end_range}
                                  onChange={(e) =>
                                    setEditingRange({
                                      start: editingRange?.start || String(content.start_range),
                                      end: e.target.value,
                                    })
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                  placeholder="종료"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingRange) {
                                    const start = Number(editingRange.start);
                                    const end = Number(editingRange.end);
                                    if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
                                      const updated = [...data.recommended_contents];
                                      updated[index] = { ...content, start_range: start, end_range: end };
                                      onUpdate({ recommended_contents: updated });
                                      setEditingRangeIndex(null);
                                      setEditingRange(null);
                                      // 상세정보 선택 초기화
                                      setStartDetailId((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.delete(contentKey);
                                        return newMap;
                                      });
                                      setEndDetailId((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.delete(contentKey);
                                        return newMap;
                                      });
                                    } else {
                                      alert("올바른 범위를 입력해주세요. (시작 ≤ 종료, 양수)");
                                    }
                                  }
                                }}
                                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRangeIndex(null);
                                  setEditingRange(null);
                                  // 상세정보 선택 초기화
                                  setStartDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(contentKey);
                                    return newMap;
                                  });
                                  setEndDetailId((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(contentKey);
                                    return newMap;
                                  });
                                }}
                                className="rounded bg-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-400"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        );
                      })() : (
                        <span className="font-medium">
                          {content.start_range} ~ {content.end_range}
                          {content.content_type === "book" ? " 페이지" : " 회차"}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isEditing && (() => {
                    const contentKey = `recommended-${index}`;
                    const recommendedRange = recommendedRanges.get(contentKey);
                    const unavailableReason = rangeUnavailableReasons.get(contentKey);
                    const studentRange = content.end_range - content.start_range + 1;
                    const recommendedRangeValue = recommendedRange ? recommendedRange.end - recommendedRange.start + 1 : null;
                    const difference = recommendedRangeValue !== null ? studentRange - recommendedRangeValue : null;
                    
                    return (
                      <div className="ml-4 flex flex-col items-end gap-2">
                        {recommendedRange ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs">
                            <div className="font-medium text-blue-900">
                              💡 추천: {recommendedRange.start} ~ {recommendedRange.end}
                              {content.content_type === "book" ? " 페이지" : " 회차"}
                            </div>
                            {difference !== null && difference !== 0 && (
                              <div className={`mt-0.5 text-xs ${difference > 0 ? "text-red-600" : "text-green-600"}`}>
                                {difference > 0 ? "+" : ""}{difference} {content.content_type === "book" ? "페이지" : "회차"} 차이
                              </div>
                            )}
                          </div>
                        ) : unavailableReason ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                            <div className="text-gray-600">
                              추천 범위 없음
                            </div>
                            <div className="mt-0.5 text-gray-500">
                              ({unavailableReason})
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRangeIndex({ type: "recommended", index });
                              setEditingRange({
                                start: String(content.start_range),
                                end: String(content.end_range),
                              });
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            범위 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = data.recommended_contents.filter((_, i) => i !== index);
                              onUpdate({ recommended_contents: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 과목별 그룹화된 학습 범위 요약 */}
      {sortedSubjects.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">과목별 학습 범위</h3>
          <div className="space-y-3">
            {sortedSubjects.map((subject) => {
              const contents = contentsBySubject.get(subject) || [];
              const isRequired = requiredSubjects.includes(subject);
              const hasRequired = selectedSubjectCategories.has(subject);

              return (
                <div key={subject} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">{subject}</h4>
                    {isRequired && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        필수
                      </span>
                    )}
                    {isRequired && !hasRequired && (
                      <span className="text-xs text-red-600">(미선택)</span>
                    )}
                    <span className="ml-auto text-xs text-gray-500">{contents.length}개</span>
                  </div>
                  <div className="space-y-2">
                    {contents.map((content, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                      >
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-900">{content.title}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            {content.content_type === "book" && "📚"}
                            {content.content_type === "lecture" && "🎧"}
                            <span className="ml-1">
                              {content.start_range} ~ {content.end_range}
                              {content.content_type === "book" ? " 페이지" : " 회차"}
                            </span>
                          </div>
                        </div>
                        {content.isRecommended && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            추천
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 콘텐츠가 없는 경우 */}
      {totalCount === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">선택된 콘텐츠가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">
            이전 단계에서 콘텐츠를 선택해주세요.
          </p>
        </div>
      )}


      {/* 전략과목/취약과목 정보 설정 (1730 Timetable 필수) */}
      {data.scheduler_type === "1730_timetable" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            전략과목/취약과목 정보 <span className="text-red-500">*</span>
          </h3>
          <p className="mb-4 text-xs text-gray-600">
            각 과목을 전략과목 또는 취약과목으로 분류하여 학습 배정 방식을 결정합니다.
          </p>

          <div className="space-y-3">
            {(() => {
              // 선택된 콘텐츠에서 과목 목록 추출
              const subjectSet = new Set<string>();
              contentInfos.forEach((info) => {
                if (info.subject_category) {
                  subjectSet.add(info.subject_category);
                }
              });
              const subjects = Array.from(subjectSet).sort();

              if (subjects.length === 0) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    선택된 콘텐츠에 과목 정보가 없습니다. 콘텐츠를 선택해주세요.
                  </div>
                );
              }

              return subjects.map((subject) => {
                const existingAllocation = data.subject_allocations?.find(
                  (a) => a.subject_name === subject
                );
                const subjectType = existingAllocation?.subject_type || "weakness";
                const weeklyDays = existingAllocation?.weekly_days || 3;

                return (
                  <div
                    key={subject}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{subject}</h4>
                      <span className="text-xs text-gray-500">
                        {contentInfos.filter((c) => c.subject_category === subject).length}개 콘텐츠
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                          과목 유형
                        </label>
                        <div className="flex gap-3">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                            <input
                              type="radio"
                              name={`subject_type_${subject}`}
                              value="weakness"
                              checked={subjectType === "weakness"}
                              onChange={() => {
                                const current = data.subject_allocations || [];
                                const filtered = current.filter((a) => a.subject_name !== subject);
                                onUpdate({
                                  subject_allocations: [
                                    ...filtered,
                                    {
                                      subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                                      subject_name: subject,
                                      subject_type: "weakness",
                                    },
                                  ],
                                });
                              }}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">취약과목</div>
                              <div className="text-xs text-gray-500">
                                전체 학습일에 플랜 배정 (더 많은 시간 필요)
                              </div>
                            </div>
                          </label>
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                            <input
                              type="radio"
                              name={`subject_type_${subject}`}
                              value="strategy"
                              checked={subjectType === "strategy"}
                              onChange={() => {
                                const current = data.subject_allocations || [];
                                const filtered = current.filter((a) => a.subject_name !== subject);
                                onUpdate({
                                  subject_allocations: [
                                    ...filtered,
                                    {
                                      subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                                      subject_name: subject,
                                      subject_type: "strategy",
                                      weekly_days: 3,
                                    },
                                  ],
                                });
                              }}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">전략과목</div>
                              <div className="text-xs text-gray-500">
                                주당 배정 일수에 따라 배정
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {subjectType === "strategy" && (
                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-700">
                            주당 배정 일수
                          </label>
                          <select
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                            value={weeklyDays}
                            onChange={(e) => {
                              const current = data.subject_allocations || [];
                              const filtered = current.filter((a) => a.subject_name !== subject);
                              onUpdate({
                                subject_allocations: [
                                  ...filtered,
                                  {
                                    subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                                    subject_name: subject,
                                    subject_type: "strategy",
                                    weekly_days: Number(e.target.value),
                                  },
                                ],
                              });
                            }}
                          >
                            <option value="2">주 2일</option>
                            <option value="3">주 3일</option>
                            <option value="4">주 4일</option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500">
                            선택한 주당 일수에 따라 학습일에 균등하게 배정됩니다.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 교과 제약 조건 설정 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">교과 제약 조건</h3>
        <p className="mb-4 text-xs text-gray-600">
          플랜에 반드시 포함되어야 하는 교과를 선택하세요. (학생 제출 후 추가한 콘텐츠와 추천 콘텐츠 반영 후 점검)
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">필수 교과 (선택사항)</label>
            <div className="flex flex-wrap gap-3">
              {["국어", "수학", "영어", "과학", "사회"].map((subject) => (
                <label
                  key={subject}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={data.subject_constraints?.required_subjects?.includes(subject) || false}
                    onChange={(e) => {
                      const currentSubjects = data.subject_constraints?.required_subjects || [];
                      const newSubjects = e.target.checked
                        ? [...currentSubjects, subject]
                        : currentSubjects.filter((s) => s !== subject);
                      onUpdate({
                        subject_constraints: {
                          ...data.subject_constraints,
                          required_subjects: newSubjects.length > 0 ? newSubjects : undefined,
                          constraint_handling: data.subject_constraints?.constraint_handling || "strict",
                        },
                      });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-gray-700">{subject}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              선택한 교과가 플랜에 반드시 포함되어야 합니다.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">제약 조건 처리 방법</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              value={data.subject_constraints?.constraint_handling || "strict"}
              onChange={(e) => {
                onUpdate({
                  subject_constraints: {
                    ...data.subject_constraints,
                    constraint_handling: e.target.value as "strict" | "warning" | "auto_fix",
                    required_subjects: data.subject_constraints?.required_subjects,
                  },
                });
              }}
            >
              <option value="strict">엄격 (조건 불만족 시 플랜 생성 실패)</option>
              <option value="warning">경고 (조건 불만족 시 경고만 표시)</option>
              <option value="auto_fix">자동 보완 (조건 불만족 시 자동으로 보완)</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  );
}

