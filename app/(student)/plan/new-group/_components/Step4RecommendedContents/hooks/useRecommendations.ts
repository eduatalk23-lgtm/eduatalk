/**
 * useRecommendations Hook
 * 추천 콘텐츠 조회 및 관리
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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

  // data.recommended_contents가 업데이트되면 recommendedContents와 allRecommendedContents에서 제거
  // 의존성을 content_id 배열로 변경하여 정확한 변경 감지
  const recommendedContentIds = useMemo(
    () => data.recommended_contents.map((c) => c.content_id).sort().join(","),
    [data.recommended_contents]
  );

  useEffect(() => {
    if (data.recommended_contents.length > 0) {
      const addedContentIds = new Set(
        data.recommended_contents.map((c) => c.content_id)
      );
      
      // recommendedContents에서 제거
      setRecommendedContents((prev) => {
        const filtered = prev.filter((c) => !addedContentIds.has(c.id));
        
        if (filtered.length !== prev.length) {
          console.log("[useRecommendations] 추가된 콘텐츠를 추천 목록에서 제거:", {
            before: prev.length,
            after: filtered.length,
            removed: prev.length - filtered.length,
            removedIds: prev
              .filter((c) => addedContentIds.has(c.id))
              .map((c) => ({ id: c.id, title: c.title })),
          });
        }
        
        return filtered;
      });
      
      // allRecommendedContents에서도 제거
      setAllRecommendedContents((prev) => {
        const filtered = prev.filter((c) => !addedContentIds.has(c.id));
        
        if (filtered.length !== prev.length) {
          console.log("[useRecommendations] 추가된 콘텐츠를 전체 추천 목록에서 제거:", {
            before: prev.length,
            after: filtered.length,
            removed: prev.length - filtered.length,
            removedIds: prev
              .filter((c) => addedContentIds.has(c.id))
              .map((c) => ({ id: c.id, title: c.title })),
          });
        }
        
        return filtered;
      });
    } else {
      // recommended_contents가 비어있으면 필터링하지 않음 (초기 상태)
      // 하지만 이미 추가된 콘텐츠는 제거된 상태를 유지
    }
  }, [recommendedContentIds]);

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
          let startRange = 1;
          let endRange = 100;

          // 상세 정보 조회
          let detailsResult: any = null;
          let hasDetails = false;
          
          const detailsResponse = await fetch(
            `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
          );

          if (detailsResponse.ok) {
            detailsResult = await detailsResponse.json();

            // API 응답 형식: { success: true, data: { details/episodes: [...] } }
            if (detailsResult.success && detailsResult.data) {
              if (r.contentType === "book") {
                const details = detailsResult.data.details || [];
                hasDetails = details.length > 0;
                if (hasDetails) {
                  startRange = details[0].page_number || 1;
                  endRange = details[details.length - 1].page_number || 100;
                }
              } else if (r.contentType === "lecture") {
                const episodes = detailsResult.data.episodes || [];
                hasDetails = episodes.length > 0;
                if (hasDetails) {
                  startRange = episodes[0].episode_number || 1;
                  endRange = episodes[episodes.length - 1].episode_number || 100;
                }
              }
            } else {
              // 레거시 응답 형식 지원 (하위 호환성)
              if (r.contentType === "book") {
                const details = detailsResult.details || detailsResult.data?.details || [];
                hasDetails = details.length > 0;
                if (hasDetails) {
                  startRange = details[0].page_number || 1;
                  endRange = details[details.length - 1].page_number || 100;
                }
              } else if (r.contentType === "lecture") {
                const episodes = detailsResult.episodes || detailsResult.data?.episodes || [];
                hasDetails = episodes.length > 0;
                if (hasDetails) {
                  startRange = episodes[0].episode_number || 1;
                  endRange = episodes[episodes.length - 1].episode_number || 100;
                }
              }
            }
          }

          // 상세 정보가 없거나 기본값일 때 총량 조회 (전체 범위 설정)
          if (!hasDetails || (startRange === 1 && endRange === 100)) {
            try {
              const infoResponse = await fetch(
                `/api/master-content-info?content_type=${r.contentType}&content_id=${r.id}`
              );

              if (infoResponse.ok) {
                const infoResult = await infoResponse.json();
                if (infoResult.success && infoResult.data) {
                  if (r.contentType === "book" && infoResult.data.total_pages) {
                    endRange = infoResult.data.total_pages;
                    console.log(`[useRecommendations] 자동 배정: ${r.title} 총 페이지수 ${endRange}로 설정`);
                  } else if (r.contentType === "lecture" && infoResult.data.total_episodes) {
                    endRange = infoResult.data.total_episodes;
                    console.log(`[useRecommendations] 자동 배정: ${r.title} 총 회차 ${endRange}로 설정`);
                  }
                }
              }
            } catch (infoError) {
              // 총량 조회 실패는 무시 (기본값 100 사용)
              if (process.env.NODE_ENV === "development") {
                console.debug(
                  `[useRecommendations] 콘텐츠 ${r.id} 총량 조회 실패 (기본값 사용):`,
                  infoError
                );
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

      // 함수형 업데이트를 사용하여 최신 상태 보장
      onUpdate((prev) => {
        const currentTotal =
          prev.student_contents.length + prev.recommended_contents.length;
        const toAdd = contentsToAutoAdd.length;

        console.log("[useRecommendations] 자동 배정 실행:", {
          currentTotal,
          toAdd,
          contentsToAutoAdd: contentsToAutoAdd.map((c) => ({
            content_id: c.content_id,
            content_type: c.content_type,
            start_range: c.start_range,
            end_range: c.end_range,
            title: c.title,
          })),
        });

        if (currentTotal + toAdd > 9) {
          const maxToAdd = 9 - currentTotal;
          const trimmed = contentsToAutoAdd.slice(0, maxToAdd);

          if (trimmed.length > 0) {
            const newRecommendedContents = [
              ...prev.recommended_contents,
              ...trimmed,
            ];
            console.log("[useRecommendations] 자동 배정 (제한 적용):", {
              trimmed: trimmed.length,
              excluded: toAdd - trimmed.length,
              newRecommendedContents: newRecommendedContents.length,
              currentRecommendedContents: prev.recommended_contents.length,
              newContents: newRecommendedContents.map((c) => ({
                content_id: c.content_id,
                title: c.title,
                content_type: c.content_type,
              })),
            });

            console.log("[useRecommendations] onUpdate 호출 전:", {
              currentRecommendedContents: prev.recommended_contents.length,
              toAdd: trimmed.length,
              newRecommendedContents: newRecommendedContents.length,
            });

            // 비동기로 알림 표시 (상태 업데이트 후)
            setTimeout(() => {
              alert(
                SUCCESS_MESSAGES.RECOMMENDATIONS_ADDED(trimmed.length) +
                  ` (최대 9개 제한으로 ${toAdd - trimmed.length}개 제외됨)`
              );
            }, 0);

            return {
              recommended_contents: newRecommendedContents,
            };
          } else {
            console.warn(
              "[useRecommendations] 자동 배정 실패: 추가할 수 있는 콘텐츠가 없음 (최대 9개 제한)"
            );
            setTimeout(() => {
              alert("추가할 수 있는 콘텐츠가 없습니다. (최대 9개 제한)");
            }, 0);
            return {};
          }
        } else {
          const newRecommendedContents = [
            ...prev.recommended_contents,
            ...contentsToAutoAdd,
          ];
          console.log("[useRecommendations] 자동 배정 성공:", {
            added: contentsToAutoAdd.length,
            currentRecommendedContents: prev.recommended_contents.length,
            newRecommendedContents: newRecommendedContents.length,
            contents: newRecommendedContents.map((c) => ({
              content_id: c.content_id,
              title: c.title,
              content_type: c.content_type,
              start_range: c.start_range,
              end_range: c.end_range,
            })),
          });

          console.log("[useRecommendations] onUpdate 호출 전:", {
            currentRecommendedContents: prev.recommended_contents.length,
            toAdd: contentsToAutoAdd.length,
            newRecommendedContents: newRecommendedContents.length,
          });

          // 비동기로 알림 표시 (상태 업데이트 후)
          setTimeout(() => {
            alert(SUCCESS_MESSAGES.RECOMMENDATIONS_ADDED(contentsToAutoAdd.length));
          }, 0);

          return {
            recommended_contents: newRecommendedContents,
          };
        }
      });

      console.log("[useRecommendations] onUpdate 호출 완료");
    },
    [onUpdate]
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

        // API 응답 전체 로깅
        console.log("[useRecommendations] API 응답:", {
          success: result.success,
          hasData: !!result.data,
          hasRecommendations: !!result.data?.recommendations,
          recommendationsCount: result.data?.recommendations?.length || 0,
          rawResponse: result,
        });

        if (!result.success) {
          console.error("[useRecommendations] API 에러:", result.error);
          alert(
            result.error?.message || "추천 콘텐츠를 불러오는 데 실패했습니다."
          );
          setLoading(false);
          return;
        }

        const rawRecommendations = result.data?.recommendations || [];

        // 각 추천 콘텐츠의 contentType 필드 확인
        console.log("[useRecommendations] 추천 콘텐츠 상세 (변환 전):", {
          count: rawRecommendations.length,
          items: rawRecommendations.map((r: any) => ({
            id: r.id,
            title: r.title,
            contentType: r.contentType,
            content_type: r.content_type,
            hasContentType: !!r.contentType,
            hasContent_type: !!r.content_type,
            allKeys: Object.keys(r),
          })),
        });

        // API 응답을 RecommendedContent로 변환 (서버에서 contentType 보장)
        const recommendations: RecommendedContent[] = rawRecommendations.map((r: any) => {
          // contentType 검증 (서버에서 보장되지만 방어 코드)
          if (!r.contentType) {
            console.error("[useRecommendations] contentType이 없는 추천 콘텐츠:", {
              id: r.id,
              title: r.title,
              allKeys: Object.keys(r),
              rawData: r,
            });
            // 서버에서 보장되어야 하므로 에러 로깅만 수행
          }

          // 타입 검증
          if (r.contentType && r.contentType !== "book" && r.contentType !== "lecture") {
            console.error("[useRecommendations] 잘못된 contentType:", {
              id: r.id,
              title: r.title,
              contentType: r.contentType,
              rawData: r,
            });
          }

          return {
            id: r.id,
            contentType: (r.contentType || "book") as "book" | "lecture", // 서버에서 보장되지만 fallback
            title: r.title,
            subject_category: r.subject_category,
            subject: r.subject,
            semester: r.semester,
            revision: r.revision,
            publisher: r.publisher,
            platform: r.platform,
            difficulty_level: r.difficulty_level,
            reason: r.reason,
            priority: r.priority,
            scoreDetails: r.scoreDetails,
          };
        });

        // 변환 후 확인
        console.log("[useRecommendations] 추천 콘텐츠 상세 (변환 후):", {
          count: recommendations.length,
          items: recommendations.map((r) => ({
            id: r.id,
            title: r.title,
            contentType: r.contentType,
            hasContentType: !!r.contentType,
          })),
        });

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

        setHasRequestedRecommendations(true);

        // 자동 배정
        console.log("[useRecommendations] 자동 배정 체크:", {
          autoAssign,
          filteredRecommendationsCount: filteredRecommendations.length,
          willAutoAssign: autoAssign && filteredRecommendations.length > 0,
        });

        if (autoAssign && filteredRecommendations.length > 0) {
          console.log("[useRecommendations] 자동 배정 시작:", {
            recommendationsCount: filteredRecommendations.length,
            recommendations: filteredRecommendations.map((r) => ({
              id: r.id,
              title: r.title,
              contentType: r.contentType,
            })),
          });
          
          // 자동 배정 실행
          await autoAssignContents(filteredRecommendations);
          
          // 자동 배정 후 추천 목록에서 제거
          // autoAssignContents 내부에서 onUpdate를 호출하므로,
          // useEffect가 자동으로 recommendedContents에서 제거함
          // 상태 업데이트가 완료될 때까지 약간의 지연을 두고 목록 업데이트
          // (useEffect가 먼저 실행되도록 함)
          setTimeout(() => {
            const autoAssignedIds = new Set(
              filteredRecommendations.map((r) => r.id)
            );
            setRecommendedContents((prev) => {
              const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
              console.log("[useRecommendations] 자동 배정 후 목록 업데이트:", {
                before: prev.length,
                after: filtered.length,
                autoAssigned: autoAssignedIds.size,
              });
              return filtered;
            });
          }, 0);
        } else {
          console.log("[useRecommendations] 자동 배정 스킵:", {
            autoAssign,
            filteredRecommendationsCount: filteredRecommendations.length,
            reason: !autoAssign
              ? "자동 배정 옵션이 비활성화됨"
              : "추천 콘텐츠가 없음",
          });
          
          // 자동 배정하지 않으면 추천 목록 표시
          setRecommendedContents(filteredRecommendations);
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

      // API 응답 전체 로깅
      console.log("[useRecommendations] API 응답 (fetchRecommendations):", {
        success: result.success,
        hasData: !!result.data,
        hasRecommendations: !!result.data?.recommendations,
        recommendationsCount: result.data?.recommendations?.length || 0,
        rawResponse: result,
      });

      const rawRecommendations = result.data?.recommendations || [];

      // 각 추천 콘텐츠의 contentType 필드 확인
      console.log("[useRecommendations] 추천 콘텐츠 상세 (fetchRecommendations, 변환 전):", {
        count: rawRecommendations.length,
        items: rawRecommendations.map((r: any) => ({
          id: r.id,
          title: r.title,
          contentType: r.contentType,
          content_type: r.content_type,
          hasContentType: !!r.contentType,
          hasContent_type: !!r.content_type,
          allKeys: Object.keys(r),
        })),
      });

      // API 응답을 RecommendedContent로 변환 (서버에서 contentType 보장)
      const recommendations: RecommendedContent[] = rawRecommendations.map((r: any) => {
        // contentType 검증 (서버에서 보장되지만 방어 코드)
        if (!r.contentType) {
          console.error("[useRecommendations] contentType이 없는 추천 콘텐츠 (fetchRecommendations):", {
            id: r.id,
            title: r.title,
            allKeys: Object.keys(r),
            rawData: r,
          });
          // 서버에서 보장되어야 하므로 에러 로깅만 수행
        }

        // 타입 검증
        if (r.contentType && r.contentType !== "book" && r.contentType !== "lecture") {
          console.error("[useRecommendations] 잘못된 contentType (fetchRecommendations):", {
            id: r.id,
            title: r.title,
            contentType: r.contentType,
            rawData: r,
          });
        }

        return {
          id: r.id,
          contentType: (r.contentType || "book") as "book" | "lecture", // 서버에서 보장되지만 fallback
          title: r.title,
          subject_category: r.subject_category,
          subject: r.subject,
          semester: r.semester,
          revision: r.revision,
          publisher: r.publisher,
          platform: r.platform,
          difficulty_level: r.difficulty_level,
          reason: r.reason,
          priority: r.priority,
          scoreDetails: r.scoreDetails,
        };
      });

      // 변환 후 확인
      console.log("[useRecommendations] 추천 콘텐츠 상세 (fetchRecommendations, 변환 후):", {
        count: recommendations.length,
        items: recommendations.map((r) => ({
          id: r.id,
          title: r.title,
          contentType: r.contentType,
          hasContentType: !!r.contentType,
        })),
      });

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

