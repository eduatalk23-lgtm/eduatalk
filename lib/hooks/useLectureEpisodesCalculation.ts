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
  totalEpisodesRef: React.RefObject<HTMLInputElement | null>;
  totalDurationRef: React.RefObject<HTMLInputElement | null>;
};

/**
 * 강의 회차 정보 기반 계산 로직을 관리하는 공통 훅
 * 
 * @param initialEpisodes 초기 회차 정보 (선택사항, DB에서 온 데이터는 duration이 초 단위)
 * @returns 회차 정보 상태, 계산된 총 회차/시간(분 단위), 핸들러 함수들
 */
export function useLectureEpisodesCalculation(
  initialEpisodes?: LectureEpisode[]
): UseLectureEpisodesCalculationReturn {
  // 회차 정보 상태 관리
  // initialEpisodes는 DB에서 온 데이터이므로 duration이 항상 초 단위
  // LectureEpisodesManager에서 onChange로 전달되는 데이터는 이미 분 단위로 변환됨
  const [episodes, setEpisodes] = useState<EpisodeState[]>(() => {
    if (!initialEpisodes) return [];
    
    // DB에서 온 초기값: 항상 초 단위이므로 분으로 변환
    return initialEpisodes.map((e) => ({
      episode_number: e.episode_number || 0,
      episode_title: e.episode_title || "",
      duration: e.duration ? secondsToMinutes(e.duration) || 0 : 0,
    }));
  });

  // ref 선언
  const totalEpisodesRef = useRef<HTMLInputElement | null>(null);
  const totalDurationRef = useRef<HTMLInputElement | null>(null);

  // 총 회차 수 계산 (배열 길이 기반)
  const totalEpisodes = useMemo(() => episodes.length, [episodes]);

  // 총 강의시간 계산 (시간 합계, 분 단위)
  const totalDuration = useMemo(() => {
    return episodes.reduce((sum, episode) => {
      return sum + (episode.duration || 0);
    }, 0);
  }, [episodes]);

  // 회차 정보 변경 핸들러
  // LectureEpisodesManager에서 전달되는 episodes는 이미 분 단위로 변환되어 있음
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

