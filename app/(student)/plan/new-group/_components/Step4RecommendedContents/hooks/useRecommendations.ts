/**
 * useRecommendations Hook
 * 추천 콘텐츠 조회 및 관리
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { WizardData } from "../../PlanGroupWizard";
import {
  PlanGroupError,
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { RecommendedContent, UseRecommendationsReturn } from "../types";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../constants";

type UseRecommendationsProps = {
  data: WizardData;
  isEditMode: boolean;
  studentId?: string;
  onUpdate: (updates: Partial<WizardData>) => void;
};

export function useRecommendations({
  data,
  isEditMode,
  studentId,
  onUpdate,
}: UseRecommendationsProps): UseRecommendationsReturn {
  const [recommendedContents, setRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [allRecommendedContents, setAllRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [loading, setLoading] = useState(!isEditMode);
  const [hasRequestedRecommendations, setHasRequestedRecommendations] =
    useState(!isEditMode);
  const [hasScoreData, setHasScoreData] = useState(false);
  
  // 편집 모드에서 초기 데이터 로드 시 추천 콘텐츠가 있으면 hasRequestedRecommendations를 true로 설정
  // 하지만 recommendedContents는 빈 배열로 유지 (추천 목록을 다시 조회해야 함)
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    if (isEditMode && !hasInitializedRef.current) {
      // 편집 모드에서 초기 로드 시 추천 콘텐츠가 있으면 추천을 받은 것으로 간주
      if (data.recommended_contents.length > 0) {
        setHasRequestedRecommendations(true);
        // 추천 콘텐츠가 있지만 recommendedContents는 빈 배열이므로
        // 사용자가 다시 추천을 요청하거나 추가 추천을 받을 수 있도록 함
      }
      hasInitializedRef.current = true;
    }
  }, [isEditMode, data.recommended_contents.length]);

  /**
   * 학생 콘텐츠의 master_content_id 수집
   */
  const collectStudentMasterIds = useCallback(async () => {
    const studentMasterIds = new Set<string>();
    
    // WizardData에서 직접 가져오기
    data.student_contents.forEach((c) => {
      const masterContentId = (c as any).master_content_id;
      if (masterContentId) {
        studentMasterIds.add(masterContentId);
      }
    });

    // master_content_id가 없는 콘텐츠는 DB에서 조회
    const studentContentsWithoutMasterId = data.student_contents.filter(
      (c) =>
        (c.content_type === "book" || c.content_type === "lecture") &&
        !(c as any).master_content_id
    ) as Array<{ content_id: string; content_type: "book" | "lecture" }>;

    if (studentContentsWithoutMasterId.length > 0) {
      try {
        const { getStudentContentMasterIdsAction } = await import(
          "@/app/(student)/actions/getStudentContentMasterIds"
        );
        const masterIdResult = await getStudentContentMasterIdsAction(
          studentContentsWithoutMasterId
        );
        if (masterIdResult.success && masterIdResult.data) {
          masterIdResult.data.forEach((masterId, contentId) => {
            if (masterId) {
              studentMasterIds.add(masterId);
            }
          });
        }
      } catch (error) {
        console.warn(
          "[useRecommendations] master_content_id 조회 실패:",
          error
        );
      }
    }

    return studentMasterIds;
  }, [data.student_contents]);

  /**
   * 중복 콘텐츠 필터링
   */
  const filterDuplicateContents = useCallback(
    (recommendations: RecommendedContent[], studentMasterIds: Set<string>) => {
      const existingIds = new Set([
        ...data.student_contents.map((c) => c.content_id),
        ...data.recommended_contents.map((c) => c.content_id),
      ]);

      return recommendations.filter((r: RecommendedContent) => {
        // content_id로 직접 비교
        if (existingIds.has(r.id)) {
          return false;
        }
        // master_content_id로 비교
        if (studentMasterIds.has(r.id)) {
          return false;
        }
        // data.recommended_contents에 이미 있는 콘텐츠 제외
        if (data.recommended_contents.some((rc) => rc.content_id === r.id)) {
          return false;
        }
        return true;
      });
    },
    [data.student_contents, data.recommended_contents]
  );

  /**
   * 자동 배정: 마스터 콘텐츠 상세 정보 조회 및 추가
   */
  const autoAssignContents = useCallback(
    async (recommendations: RecommendedContent[]) => {
      const contentsToAutoAdd: Array<{
        content_type: "book" | "lecture";
        content_id: string;
        start_range: number;
        end_range: number;
        title?: string;
        subject_category?: string;
      }> = [];

      for (const r of recommendations) {
        try {
          const response = await fetch(
            `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
          );

          let startRange = 1;
          let endRange = 100;

          if (response.ok) {
            const result = await response.json();

            if (r.contentType === "book") {
              const details = result.details || [];
              if (details.length > 0) {
                startRange = details[0].page_number || 1;
                endRange = details[details.length - 1].page_number || 100;
              }
            } else if (r.contentType === "lecture") {
              const episodes = result.episodes || [];
              if (episodes.length > 0) {
                startRange = episodes[0].episode_number || 1;
                endRange = episodes[episodes.length - 1].episode_number || 100;
              }
            }
          }

          contentsToAutoAdd.push({
            content_type: r.contentType as "book" | "lecture",
            content_id: r.id,
            start_range: startRange,
            end_range: endRange,
            title: r.title,
            subject_category: r.subject_category || undefined,
          });
        } catch (error) {
          console.warn(
            `[useRecommendations] 콘텐츠 ${r.id} 상세 정보 조회 실패:`,
            error
          );
          // 조회 실패 시 기본값 사용
          contentsToAutoAdd.push({
            content_type: r.contentType as "book" | "lecture",
            content_id: r.id,
            start_range: 1,
            end_range: 100,
            title: r.title,
            subject_category: r.subject_category || undefined,
          });
        }
      }

      // 최대 9개 제한 확인
      const currentTotal =
        data.student_contents.length + data.recommended_contents.length;
      const toAdd = contentsToAutoAdd.length;

      if (currentTotal + toAdd > 9) {
        const maxToAdd = 9 - currentTotal;
        const trimmed = contentsToAutoAdd.slice(0, maxToAdd);

        if (trimmed.length > 0) {
          onUpdate({
            recommended_contents: [...data.recommended_contents, ...trimmed],
          });
          alert(SUCCESS_MESSAGES.RECOMMENDATIONS_ADDED(trimmed.length) + 
            ` (최대 9개 제한으로 ${toAdd - trimmed.length}개 제외됨)`);
        } else {
          alert("추가할 수 있는 콘텐츠가 없습니다. (최대 9개 제한)");
        }
      } else {
        onUpdate({
          recommended_contents: [
            ...data.recommended_contents,
            ...contentsToAutoAdd,
          ],
        });
        alert(SUCCESS_MESSAGES.RECOMMENDATIONS_ADDED(contentsToAutoAdd.length));
      }
    },
    [data.student_contents, data.recommended_contents, onUpdate]
  );

  /**
   * 교과별 추천 목록 조회
   */
  const fetchRecommendationsWithSubjects = useCallback(
    async (
      subjects: string[],
      counts: Map<string, number>,
      autoAssign: boolean = false
    ) => {
      setLoading(true);
      try {
        // 쿼리 파라미터 구성
        const params = new URLSearchParams();
        subjects.forEach((subject) => {
          const count = counts.get(subject) || 1;
          params.append("subjects", subject);
          params.append(`count_${subject}`, String(count));
        });

        if (studentId) {
          params.append("student_id", studentId);
        }

        // API 호출
        const response = await fetch(
          `/api/recommended-master-contents?${params.toString()}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[useRecommendations] API 응답 실패:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          alert(
            `추천 콘텐츠를 불러오는 데 실패했습니다. (${response.status} ${response.statusText})`
          );
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (!result.success) {
          console.error("[useRecommendations] API 에러:", result.error);
          alert(
            result.error?.message || "추천 콘텐츠를 불러오는 데 실패했습니다."
          );
          setLoading(false);
          return;
        }

        const recommendations = result.data?.recommendations || [];

        // 추천 콘텐츠가 없는 경우
        if (recommendations.length === 0) {
          alert(
            "추천 콘텐츠가 부족합니다. 다른 교과를 선택하거나 개수를 조정해주세요."
          );
          setLoading(false);
          return;
        }

        // 교과별 분류 및 부족한 교과 확인
        const recommendedBySubject = new Map<string, RecommendedContent[]>();
        recommendations.forEach((r: RecommendedContent) => {
          if (r.subject_category && subjects.includes(r.subject_category)) {
            if (!recommendedBySubject.has(r.subject_category)) {
              recommendedBySubject.set(r.subject_category, []);
            }
            recommendedBySubject.get(r.subject_category)!.push(r);
          }
        });

        const insufficientSubjects: string[] = [];
        subjects.forEach((subject) => {
          const requestedCount = counts.get(subject) || 1;
          const actualCount = recommendedBySubject.get(subject)?.length || 0;
          if (actualCount < requestedCount) {
            insufficientSubjects.push(
              `${subject} (요청: ${requestedCount}개, 실제: ${actualCount}개)`
            );
          }
        });

        if (insufficientSubjects.length > 0) {
          const confirmMessage = `다음 교과의 추천 콘텐츠가 부족합니다:\n${insufficientSubjects.join(
            "\n"
          )}\n\n부족한 교과를 제외하고 추천 받으시겠습니까?`;
          const shouldContinue = window.confirm(confirmMessage);
          if (!shouldContinue) {
            setLoading(false);
            return;
          }
        }

        // 성적 데이터 존재 여부 확인
        const hasDetailedReasons = recommendations.some(
          (r: RecommendedContent) =>
            r.reason?.includes("내신") ||
            r.reason?.includes("모의고사") ||
            r.reason?.includes("위험도") ||
            r.scoreDetails
        );
        setHasScoreData(hasDetailedReasons);

        // master_content_id 수집
        const studentMasterIds = await collectStudentMasterIds();

        // allRecommendedContents 업데이트 (병합)
        const recommendationsMap = new Map<string, RecommendedContent>();
        recommendations.forEach((c: RecommendedContent) => {
          recommendationsMap.set(c.id, c);
        });

        setAllRecommendedContents((prev) => {
          const merged = new Map<string, RecommendedContent>();
          prev.forEach((c) => merged.set(c.id, c));
          recommendationsMap.forEach((c, id) => {
            merged.set(id, c);
          });
          return Array.from(merged.values());
        });

        // 중복 제거
        const filteredRecommendations = filterDuplicateContents(
          recommendations,
          studentMasterIds
        );

        setRecommendedContents(filteredRecommendations);
        setHasRequestedRecommendations(true);

        // 자동 배정
        if (autoAssign && filteredRecommendations.length > 0) {
          await autoAssignContents(filteredRecommendations);
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_FETCH_FAILED
        );
        console.error(
          "[useRecommendations] 추천 목록 조회 실패:",
          planGroupError
        );
        alert("추천 콘텐츠를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [
      data,
      studentId,
      collectStudentMasterIds,
      filterDuplicateContents,
      autoAssignContents,
    ]
  );

  /**
   * 기본 추천 목록 조회 (편집 모드가 아닐 때)
   */
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (studentId) {
        params.append("student_id", studentId);
      }
      const url = `/api/recommended-master-contents${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error("[useRecommendations] API 실패");
        setLoading(false);
        return;
      }

      const result = await response.json();
      const recommendations = result.data?.recommendations || [];

      // 성적 데이터 존재 여부 확인
      const hasDetailedReasons = recommendations.some(
        (r: RecommendedContent) =>
          r.reason?.includes("내신") ||
          r.reason?.includes("모의고사") ||
          r.reason?.includes("위험도") ||
          r.scoreDetails
      );
      setHasScoreData(hasDetailedReasons);

      // master_content_id 수집
      const studentMasterIds = await collectStudentMasterIds();

      // allRecommendedContents 업데이트
      setAllRecommendedContents(recommendations);

      // 중복 제거
      const filteredRecommendations = filterDuplicateContents(
        recommendations,
        studentMasterIds
      );

      setRecommendedContents(filteredRecommendations);
      setHasRequestedRecommendations(true);
    } catch (error) {
      const planGroupError = toPlanGroupError(
        error,
        PlanGroupErrorCodes.CONTENT_FETCH_FAILED
      );
      console.error("[useRecommendations] 추천 조회 실패:", planGroupError);
    } finally {
      setLoading(false);
    }
  }, [studentId, collectStudentMasterIds, filterDuplicateContents]);

  return {
    recommendedContents,
    allRecommendedContents,
    loading,
    hasRequestedRecommendations,
    hasScoreData,
    fetchRecommendations,
    fetchRecommendationsWithSubjects,
    setRecommendedContents,
    setAllRecommendedContents,
  };
}

