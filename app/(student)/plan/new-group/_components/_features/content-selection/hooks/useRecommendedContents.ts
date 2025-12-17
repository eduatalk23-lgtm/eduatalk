import { useState, useCallback } from "react";
import type {
  RecommendedContent,
  RecommendationSettings,
} from "@/lib/types/content-selection";
import { getRecommendedMasterContentsAction } from "@/app/(student)/actions/getRecommendedMasterContents";
import {
  transformRecommendations,
  hasScoreDataInRecommendations,
} from "../utils/recommendationTransform";
import {
  prepareAutoAssignment,
  applyAutoAssignmentLimit,
} from "../utils/autoAssignment";

interface UseRecommendedContentsProps {
  studentId?: string;
  data: {
    student_contents: Array<{
      content_id: string;
      content_type: "book" | "lecture" | "custom";
      [key: string]: any;
    }>;
    recommended_contents: Array<{
      content_id: string;
      content_type: "book" | "lecture" | "custom";
      [key: string]: any;
    }>;
  };
  onUpdate: (updates: any) => void;
  recommendationSettings: RecommendationSettings;
}

export function useRecommendedContents({
  studentId,
  data,
  onUpdate,
  recommendationSettings,
}: UseRecommendedContentsProps) {
  // 추천 콘텐츠 상태
  const [recommendedContents, setRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [allRecommendedContents, setAllRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [selectedRecommendedIds, setSelectedRecommendedIds] = useState<
    Set<string>
  >(new Set());
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [hasRequestedRecommendations, setHasRequestedRecommendations] =
    useState(false);
  const [hasScoreData, setHasScoreData] = useState(false);

  // 추천 받기 요청
  const handleRequestRecommendations = useCallback(async () => {
    if (!studentId) {
      alert("학생 정보가 없습니다.");
      return;
    }

    console.log("[useRecommendedContents] 추천 받기 요청 시작:", {
      recommendationSettings: {
        selectedSubjects: Array.from(recommendationSettings.selectedSubjects),
        recommendationCounts: Object.fromEntries(
          recommendationSettings.recommendationCounts
        ),
        autoAssignContents: recommendationSettings.autoAssignContents,
      },
      studentId,
    });

    setRecommendationLoading(true);

    try {
      // 과목과 개수 배열로 변환
      const subjects: string[] = Array.from(recommendationSettings.selectedSubjects);
      const counts: Record<string, number> = {};
      subjects.forEach((subject: string) => {
        counts[subject] =
          recommendationSettings.recommendationCounts.get(subject) || 1;
      });

      // API 호출
      const result = await getRecommendedMasterContentsAction(
        studentId,
        subjects,
        counts
      );

      if (!result.success || !result.data) {
        alert("추천 콘텐츠를 불러오는 데 실패했습니다.");
        return;
      }

      const rawRecommendations = result.data.recommendations || [];

      // API 응답을 RecommendedContent로 변환
      const recommendations = transformRecommendations(rawRecommendations);

      // 성적 데이터 유무 확인
      const hasDetailedReasons = hasScoreDataInRecommendations(recommendations);
      setHasScoreData(hasDetailedReasons);

      // 중복 제거
      const existingIds = new Set([
        ...data.student_contents.map((c) => c.content_id),
        ...data.recommended_contents.map((c) => c.content_id),
      ]);

      // 학생 콘텐츠의 master_content_id 수집
      const studentMasterIds = new Set<string>();
      data.student_contents.forEach((c) => {
        const masterContentId = (c as any).master_content_id;
        if (masterContentId) {
          studentMasterIds.add(masterContentId);
        }
      });

      // 추천 콘텐츠 매핑
      const recommendationsMap = new Map<string, RecommendedContent>();
      recommendations.forEach((c) => {
        recommendationsMap.set(c.id, c);
      });

      // 전체 목록 업데이트
      setAllRecommendedContents((prev) => {
        const merged = new Map<string, RecommendedContent>();
        prev.forEach((c) => merged.set(c.id, c));
        recommendationsMap.forEach((c, id) => {
          merged.set(id, c);
        });
        return Array.from(merged.values());
      });

      // 필터링
      const filteredRecommendations = recommendations.filter((r) => {
        // content_id로 직접 비교
        if (existingIds.has(r.id)) {
          return false;
        }
        // master_content_id로 비교
        if (studentMasterIds.has(r.id)) {
          return false;
        }
        return true;
      });

      setRecommendedContents(filteredRecommendations);
      setHasRequestedRecommendations(true);

      // 자동 배정 체크
      console.log("[useRecommendedContents] 자동 배정 체크:", {
        autoAssign: recommendationSettings.autoAssignContents,
        filteredRecommendationsCount: filteredRecommendations.length,
        willAutoAssign:
          recommendationSettings.autoAssignContents &&
          filteredRecommendations.length > 0,
      });

      // 자동 배정 실행
      const shouldAutoAssign =
        recommendationSettings.autoAssignContents &&
        filteredRecommendations.length > 0;

      if (shouldAutoAssign) {
        console.log("[useRecommendedContents] 자동 배정 시작:", {
          recommendationsCount: filteredRecommendations.length,
          recommendations: filteredRecommendations.map((r) => ({
            id: r.id,
            title: r.title,
            contentType: r.contentType,
          })),
        });

        try {
          // 자동 배정 데이터 준비
          const contentsToAutoAdd = await prepareAutoAssignment(
            filteredRecommendations
          );

          console.log(
            "[useRecommendedContents] 자동 배정 준비 완료:",
            {
              contentsToAutoAdd: contentsToAutoAdd.map((c) => ({
                content_id: c.content_id,
                content_type: c.content_type,
                start_range: c.start_range,
                end_range: c.end_range,
                title: c.title,
              })),
            }
          );

          // 제한 적용
          const currentTotal =
            data.student_contents.length + data.recommended_contents.length;
          const result = applyAutoAssignmentLimit(
            contentsToAutoAdd,
            currentTotal,
            9
          );

          console.log("[useRecommendedContents] 자동 배정 실행:", {
            currentTotal,
            toAdd: contentsToAutoAdd.length,
            added: result.added.length,
            excluded: result.excluded,
          });

          if (result.added.length > 0) {
            const newRecommendedContents = [
              ...data.recommended_contents,
              ...result.added,
            ];

            onUpdate({
              recommended_contents: newRecommendedContents,
            });

            setTimeout(() => {
              alert(result.message);
            }, 0);

            // 자동 배정된 콘텐츠를 추천 목록에서 제거
            const autoAssignedIds = new Set(
              filteredRecommendations.map((r) => r.id)
            );
            setRecommendedContents((prev) => {
              const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
              console.log("[useRecommendedContents] 자동 배정 후 목록 업데이트:", {
                before: prev.length,
                after: filtered.length,
                autoAssigned: autoAssignedIds.size,
              });
              return filtered;
            });
          } else {
            setTimeout(() => {
              alert(result.message);
            }, 0);
          }

          console.log("[useRecommendedContents] 자동 배정 완료");
        } catch (error) {
          console.error(
            "[useRecommendedContents] 자동 배정 중 오류 발생:",
            error
          );
          alert("자동 배정 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      } else {
        console.log("[useRecommendedContents] 자동 배정 스킵:", {
          autoAssign: recommendationSettings.autoAssignContents,
          filteredRecommendationsCount: filteredRecommendations.length,
          reason: !recommendationSettings.autoAssignContents
            ? "자동 배정 옵션이 비활성화됨"
            : "추천 콘텐츠가 없음",
        });
      }
    } catch (error) {
      console.error("[useRecommendedContents] 추천 받기 실패:", error);
      alert("추천 콘텐츠를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setRecommendationLoading(false);
    }
  }, [
    recommendationSettings,
    studentId,
    data.student_contents,
    data.recommended_contents,
    onUpdate,
  ]);

  return {
    recommendedContents,
    allRecommendedContents,
    selectedRecommendedIds,
    recommendationLoading,
    hasRequestedRecommendations,
    hasScoreData,
    handleRequestRecommendations,
    setSelectedRecommendedIds,
  };
}
