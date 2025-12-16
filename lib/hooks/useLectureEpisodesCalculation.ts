import { useState, useMemo, useRef } from "react";
import type { LectureEpisode } from "@/lib/types/plan";
import { secondsToMinutes } from "@/lib/utils/duration";

type EpisodeState = {
  episode_number: number;
  episode_title: string;
  duration: number; // 분 단위
};

type UseLectureEpisodesCalculationReturn = {
  episodes: EpisodeState[];
  totalEpisodes: number;
  totalDuration: number; // 분 단위
  handleEpisodesChange: (episodes: Omit<LectureEpisode, "id" | "created_at">[]) => void;
  handleApplyTotalEpisodes: () => void;
  handleApplyTotalDuration: () => void;
  totalEpisodesRef: React.RefObject<HTMLInputElement>;
  totalDurationRef: React.RefObject<HTMLInputElement>;
};

/**
 * 강의 회차 정보 기반 계산 로직을 관리하는 공통 훅
 * 
 * @param initialEpisodes 초기 회차 정보 (선택사항, duration은 초 또는 분 단위 모두 가능)
 * @returns 회차 정보 상태, 계산된 총 회차/시간(분 단위), 핸들러 함수들
 */
export function useLectureEpisodesCalculation(
  initialEpisodes?: LectureEpisode[]
): UseLectureEpisodesCalculationReturn {
  // 회차 정보 상태 관리 (초 단위를 분 단위로 변환)
  const [episodes, setEpisodes] = useState<EpisodeState[]>(() => {
    if (!initialEpisodes) return [];
    
    return initialEpisodes.map((e) => {
      // duration이 1000 이상이면 초 단위로 간주하고 분으로 변환
      // (일반적으로 분 단위는 1000 이하, 초 단위는 그 이상)
      const durationInSeconds = e.duration || 0;
      const durationInMinutes = durationInSeconds > 1000 
        ? secondsToMinutes(durationInSeconds) || 0
        : durationInSeconds;
      
      return {
        episode_number: e.episode_number || 0,
        episode_title: e.episode_title || "",
        duration: durationInMinutes,
      };
    });
  });

  // ref 선언
  const totalEpisodesRef = useRef<HTMLInputElement>(null);
  const totalDurationRef = useRef<HTMLInputElement>(null);

  // 총 회차 수 계산 (배열 길이 기반)
  const totalEpisodes = useMemo(() => episodes.length, [episodes]);

  // 총 강의시간 계산 (시간 합계)
  const totalDuration = useMemo(() => {
    return episodes.reduce((sum, episode) => {
      return sum + (episode.duration || 0);
    }, 0);
  }, [episodes]);

  // 회차 정보 변경 핸들러
  // onChange로 전달되는 episodes는 이미 분 단위로 변환되어 있음 (LectureEpisodesManager에서 처리)
  const handleEpisodesChange = (
    newEpisodes: Omit<LectureEpisode, "id" | "created_at">[]
  ) => {
    setEpisodes(
      newEpisodes.map((e) => ({
        episode_number: e.episode_number || 0,
        episode_title: e.episode_title || "",
        duration: e.duration || 0, // 이미 분 단위
      }))
    );
  };

  // 총 회차 적용 버튼 핸들러
  const handleApplyTotalEpisodes = () => {
    if (totalEpisodesRef.current && totalEpisodes > 0) {
      totalEpisodesRef.current.value = totalEpisodes.toString();
      // input 이벤트 트리거하여 React가 값 변경을 인식하도록
      totalEpisodesRef.current.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  };

  // 총 강의시간 적용 버튼 핸들러
  const handleApplyTotalDuration = () => {
    if (totalDurationRef.current && totalDuration > 0) {
      totalDurationRef.current.value = totalDuration.toString();
      // input 이벤트 트리거하여 React가 값 변경을 인식하도록
      totalDurationRef.current.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  };

  return {
    episodes,
    totalEpisodes,
    totalDuration,
    handleEpisodesChange,
    handleApplyTotalEpisodes,
    handleApplyTotalDuration,
    totalEpisodesRef,
    totalDurationRef,
  };
}

