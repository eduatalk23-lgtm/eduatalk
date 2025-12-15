
import { useState, useEffect, useCallback } from "react";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { WizardData } from "../../../PlanGroupWizard";
import { ContentInfo } from "../types";

type UseRecommendedRangesProps = {
  data: WizardData;
  contentInfos: ContentInfo[];
  contentTotals: Map<string, number>;
};

export function useRecommendedRanges({
  data,
  contentInfos,
  contentTotals,
}: UseRecommendedRangesProps) {
  const [recommendedRanges, setRecommendedRanges] = useState<
    Map<string, { start: number; end: number; reason: string }>
  >(new Map());
  const [rangeUnavailableReasons, setRangeUnavailableReasons] = useState<
    Map<string, string>
  >(new Map());

  // 추천 범위가 없는 이유를 반환하는 함수
  const getUnavailableReason = useCallback(
    (
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
    },
    []
  );

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

      const newRanges = new Map<
        string,
        { start: number; end: number; reason: string }
      >();
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
          // 교재: 일일 학습량을 페이지로 환산
          const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
          const dailyPages = Math.round(hoursPerContentPerDay * pagesPerHour);
          const recommendedEnd = Math.min(
            dailyPages * total_study_days,
            totalAmount
          );

          newRanges.set(contentKey, {
            start: 1,
            end: recommendedEnd,
            reason: `${totalContents}개 콘텐츠 분배, 일일 ${dailyPages}페이지 × ${total_study_days}일`,
          });
        } else {
          // 강의: 일일 학습량을 회차로 환산
          const episodesPerHour = defaultRangeRecommendationConfig.episodesPerHour;
          const dailyEpisodes = Math.round(
            hoursPerContentPerDay * episodesPerHour
          );
          const recommendedEnd = Math.min(
            dailyEpisodes * total_study_days,
            totalAmount
          );

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
  }, [
    data.schedule_summary,
    contentInfos,
    contentTotals,
    data.student_contents,
    data.recommended_contents,
    getUnavailableReason,
  ]);

  return { recommendedRanges, rangeUnavailableReasons };
}
